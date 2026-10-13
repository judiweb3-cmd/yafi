// SPDX-License-Identifier: MIT
// YAFI - Behavioral microcredit repaid automatically from every sale.
// The YAFI name and brand are reserved; the code is released under the MIT license.
pragma solidity ^0.8.24;

/// @title YafiCreditEscrowV2
/// @notice Every QR sale goes through this contract: an agreed % is retained to repay the
///         merchant's microloan and the rest is paid to the merchant instantly.
/// @dev V2 adds three risk controls taken from traditional microfinance, enforced by code:
///      1. Credit ladder: a first loan is capped, and a new loan is only possible after the
///         previous one is fully repaid, up to 150% of it.
///      2. No self-payment: a merchant cannot pay their own sales to inflate their history.
///      3. Minimum sale: dust sales cannot inflate the sales count.
contract YafiCreditEscrowV2 {
    struct Merchant {
        uint256 creditBalance; // Outstanding debt of the current loan
        uint256 currentLoan;   // Principal of the current (or last) loan
        uint256 totalGranted;  // Total disbursed over time
        uint256 totalRepaid;   // Total repaid over time (behavioral score input)
        uint256 salesCount;    // Sales processed through YAFI
        uint32 loansRepaid;    // Loans fully repaid (step on the credit ladder)
        uint16 retentionBps;   // Retention per sale in basis points: 1000 = 10%
        bool isActive;         // Credit line currently open
    }

    uint16 public constant MAX_RETENTION_BPS = 3000; // 30% cap
    uint16 public constant LADDER_STEP_BPS = 15000;  // Next loan up to 150% of the last one
    uint16 private constant BPS_BASE = 10000;

    address public owner;         // Lender / administrator
    uint256 public treasury;      // Funds available to lend
    uint256 public firstLoanCap;  // Maximum amount of a merchant's first loan
    uint256 public minSaleAmount; // Smallest sale that counts (anti-dust)
    mapping(address => Merchant) public merchants;

    bool private locked; // Reentrancy guard

    error NotOwner();
    error Reentrancy();
    error ZeroAddress();
    error ZeroAmount();
    error RetentionOutOfRange();
    error InsufficientTreasury();
    error TransferFailed();
    error OutstandingLoan();
    error AboveCreditLimit(uint256 limit);
    error SelfPayment();
    error SaleBelowMinimum(uint256 minimum);

    event TreasuryFunded(address indexed from, uint256 amount);
    event CreditGranted(address indexed merchant, uint256 amount, uint16 retentionBps);
    event SaleProcessed(address indexed merchant, address indexed payer, uint256 amount, uint256 retained, uint256 netToMerchant);
    event CreditFullyRepaid(address indexed merchant, uint256 totalRepaid);
    event RetentionUpdated(address indexed merchant, uint16 retentionBps);
    event MerchantStatusChanged(address indexed merchant, bool isActive);
    event LimitsUpdated(uint256 firstLoanCap, uint256 minSaleAmount);
    event TreasuryWithdrawn(address indexed to, uint256 amount);
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

    /// @param _firstLoanCap Maximum first loan per merchant (in wei)
    /// @param _minSaleAmount Smallest accepted sale (in wei)
    constructor(uint256 _firstLoanCap, uint256 _minSaleAmount) payable {
        if (_firstLoanCap == 0 || _minSaleAmount == 0) revert ZeroAmount();
        owner = msg.sender;
        firstLoanCap = _firstLoanCap;
        minSaleAmount = _minSaleAmount;
        emit LimitsUpdated(_firstLoanCap, _minSaleAmount);
        if (msg.value > 0) {
            treasury = msg.value;
            emit TreasuryFunded(msg.sender, msg.value);
        }
    }

    function fundTreasury() external payable {
        if (msg.value == 0) revert ZeroAmount();
        treasury += msg.value;
        emit TreasuryFunded(msg.sender, msg.value);
    }

    /// @notice Largest loan this merchant can receive now (credit ladder).
    function creditLimit(address merchant) public view returns (uint256) {
        Merchant storage m = merchants[merchant];
        if (m.creditBalance > 0) return 0; // must finish the current loan first
        if (m.loansRepaid == 0) return firstLoanCap;
        return (m.currentLoan * LADDER_STEP_BPS) / BPS_BASE;
    }

    function grantCredit(address merchant, uint256 amount, uint16 retentionBps)
        external
        onlyOwner
        nonReentrant
    {
        if (merchant == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        if (retentionBps == 0 || retentionBps > MAX_RETENTION_BPS) revert RetentionOutOfRange();
        if (treasury < amount) revert InsufficientTreasury();

        Merchant storage m = merchants[merchant];
        if (m.creditBalance > 0) revert OutstandingLoan();
        uint256 limit = creditLimit(merchant);
        if (amount > limit) revert AboveCreditLimit(limit);

        m.creditBalance = amount;
        m.currentLoan = amount;
        m.totalGranted += amount;
        m.retentionBps = retentionBps;
        m.isActive = true;
        treasury -= amount;

        (bool ok, ) = payable(merchant).call{value: amount}("");
        if (!ok) revert TransferFailed();

        emit CreditGranted(merchant, amount, retentionBps);
    }

    function processSale(address merchant) external payable nonReentrant {
        if (merchant == address(0)) revert ZeroAddress();
        if (msg.value < minSaleAmount) revert SaleBelowMinimum(minSaleAmount);
        if (msg.sender == merchant) revert SelfPayment();

        Merchant storage m = merchants[merchant];
        uint256 retained = 0;

        if (m.isActive && m.creditBalance > 0) {
            retained = (msg.value * m.retentionBps) / BPS_BASE;
            if (retained > m.creditBalance) {
                retained = m.creditBalance;
            }
            m.creditBalance -= retained;
            m.totalRepaid += retained;
            treasury += retained;

            if (m.creditBalance == 0) {
                m.isActive = false;
                m.loansRepaid += 1;
                emit CreditFullyRepaid(merchant, m.totalRepaid);
            }
        }
        m.salesCount += 1;

        uint256 net = msg.value - retained;
        (bool ok, ) = payable(merchant).call{value: net}("");
        if (!ok) revert TransferFailed();

        emit SaleProcessed(merchant, msg.sender, msg.value, retained, net);
    }

    function setRetention(address merchant, uint16 retentionBps) external onlyOwner {
        if (retentionBps == 0 || retentionBps > MAX_RETENTION_BPS) revert RetentionOutOfRange();
        merchants[merchant].retentionBps = retentionBps;
        emit RetentionUpdated(merchant, retentionBps);
    }

    function setMerchantActive(address merchant, bool active) external onlyOwner {
        merchants[merchant].isActive = active;
        emit MerchantStatusChanged(merchant, active);
    }

    function setLimits(uint256 _firstLoanCap, uint256 _minSaleAmount) external onlyOwner {
        if (_firstLoanCap == 0 || _minSaleAmount == 0) revert ZeroAmount();
        firstLoanCap = _firstLoanCap;
        minSaleAmount = _minSaleAmount;
        emit LimitsUpdated(_firstLoanCap, _minSaleAmount);
    }

    function withdrawTreasury(address payable to, uint256 amount) external onlyOwner nonReentrant {
        if (to == address(0)) revert ZeroAddress();
        if (amount > treasury) revert InsufficientTreasury();
        treasury -= amount;
        (bool ok, ) = to.call{value: amount}("");
        if (!ok) revert TransferFailed();
        emit TreasuryWithdrawn(to, amount);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function previewSale(address merchant, uint256 amount)
        external
        view
        returns (uint256 retained, uint256 netToMerchant)
    {
        Merchant storage m = merchants[merchant];
        if (m.isActive && m.creditBalance > 0) {
            retained = (amount * m.retentionBps) / BPS_BASE;
            if (retained > m.creditBalance) retained = m.creditBalance;
        }
        netToMerchant = amount - retained;
    }

    /// @notice Repayment progress of the current loan, in basis points (10000 = 100%).
    function repaymentProgressBps(address merchant) external view returns (uint256) {
        Merchant storage m = merchants[merchant];
        if (m.currentLoan == 0) return 0;
        return ((m.currentLoan - m.creditBalance) * BPS_BASE) / m.currentLoan;
    }
}
