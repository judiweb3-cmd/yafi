const { expect } = require("chai");
const { ethers } = require("hardhat");

const E = ethers.parseEther;
const FIRST_CAP = E("0.5"); // S/ 500 at the demo rate
const MIN_SALE = E("0.001"); // S/ 1 at the demo rate

describe("YafiCreditEscrowV2", function () {
  let yafi, admin, merchant, customer, stranger;

  beforeEach(async function () {
    [admin, merchant, customer, stranger] = await ethers.getSigners();
    yafi = await ethers.deployContract("YafiCreditEscrowV2", [FIRST_CAP, MIN_SALE], { value: E("10") });
    await yafi.waitForDeployment();
  });

  // Pays sales of `amount` until the merchant's current loan is fully repaid.
  async function repayFully(amount) {
    while ((await yafi.merchants(merchant.address)).creditBalance > 0n) {
      await yafi.connect(customer).processSale(merchant.address, { value: amount });
    }
  }

  describe("Deployment and limits", function () {
    it("stores the owner, treasury and risk limits", async function () {
      expect(await yafi.owner()).to.equal(admin.address);
      expect(await yafi.treasury()).to.equal(E("10"));
      expect(await yafi.firstLoanCap()).to.equal(FIRST_CAP);
      expect(await yafi.minSaleAmount()).to.equal(MIN_SALE);
    });

    it("rejects zero limits", async function () {
      const F = await ethers.getContractFactory("YafiCreditEscrowV2");
      await expect(F.deploy(0, MIN_SALE)).to.be.revertedWithCustomError(F, "ZeroAmount");
      await expect(F.deploy(FIRST_CAP, 0)).to.be.revertedWithCustomError(F, "ZeroAmount");
    });

    it("only the owner can change limits", async function () {
      await expect(yafi.connect(stranger).setLimits(E("1"), MIN_SALE))
        .to.be.revertedWithCustomError(yafi, "NotOwner");
      await expect(yafi.setLimits(E("1"), E("0.002")))
        .to.emit(yafi, "LimitsUpdated").withArgs(E("1"), E("0.002"));
      expect(await yafi.firstLoanCap()).to.equal(E("1"));
    });
  });

  describe("Rule 1: credit ladder", function () {
    it("caps the first loan", async function () {
      expect(await yafi.creditLimit(merchant.address)).to.equal(FIRST_CAP);
      await expect(yafi.grantCredit(merchant.address, E("0.6"), 1000))
        .to.be.revertedWithCustomError(yafi, "AboveCreditLimit").withArgs(FIRST_CAP);
      await expect(yafi.grantCredit(merchant.address, FIRST_CAP, 1000))
        .to.changeEtherBalances([yafi, merchant], [-FIRST_CAP, FIRST_CAP]);
    });

    it("blocks a new loan while one is outstanding", async function () {
      await yafi.grantCredit(merchant.address, E("0.2"), 1000);
      expect(await yafi.creditLimit(merchant.address)).to.equal(0);
      await expect(yafi.grantCredit(merchant.address, E("0.1"), 1000))
        .to.be.revertedWithCustomError(yafi, "OutstandingLoan");
    });

    it("allows up to 150% of the last loan after full repayment", async function () {
      await yafi.grantCredit(merchant.address, E("0.2"), 3000);
      await repayFully(E("0.1"));

      const m = await yafi.merchants(merchant.address);
      expect(m.loansRepaid).to.equal(1);
      expect(m.isActive).to.equal(false);
      expect(await yafi.creditLimit(merchant.address)).to.equal(E("0.3"));

      await expect(yafi.grantCredit(merchant.address, E("0.31"), 1000))
        .to.be.revertedWithCustomError(yafi, "AboveCreditLimit").withArgs(E("0.3"));
      await yafi.grantCredit(merchant.address, E("0.3"), 1000);
      expect((await yafi.merchants(merchant.address)).currentLoan).to.equal(E("0.3"));
    });

    it("measures repayment progress on the current loan only", async function () {
      await yafi.grantCredit(merchant.address, E("0.2"), 3000);
      await repayFully(E("0.1"));
      expect(await yafi.repaymentProgressBps(merchant.address)).to.equal(10000);

      await yafi.grantCredit(merchant.address, E("0.3"), 1000);
      expect(await yafi.repaymentProgressBps(merchant.address)).to.equal(0);

      await yafi.connect(customer).processSale(merchant.address, { value: E("0.3") }); // repays 0.03
      expect(await yafi.repaymentProgressBps(merchant.address)).to.equal(1000); // 10%

      const m = await yafi.merchants(merchant.address);
      expect(m.totalGranted).to.equal(E("0.5"));
      expect(m.totalRepaid).to.equal(E("0.23"));
    });
  });

  describe("Rule 2: no self-payment", function () {
    it("rejects a merchant paying their own sale", async function () {
      await yafi.grantCredit(merchant.address, E("0.2"), 1000);
      await expect(yafi.connect(merchant).processSale(merchant.address, { value: E("0.01") }))
        .to.be.revertedWithCustomError(yafi, "SelfPayment");
      expect((await yafi.merchants(merchant.address)).salesCount).to.equal(0);
    });
  });

  describe("Direct repayment (e.g. cash sales)", function () {
    beforeEach(async function () {
      await yafi.grantCredit(merchant.address, E("0.2"), 1000);
    });

    it("lowers the debt and counts as repayment, but not as a sale", async function () {
      await expect(yafi.connect(merchant).repay({ value: E("0.05") }))
        .to.emit(yafi, "DirectRepayment").withArgs(merchant.address, E("0.05"));
      const m = await yafi.merchants(merchant.address);
      expect(m.creditBalance).to.equal(E("0.15"));
      expect(m.totalRepaid).to.equal(E("0.05"));
      expect(m.salesCount).to.equal(0);
      expect(await yafi.treasury()).to.equal(E("9.85"));
    });

    it("returns any amount above the debt and closes the loan", async function () {
      const tx = yafi.connect(merchant).repay({ value: E("0.5") });
      await expect(tx).to.changeEtherBalances([merchant, yafi], [E("-0.2"), E("0.2")]);
      await expect(tx).to.emit(yafi, "CreditFullyRepaid");
      const m = await yafi.merchants(merchant.address);
      expect(m.creditBalance).to.equal(0);
      expect(m.loansRepaid).to.equal(1);
      expect(m.salesCount).to.equal(0);
      expect(await yafi.creditLimit(merchant.address)).to.equal(E("0.3"));
    });

    it("rejects a repayment with no loan or no value", async function () {
      await expect(yafi.connect(stranger).repay({ value: E("0.01") }))
        .to.be.revertedWithCustomError(yafi, "NoOutstandingLoan");
      await expect(yafi.connect(merchant).repay({ value: 0 }))
        .to.be.revertedWithCustomError(yafi, "ZeroAmount");
    });
  });

  describe("Rule 3: minimum sale", function () {
    it("rejects sales below the minimum, including zero", async function () {
      await expect(yafi.connect(customer).processSale(merchant.address, { value: MIN_SALE - 1n }))
        .to.be.revertedWithCustomError(yafi, "SaleBelowMinimum").withArgs(MIN_SALE);
      await expect(yafi.connect(customer).processSale(merchant.address, { value: 0 }))
        .to.be.revertedWithCustomError(yafi, "SaleBelowMinimum");
    });

    it("accepts a sale equal to the minimum", async function () {
      await yafi.connect(customer).processSale(merchant.address, { value: MIN_SALE });
      expect((await yafi.merchants(merchant.address)).salesCount).to.equal(1);
    });
  });

  describe("Automatic repayment from sales", function () {
    beforeEach(async function () {
      await yafi.grantCredit(merchant.address, E("0.5"), 1000); // 10% retention
    });

    it("splits the sale: 90% to the merchant, 10% to the treasury", async function () {
      const tx = yafi.connect(customer).processSale(merchant.address, { value: E("0.1") });
      await expect(tx).to.changeEtherBalances([customer, merchant, yafi], [E("-0.1"), E("0.09"), E("0.01")]);
      await expect(tx).to.emit(yafi, "SaleProcessed")
        .withArgs(merchant.address, customer.address, E("0.1"), E("0.01"), E("0.09"));

      const m = await yafi.merchants(merchant.address);
      expect(m.creditBalance).to.equal(E("0.49"));
      expect(m.salesCount).to.equal(1);
    });

    it("previewSale matches the real split", async function () {
      const [retained, net] = await yafi.previewSale(merchant.address, E("0.1"));
      expect(retained).to.equal(E("0.01"));
      expect(net).to.equal(E("0.09"));
    });

    it("never retains more than the outstanding debt and closes the line", async function () {
      await yafi.setRetention(merchant.address, 3000);
      await yafi.connect(customer).processSale(merchant.address, { value: E("1.6") }); // retains 0.48
      const tx = yafi.connect(customer).processSale(merchant.address, { value: E("1") });
      await expect(tx).to.changeEtherBalances([merchant, yafi], [E("0.98"), E("0.02")]);
      await expect(tx).to.emit(yafi, "CreditFullyRepaid");

      const m = await yafi.merchants(merchant.address);
      expect(m.creditBalance).to.equal(0);
      expect(m.isActive).to.equal(false);
      expect(m.loansRepaid).to.equal(1);
    });

    it("a frozen line does not retain", async function () {
      await yafi.setMerchantActive(merchant.address, false);
      await expect(yafi.connect(customer).processSale(merchant.address, { value: E("0.1") }))
        .to.changeEtherBalance(merchant, E("0.1"));
    });
  });

  describe("Admin controls", function () {
    it("rejects retention outside 0.01%-30%", async function () {
      await expect(yafi.grantCredit(merchant.address, E("0.1"), 0))
        .to.be.revertedWithCustomError(yafi, "RetentionOutOfRange");
      await expect(yafi.grantCredit(merchant.address, E("0.1"), 3001))
        .to.be.revertedWithCustomError(yafi, "RetentionOutOfRange");
    });

    it("never lends more than the treasury holds", async function () {
      await yafi.setLimits(E("100"), MIN_SALE);
      await expect(yafi.grantCredit(merchant.address, E("11"), 1000))
        .to.be.revertedWithCustomError(yafi, "InsufficientTreasury");
    });

    it("only the owner can lend, withdraw or transfer ownership", async function () {
      await expect(yafi.connect(stranger).grantCredit(stranger.address, E("0.1"), 1000))
        .to.be.revertedWithCustomError(yafi, "NotOwner");
      await expect(yafi.connect(stranger).withdrawTreasury(stranger.address, 1))
        .to.be.revertedWithCustomError(yafi, "NotOwner");
      await expect(yafi.connect(stranger).transferOwnership(stranger.address))
        .to.be.revertedWithCustomError(yafi, "NotOwner");
    });

    it("withdraws treasury funds but not more than available", async function () {
      await expect(yafi.withdrawTreasury(admin.address, E("11")))
        .to.be.revertedWithCustomError(yafi, "InsufficientTreasury");
      await expect(yafi.withdrawTreasury(stranger.address, E("1")))
        .to.changeEtherBalance(stranger, E("1"));
      expect(await yafi.treasury()).to.equal(E("9"));
    });
  });
});
