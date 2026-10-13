// SPDX-License-Identifier: MIT
// YAFI - Behavioral microcredit repaid automatically from every sale.
// The YAFI name and brand are reserved; the code is released under the MIT license.
pragma solidity ^0.8.24;

/// @title YafiCreditEscrowV2
/// @notice Every QR sale goes through this contract: an agreed % is retained to repay the
///         merchant's microloan and the rest is paid to the merchant instantly.
/// @dev V2 adds risk controls taken from traditional microfinance, enforced by code:
///      1. Credit ladder: the first loan is capped, and a new loan is only possible after the
///         previous one is fully repaid. The line only grows with what was repaid through
///         sales: next line = last loan + 50% of the part repaid through sales (up to 150%).
///         The line earned is kept, so a smaller loan does not shrink it.
///      2. No self-payment: a merchant cannot pay their own QR. They can still prepay with
///         `repay()` (e.g. cash sales): that lowers the debt and the interest, but never
///         counts as a sale and never grows the line. Paying from a second wallet cannot be
///         detected on chain, so the ladder is an upper bound and the lender still approves
///         every loan.
///      3. Minimum sale: dust sales cannot inflate the sales count.
///      4. Interest on the outstanding balance: simple annual rate, accrued per second, so
///         every repayment (sale or prepayment) also lowers the interest that follows.
///      Plus lender tools: write-off of unrecoverable loans, emergency pause, freezing,
///      timestamps for days-without-repayment alerts, and two-step ownership transfer.
contract YafiCreditEscrowV2 {
    struct Merchant {
        uint256 creditBalance;   // Outstanding debt (principal + interest) as of lastAccrualAt
        uint256 currentLoan;     // Principal of the current (or last) loan
        uint256 creditLine;      // Line earned on the ladder
        uint256 loanInterest;    // Interest charged on the current loan
        uint256 loanRepaid;      // Repaid on the current loan
        uint256 repaidFromSales; // Part of the current loan repaid through sales (drives the ladder)
        uint256 totalGranted;    // Total disbursed over time
        uint256 totalRepaid;     // Total repaid over time (behavioral score input)
        uint256 totalInterest;   // Total interest charged over time
        uint256 totalWrittenOff; // Total written off as a loss
        uint256 salesCount;      // Sales processed through YAFI
        uint64 loanId;           // Id of the current (or last) loan
        uint40 loanGrantedAt;    // When the current loan was disbursed
        uint40 lastRepaymentAt;  // Last sale retention or prepayment (days-without-repayment alerts)
        uint40 lastAccrualAt;    // Last time interest was added to creditBalance
        uint32 loansRepaid;      // Loans fully repaid (step on the credit ladder)
        uint32 loansWrittenOff;  // Loans written off as unrecoverable
        uint16 retentionBps;     // Retention per sale in basis points: 1000 = 10%
        uint16 annualRateBps;    // Simple annual interest rate in basis points: 4000 = 40%
        bool frozen;             // Lender froze the merchant: no retention, no new loans
    }

    uint16 public constant MAX_RETENTION_BPS = 3000;  // 30% cap
    uint16 public constant LADDER_GROWTH_BPS = 5000;  // Line grows by 50% of what sales repaid
    uint16 private constant BPS_BASE = 10000;
    uint256 private constant YEAR = 365 days;

    address public owner;            // Lender / administrator
    address public pendingOwner;     // Two-step ownership transfer
    bool public paused;              // Emergency stop for new loans and sales
    uint256 public treasury;         // Funds available to lend
    uint256 public firstLoanCap;     // Maximum amount of a merchant's first loan
    uint256 public maxLoanCap;       // Maximum amount of any loan
    uint256 public minSaleAmount;    // Smallest sale that counts (anti-dust)
    uint16 public maxAnnualRateBps;  // Highest interest rate the lender may set
    uint64 public loanCount;         // Loans granted so far (loan ids start at 1)
    mapping(address => Merchant) private merchants;

    bool private locked; // Reentrancy guard

    error NotOwner();
    error NotPendingOwner();
    error Reentrancy();
    error Paused();
    error ZeroAddress();
    error ZeroAmount();
    error RetentionOutOfRange();
    error RateAboveMaximum(uint16 maximum);
    error InvalidLimits();
    error InsufficientTreasury();
    error TransferFailed();
    error OutstandingLoan();
    error NoOutstandingLoan();
    error MerchantFrozen();
    error AboveCreditLimit(uint256 limit);
    error SelfPayment();
    error SaleBelowMinimum(uint256 minimum);

    event TreasuryFunded(address indexed from, uint256 amount);
    event CreditGranted(address indexed merchant, uint64 indexed loanId, uint256 amount, uint16 retentionBps, uint16 annualRateBps);
    event SaleProcessed(address indexed merchant, address indexed payer, uint256 amount, uint256 retained, uint256 netToMerchant);
    event DirectRepayment(address indexed merchant, uint64 indexed loanId, uint256 amount, uint256 remaining);
    event CreditFullyRepaid(address indexed merchant, uint64 indexed loanId, uint256 principal, uint256 interest, uint256 newCreditLine);
    event CreditWrittenOff(address indexed merchant, uint64 indexed loanId, uint256 amount);
    event RetentionUpdated(address indexed merchant, uint16 retentionBps);
    event MerchantFrozenSet(address indexed merchant, bool frozen);
    event CreditLineSet(address indexed merchant, uint256 creditLine);
    event LimitsUpdated(uint256 firstLoanCap, uint256 maxLoanCap, uint256 minSaleAmount, uint16 maxAnnualRateBps);
    event PausedSet(bool paused);
    event TreasuryWithdrawn(address indexed to, uint256 amount);
    event TreasurySynced(uint256 amount);
    event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier nonReentrant() {
        if (locked) revert Reentrancy();
        locked = true;
        _;
        locked = false;
    }

    modifier whenNotPaused() {
        if (paused) revert Paused();
        _;
    }

    /// @param _firstLoanCap Maximum first loan per merchant (in wei)
    /// @param _maxLoanCap Maximum amount of any loan (in wei)
    /// @param _minSaleAmount Smallest accepted sale (in wei, at least 10000 so retention never rounds to 0)
    /// @param _maxAnnualRateBps Highest annual interest rate allowed, in basis points
    constructor(uint256 _firstLoanCap, uint256 _maxLoanCap, uint256 _minSaleAmount, uint16 _maxAnnualRateBps) payable {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
        _setLimits(_firstLoanCap, _maxLoanCap, _minSaleAmount, _maxAnnualRateBps);
        if (msg.value > 0) {
            treasury = msg.value;
            emit TreasuryFunded(msg.sender, msg.value);
        }
    }

    // ---------------------------------------------------------------- views

    /// @notice Full record of a merchant.
    function getMerchant(address merchant) external view returns (Merchant memory) {
        return merchants[merchant];
    }

    /// @notice Debt right now, including interest accrued since the last update.
    function currentDebt(address merchant) public view returns (uint256) {
        Merchant storage m = merchants[merchant];
        return m.creditBalance + _pendingInterest(m);
    }

    /// @notice Largest loan this merchant can receive now (credit ladder).
    function creditLimit(address merchant) public view returns (uint256) {
        Merchant storage m = merchants[merchant];
        if (m.creditBalance > 0 || m.frozen) return 0; // must finish the current loan first
        uint256 limit = (m.loansRepaid == 0 && m.loansWrittenOff == 0) ? firstLoanCap : m.creditLine;
        return limit < maxLoanCap ? limit : maxLoanCap;
    }

    /// @notice Split of a sale of `amount` right now: retained for the loan and net to the merchant.
    function previewSale(address merchant, uint256 amount)
        external
        view
        returns (uint256 retained, uint256 netToMerchant)
    {
        Merchant storage m = merchants[merchant];
        if (!m.frozen && m.creditBalance > 0) {
            retained = (amount * m.retentionBps) / BPS_BASE;
            uint256 debt = m.creditBalance + _pendingInterest(m);
            if (retained > debt) retained = debt;
        }
        netToMerchant = amount - retained;
    }

    /// @notice Repayment progress of the current loan (principal + interest), in basis points.
    function repaymentProgressBps(address merchant) external view returns (uint256) {
        Merchant storage m = merchants[merchant];
        uint256 total = m.loanRepaid + m.creditBalance + _pendingInterest(m);
        if (total == 0) return 0;
        return (m.loanRepaid * BPS_BASE) / total;
    }

    // ---------------------------------------------------------------- lending

    function fundTreasury() external payable {
        if (msg.value == 0) revert ZeroAmount();
        treasury += msg.value;
        emit TreasuryFunded(msg.sender, msg.value);
    }

    function grantCredit(address merchant, uint256 amount, uint16 retentionBps, uint16 annualRateBps)
        external
        onlyOwner
        nonReentrant
        whenNotPaused
    {
        if (merchant == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        if (retentionBps == 0 || retentionBps > MAX_RETENTION_BPS) revert RetentionOutOfRange();
        if (annualRateBps > maxAnnualRateBps) revert RateAboveMaximum(maxAnnualRateBps);
        if (treasury < amount) revert InsufficientTreasury();

        Merchant storage m = merchants[merchant];
        if (m.frozen) revert MerchantFrozen();
        if (m.creditBalance > 0) revert OutstandingLoan();
        uint256 limit = creditLimit(merchant);
        if (amount > limit) revert AboveCreditLimit(limit);

        uint64 id = ++loanCount;
        m.creditBalance = amount;
        m.currentLoan = amount;
        m.loanInterest = 0;
        m.loanRepaid = 0;
        m.repaidFromSales = 0;
        m.totalGranted += amount;
        m.loanId = id;
        m.loanGrantedAt = uint40(block.timestamp);
        m.lastAccrualAt = uint40(block.timestamp);
        m.retentionBps = retentionBps;
        m.annualRateBps = annualRateBps;
        treasury -= amount;

        (bool ok, ) = payable(merchant).call{value: amount}("");
        if (!ok) revert TransferFailed();

        emit CreditGranted(merchant, id, amount, retentionBps, annualRateBps);
    }

    // ---------------------------------------------------------------- repayment

    function processSale(address merchant) external payable nonReentrant whenNotPaused {
        if (merchant == address(0)) revert ZeroAddress();
        if (msg.value < minSaleAmount) revert SaleBelowMinimum(minSaleAmount);
        if (msg.sender == merchant) revert SelfPayment();

        Merchant storage m = merchants[merchant];
        uint256 retained = 0;

        if (!m.frozen && m.creditBalance > 0) {
            _accrue(m);
            retained = (msg.value * m.retentionBps) / BPS_BASE;
            if (retained > m.creditBalance) retained = m.creditBalance;
            m.repaidFromSales += retained;
            _applyRepayment(merchant, m, retained);
        }
        m.salesCount += 1;

        uint256 net = msg.value - retained;
        (bool ok, ) = payable(merchant).call{value: net}("");
        if (!ok) revert TransferFailed();

        emit SaleProcessed(merchant, msg.sender, msg.value, retained, net);
    }

    /// @notice The merchant prepays their own loan directly, for example with cash sales.
    ///         It lowers the debt and the interest that follows, and counts as repayment
    ///         history, but not as a sale and not toward a bigger line. Works while paused or
    ///         frozen, so a merchant can always pay. Any amount above the debt is returned.
    function repay() external payable nonReentrant {
        if (msg.value == 0) revert ZeroAmount();
        Merchant storage m = merchants[msg.sender];
        if (m.creditBalance == 0) revert NoOutstandingLoan();

        _accrue(m);
        uint256 applied = msg.value > m.creditBalance ? m.creditBalance : msg.value;
        _applyRepayment(msg.sender, m, applied);
        emit DirectRepayment(msg.sender, m.loanId, applied, m.creditBalance);

        uint256 refund = msg.value - applied;
        if (refund > 0) {
            (bool ok, ) = payable(msg.sender).call{value: refund}("");
            if (!ok) revert TransferFailed();
        }
    }

    // ---------------------------------------------------------------- lender tools

    /// @notice Closes an unrecoverable loan as a loss. The merchant loses their credit line
    ///         until the lender sets a new one with `setCreditLine`.
    function writeOff(address merchant) external onlyOwner {
        Merchant storage m = merchants[merchant];
        if (m.creditBalance == 0) revert NoOutstandingLoan();
        _accrue(m);
        uint256 amount = m.creditBalance;
        m.creditBalance = 0;
        m.totalWrittenOff += amount;
        m.loansWrittenOff += 1;
        m.creditLine = 0;
        emit CreditWrittenOff(merchant, m.loanId, amount);
    }

    /// @notice Freezing stops retention and new loans (e.g. during a dispute). Prepayments still work.
    function setMerchantFrozen(address merchant, bool frozen) external onlyOwner {
        Merchant storage m = merchants[merchant];
        if (m.creditBalance > 0) _accrue(m);
        m.frozen = frozen;
        emit MerchantFrozenSet(merchant, frozen);
    }

    /// @notice Lender override of the earned line (e.g. after a review or a write-off).
    function setCreditLine(address merchant, uint256 creditLine) external onlyOwner {
        merchants[merchant].creditLine = creditLine;
        emit CreditLineSet(merchant, creditLine);
    }

    function setRetention(address merchant, uint16 retentionBps) external onlyOwner {
        if (retentionBps == 0 || retentionBps > MAX_RETENTION_BPS) revert RetentionOutOfRange();
        if (merchants[merchant].creditBalance == 0) revert NoOutstandingLoan();
        merchants[merchant].retentionBps = retentionBps;
        emit RetentionUpdated(merchant, retentionBps);
    }

    function setLimits(uint256 _firstLoanCap, uint256 _maxLoanCap, uint256 _minSaleAmount, uint16 _maxAnnualRateBps)
        external
        onlyOwner
    {
        _setLimits(_firstLoanCap, _maxLoanCap, _minSaleAmount, _maxAnnualRateBps);
    }

    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
        emit PausedSet(_paused);
    }

    function withdrawTreasury(address payable to, uint256 amount) external onlyOwner nonReentrant {
        if (to == address(0)) revert ZeroAddress();
        if (amount > treasury) revert InsufficientTreasury();
        treasury -= amount;
        (bool ok, ) = to.call{value: amount}("");
        if (!ok) revert TransferFailed();
        emit TreasuryWithdrawn(to, amount);
    }

    /// @notice Adds to the treasury any balance that arrived without going through it.
    function syncTreasury() external onlyOwner {
        uint256 extra = address(this).balance - treasury;
        treasury += extra;
        emit TreasurySynced(extra);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        pendingOwner = newOwner;
        emit OwnershipTransferStarted(owner, newOwner);
    }

    function acceptOwnership() external {
        if (msg.sender != pendingOwner) revert NotPendingOwner();
        emit OwnershipTransferred(owner, msg.sender);
        owner = msg.sender;
        pendingOwner = address(0);
    }

    // ---------------------------------------------------------------- internal

    function _pendingInterest(Merchant storage m) private view returns (uint256) {
        if (m.creditBalance == 0 || m.annualRateBps == 0) return 0;
        uint256 elapsed = block.timestamp - m.lastAccrualAt;
        return (m.creditBalance * m.annualRateBps * elapsed) / (uint256(BPS_BASE) * YEAR);
    }

    function _accrue(Merchant storage m) private {
        uint256 interest = _pendingInterest(m);
        if (interest > 0) {
            m.creditBalance += interest;
            m.loanInterest += interest;
            m.totalInterest += interest;
        }
        m.lastAccrualAt = uint40(block.timestamp);
    }

    function _applyRepayment(address merchant, Merchant storage m, uint256 amount) private {
        if (amount == 0) return;
        m.creditBalance -= amount;
        m.loanRepaid += amount;
        m.totalRepaid += amount;
        m.lastRepaymentAt = uint40(block.timestamp);
        treasury += amount;

        if (m.creditBalance == 0) {
            m.loansRepaid += 1;
            // Ladder: grow only with sales-backed repayment, capped at +50% of the loan.
            uint256 backed = m.repaidFromSales < m.currentLoan ? m.repaidFromSales : m.currentLoan;
            uint256 earned = m.currentLoan + (backed * LADDER_GROWTH_BPS) / BPS_BASE;
            if (earned > m.creditLine) m.creditLine = earned;
            emit CreditFullyRepaid(merchant, m.loanId, m.currentLoan, m.loanInterest, m.creditLine);
        }
    }

    function _setLimits(uint256 _firstLoanCap, uint256 _maxLoanCap, uint256 _minSaleAmount, uint16 _maxAnnualRateBps)
        private
    {
        if (_firstLoanCap == 0 || _maxLoanCap < _firstLoanCap || _minSaleAmount < BPS_BASE) revert InvalidLimits();
        firstLoanCap = _firstLoanCap;
        maxLoanCap = _maxLoanCap;
        minSaleAmount = _minSaleAmount;
        maxAnnualRateBps = _maxAnnualRateBps;
        emit LimitsUpdated(_firstLoanCap, _maxLoanCap, _minSaleAmount, _maxAnnualRateBps);
    }
}
