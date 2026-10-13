// SPDX-License-Identifier: MIT
// YAFI - Microcreditos conductuales con retencion automatica por ventas.
// La marca YAFI esta reservada; el codigo se publica bajo licencia MIT.
pragma solidity ^0.8.24;

/// @title YafiCreditEscrow
/// @notice Cada venta por QR pasa por este contrato: se retiene un % para
///         amortizar el microcredito del comerciante y el neto se le abona al instante.
contract YafiCreditEscrow {
    struct Merchant {
        uint256 creditBalance;   // Saldo deudor pendiente
        uint256 totalGranted;    // Total desembolsado historico
        uint256 totalRepaid;     // Total amortizado historico (base del scoring)
        uint256 salesCount;      // Numero de ventas procesadas
        uint16 retentionBps;     // % de retencion en puntos basicos: 500 = 5%
        bool isActive;           // Linea de credito vigente
    }

    uint16 public constant MAX_RETENTION_BPS = 3000; // Tope del 30%
    uint16 private constant BPS_BASE = 10000;

    address public owner;        // Administrador del credito
    uint256 public treasury;     // Caja disponible para desembolsar
    mapping(address => Merchant) public merchants;

    bool private locked;         // Candado anti-reentrada

    event TreasuryFunded(address indexed from, uint256 amount);
    event CreditGranted(address indexed merchant, uint256 amount, uint16 retentionBps);
    event SaleProcessed(address indexed merchant, address indexed payer, uint256 amount, uint256 retained, uint256 netToMerchant);
    event CreditFullyRepaid(address indexed merchant, uint256 totalRepaid);
    event RetentionUpdated(address indexed merchant, uint16 retentionBps);
    event MerchantStatusChanged(address indexed merchant, bool isActive);
    event TreasuryWithdrawn(address indexed to, uint256 amount);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() {
        require(msg.sender == owner, "YAFI: solo administrador");
        _;
    }

    modifier nonReentrant() {
        require(!locked, "YAFI: operacion en curso");
        locked = true;
        _;
        locked = false;
    }

    constructor() payable {
        owner = msg.sender;
        if (msg.value > 0) {
            treasury = msg.value;
            emit TreasuryFunded(msg.sender, msg.value);
        }
    }

    function fundTreasury() external payable {
        require(msg.value > 0, "YAFI: monto cero");
        treasury += msg.value;
        emit TreasuryFunded(msg.sender, msg.value);
    }

    function grantCredit(address merchant, uint256 amount, uint16 retentionBps)
        external
        onlyOwner
        nonReentrant
    {
        require(merchant != address(0), "YAFI: comerciante invalido");
        require(amount > 0, "YAFI: monto cero");
        require(retentionBps > 0 && retentionBps <= MAX_RETENTION_BPS, "YAFI: retencion fuera de rango");
        require(treasury >= amount, "YAFI: caja insuficiente");

        Merchant storage m = merchants[merchant];
        m.creditBalance += amount;
        m.totalGranted += amount;
        m.retentionBps = retentionBps;
        m.isActive = true;
        treasury -= amount;

        (bool ok, ) = payable(merchant).call{value: amount}("");
        require(ok, "YAFI: desembolso fallido");

        emit CreditGranted(merchant, amount, retentionBps);
    }

    function processSale(address merchant) external payable nonReentrant {
        require(merchant != address(0), "YAFI: comerciante invalido");
        require(msg.value > 0, "YAFI: monto cero");

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
                emit CreditFullyRepaid(merchant, m.totalRepaid);
            }
        }
        m.salesCount += 1;

        uint256 net = msg.value - retained;
        (bool ok, ) = payable(merchant).call{value: net}("");
        require(ok, "YAFI: abono al comerciante fallido");

        emit SaleProcessed(merchant, msg.sender, msg.value, retained, net);
    }

    function setRetention(address merchant, uint16 retentionBps) external onlyOwner {
        require(retentionBps > 0 && retentionBps <= MAX_RETENTION_BPS, "YAFI: retencion fuera de rango");
        merchants[merchant].retentionBps = retentionBps;
        emit RetentionUpdated(merchant, retentionBps);
    }

    function setMerchantActive(address merchant, bool active) external onlyOwner {
        merchants[merchant].isActive = active;
        emit MerchantStatusChanged(merchant, active);
    }

    function withdrawTreasury(address payable to, uint256 amount) external onlyOwner nonReentrant {
        require(to != address(0), "YAFI: destino invalido");
        require(amount <= treasury, "YAFI: caja insuficiente");
        treasury -= amount;
        (bool ok, ) = to.call{value: amount}("");
        require(ok, "YAFI: retiro fallido");
        emit TreasuryWithdrawn(to, amount);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "YAFI: nuevo admin invalido");
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

    function repaymentProgressBps(address merchant) external view returns (uint256) {
        Merchant storage m = merchants[merchant];
        if (m.totalGranted == 0) return 0;
        return (m.totalRepaid * BPS_BASE) / m.totalGranted;
    }
}
