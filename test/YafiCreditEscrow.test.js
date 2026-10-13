const { expect } = require("chai");
const { ethers } = require("hardhat");

const E = ethers.parseEther;

describe("YafiCreditEscrow", function () {
  let yafi, admin, merchant, customer, stranger;

  beforeEach(async function () {
    [admin, merchant, customer, stranger] = await ethers.getSigners();
    yafi = await ethers.deployContract("YafiCreditEscrow", { value: E("10") });
    await yafi.waitForDeployment();
  });

  describe("Treasury funding", function () {
    it("records the initial capital sent at deployment", async function () {
      expect(await yafi.treasury()).to.equal(E("10"));
      expect(await yafi.owner()).to.equal(admin.address);
    });

    it("accepts additional funding", async function () {
      await yafi.connect(stranger).fundTreasury({ value: E("2") });
      expect(await yafi.treasury()).to.equal(E("12"));
    });
  });

  describe("Granting credit", function () {
    it("disburses the loan to the merchant and records the debt", async function () {
      await expect(yafi.grantCredit(merchant.address, E("1"), 1000))
        .to.changeEtherBalances([yafi, merchant], [E("-1"), E("1")]);

      const m = await yafi.merchants(merchant.address);
      expect(m.creditBalance).to.equal(E("1"));
      expect(m.retentionBps).to.equal(1000);
      expect(m.isActive).to.equal(true);
      expect(await yafi.treasury()).to.equal(E("9"));
    });

    it("only the admin can grant credit", async function () {
      await expect(
        yafi.connect(stranger).grantCredit(stranger.address, E("1"), 500)
      ).to.be.revertedWith("YAFI: solo administrador");
    });

    it("rejects retention above the 30% cap", async function () {
      await expect(
        yafi.grantCredit(merchant.address, E("1"), 3001)
      ).to.be.revertedWith("YAFI: retencion fuera de rango");
    });

    it("never lends more than the treasury holds", async function () {
      await expect(
        yafi.grantCredit(merchant.address, E("11"), 500)
      ).to.be.revertedWith("YAFI: caja insuficiente");
    });
  });

  describe("Automatic repayment from sales", function () {
    beforeEach(async function () {
      await yafi.grantCredit(merchant.address, E("1"), 1000); // 10% retention
    });

    it("retains the agreed % and pays the net to the merchant", async function () {
      await expect(
        yafi.connect(customer).processSale(merchant.address, { value: E("2") })
      ).to.changeEtherBalances([customer, merchant, yafi], [E("-2"), E("1.8"), E("0.2")]);

      const m = await yafi.merchants(merchant.address);
      expect(m.creditBalance).to.equal(E("0.8"));
      expect(m.totalRepaid).to.equal(E("0.2"));
      expect(m.salesCount).to.equal(1);
    });

    it("never collects more than is owed and closes the line at 100%", async function () {
      await expect(
        yafi.connect(customer).processSale(merchant.address, { value: E("20") })
      ).to.emit(yafi, "CreditFullyRepaid");

      const m = await yafi.merchants(merchant.address);
      expect(m.creditBalance).to.equal(0);
      expect(m.isActive).to.equal(false);
      expect(await yafi.repaymentProgressBps(merchant.address)).to.equal(10000);
    });

    it("previewSale matches the real sale", async function () {
      const [retained, net] = await yafi.previewSale(merchant.address, E("2"));
      expect(retained).to.equal(E("0.2"));
      expect(net).to.equal(E("1.8"));
    });

    it("with no active credit, the merchant receives 100% of the sale", async function () {
      await expect(
        yafi.connect(customer).processSale(stranger.address, { value: E("1") })
      ).to.changeEtherBalance(stranger, E("1"));
    });

    it("a frozen line retains nothing", async function () {
      await yafi.setMerchantActive(merchant.address, false);
      await expect(
        yafi.connect(customer).processSale(merchant.address, { value: E("1") })
      ).to.changeEtherBalance(merchant, E("1"));
    });
  });

  describe("Treasury management", function () {
    it("the admin can withdraw from the treasury", async function () {
      await expect(yafi.withdrawTreasury(admin.address, E("3")))
        .to.changeEtherBalance(admin, E("3"));
      expect(await yafi.treasury()).to.equal(E("7"));
    });

    it("nobody else can withdraw", async function () {
      await expect(
        yafi.connect(stranger).withdrawTreasury(stranger.address, E("1"))
      ).to.be.revertedWith("YAFI: solo administrador");
    });
  });
});
