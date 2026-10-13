const { expect } = require("chai");
const { ethers, network } = require("hardhat");

const E = ethers.parseEther;
const FIRST_CAP = E("0.5");  // S/ 500 at the demo rate
const MAX_CAP = E("5");      // S/ 5,000
const MIN_SALE = E("0.001"); // S/ 1
const MAX_RATE = 7500;       // 75% a year, simple interest on the principal (6.25% a month)
const YEAR = 365 * 24 * 60 * 60;

describe("YafiCreditEscrowV2", function () {
  let yafi, admin, merchant, customer, stranger;

  beforeEach(async function () {
    [admin, merchant, customer, stranger] = await ethers.getSigners();
    yafi = await ethers.deployContract("YafiCreditEscrowV2", [FIRST_CAP, MAX_CAP, MIN_SALE, MAX_RATE], { value: E("10") });
    await yafi.waitForDeployment();
  });

  const m = (addr) => yafi.getMerchant(addr || merchant.address);
  const sale = (value) => yafi.connect(customer).processSale(merchant.address, { value });
  async function repayBySales(amount) {
    while ((await yafi.currentDebt(merchant.address)) > 0n) await sale(amount);
  }
  async function wait(seconds) {
    await network.provider.send("evm_increaseTime", [seconds]);
    await network.provider.send("evm_mine");
  }

  describe("Deployment and limits", function () {
    it("stores the owner, treasury and risk limits", async function () {
      expect(await yafi.owner()).to.equal(admin.address);
      expect(await yafi.treasury()).to.equal(E("10"));
      expect(await yafi.firstLoanCap()).to.equal(FIRST_CAP);
      expect(await yafi.maxLoanCap()).to.equal(MAX_CAP);
      expect(await yafi.minSaleAmount()).to.equal(MIN_SALE);
      expect(await yafi.maxAnnualRateBps()).to.equal(MAX_RATE);
    });

    it("rejects inconsistent limits", async function () {
      const F = await ethers.getContractFactory("YafiCreditEscrowV2");
      await expect(F.deploy(0, MAX_CAP, MIN_SALE, MAX_RATE)).to.be.revertedWithCustomError(F, "InvalidLimits");
      await expect(F.deploy(MAX_CAP, FIRST_CAP, MIN_SALE, MAX_RATE)).to.be.revertedWithCustomError(F, "InvalidLimits");
      // A minimum sale this small would let retention round down to zero
      await expect(F.deploy(FIRST_CAP, MAX_CAP, 9999, MAX_RATE)).to.be.revertedWithCustomError(F, "InvalidLimits");
    });

    it("only the owner can change limits", async function () {
      await expect(yafi.connect(stranger).setLimits(E("1"), MAX_CAP, MIN_SALE, MAX_RATE))
        .to.be.revertedWithCustomError(yafi, "NotOwner");
      await expect(yafi.setLimits(E("1"), MAX_CAP, E("0.002"), 5000))
        .to.emit(yafi, "LimitsUpdated").withArgs(E("1"), MAX_CAP, E("0.002"), 5000);
    });
  });

  describe("Rule 1: credit ladder", function () {
    it("caps the first loan", async function () {
      expect(await yafi.creditLimit(merchant.address)).to.equal(FIRST_CAP);
      await expect(yafi.grantCredit(merchant.address, E("0.6"), 1000, 0))
        .to.be.revertedWithCustomError(yafi, "AboveCreditLimit").withArgs(FIRST_CAP);
      await expect(yafi.grantCredit(merchant.address, FIRST_CAP, 1000, 0))
        .to.changeEtherBalances([yafi, merchant], [-FIRST_CAP, FIRST_CAP]);
    });

    it("blocks a new loan while one is outstanding", async function () {
      await yafi.grantCredit(merchant.address, E("0.2"), 1000, 0);
      expect(await yafi.creditLimit(merchant.address)).to.equal(0);
      await expect(yafi.grantCredit(merchant.address, E("0.1"), 1000, 0))
        .to.be.revertedWithCustomError(yafi, "OutstandingLoan");
    });

    it("allows up to 150% of the last loan when sales repaid all of it", async function () {
      await yafi.grantCredit(merchant.address, E("0.2"), 3000, 0);
      await repayBySales(E("0.1"));
      const r = await m();
      expect(r.loansRepaid).to.equal(1);
      expect(r.creditLine).to.equal(E("0.3"));
      expect(await yafi.creditLimit(merchant.address)).to.equal(E("0.3"));
      await expect(yafi.grantCredit(merchant.address, E("0.31"), 1000, 0))
        .to.be.revertedWithCustomError(yafi, "AboveCreditLimit").withArgs(E("0.3"));
      await yafi.grantCredit(merchant.address, E("0.3"), 1000, 0);
    });

    it("keeps the earned line after a smaller loan", async function () {
      await yafi.grantCredit(merchant.address, E("0.2"), 3000, 0);
      await repayBySales(E("0.1")); // line 0.3
      await yafi.grantCredit(merchant.address, E("0.01"), 3000, 0);
      await repayBySales(E("0.1"));
      expect(await yafi.creditLimit(merchant.address)).to.equal(E("0.3"));
    });

    it("never exceeds the global loan cap", async function () {
      await yafi.setLimits(E("0.2"), E("0.25"), MIN_SALE, MAX_RATE);
      await yafi.grantCredit(merchant.address, E("0.2"), 3000, 0);
      await repayBySales(E("0.1"));
      expect(await yafi.creditLimit(merchant.address)).to.equal(E("0.25"));
    });

    it("measures repayment progress on the current loan only", async function () {
      await yafi.grantCredit(merchant.address, E("0.2"), 3000, 0);
      await repayBySales(E("0.1"));
      expect(await yafi.repaymentProgressBps(merchant.address)).to.equal(10000);
      await yafi.grantCredit(merchant.address, E("0.3"), 1000, 0);
      expect(await yafi.repaymentProgressBps(merchant.address)).to.equal(0);
      await sale(E("0.3")); // repays 0.03
      expect(await yafi.repaymentProgressBps(merchant.address)).to.equal(1000);
      const r = await m();
      expect(r.totalGranted).to.equal(E("0.5"));
      expect(r.totalRepaid).to.equal(E("0.23"));
      expect(r.loanId).to.equal(2);
    });
  });

  describe("Rule 2: no self-payment, but prepayment allowed", function () {
    beforeEach(async function () {
      await yafi.grantCredit(merchant.address, E("0.2"), 1000, 0);
    });

    it("rejects a merchant paying their own QR", async function () {
      await expect(yafi.connect(merchant).processSale(merchant.address, { value: E("0.01") }))
        .to.be.revertedWithCustomError(yafi, "SelfPayment");
      expect((await m()).salesCount).to.equal(0);
    });

    it("prepayment lowers the debt and counts as repayment, but not as a sale", async function () {
      await expect(yafi.connect(merchant).repay({ value: E("0.05") }))
        .to.emit(yafi, "DirectRepayment").withArgs(merchant.address, 1, E("0.05"), E("0.15"));
      const r = await m();
      expect(r.creditBalance).to.equal(E("0.15"));
      expect(r.totalRepaid).to.equal(E("0.05"));
      expect(r.salesCount).to.equal(0);
      expect(r.lastRepaymentAt).to.be.greaterThan(0);
      expect(await yafi.treasury()).to.equal(E("9.85"));
    });

    it("prepaying everything returns the excess but does not grow the line", async function () {
      const tx = yafi.connect(merchant).repay({ value: E("0.5") });
      await expect(tx).to.changeEtherBalances([merchant, yafi], [E("-0.2"), E("0.2")]);
      await expect(tx).to.emit(yafi, "CreditFullyRepaid").withArgs(merchant.address, 1, E("0.2"), 0, E("0.2"));
      expect((await m()).loansRepaid).to.equal(1);
      expect(await yafi.creditLimit(merchant.address)).to.equal(E("0.2"));
    });

    it("grows the line only with the part repaid through sales", async function () {
      await yafi.setRetention(merchant.address, 3000);
      await sale(E("0.1")); // 0.03 via sales
      await sale(E("0.1")); // 0.06 via sales
      await yafi.connect(merchant).repay({ value: E("0.14") });
      expect((await m()).repaidFromSales).to.equal(E("0.06"));
      expect(await yafi.creditLimit(merchant.address)).to.equal(E("0.23")); // 0.2 + 50% of 0.06
    });

    it("rejects a prepayment with no loan or no value", async function () {
      await expect(yafi.connect(stranger).repay({ value: E("0.01") }))
        .to.be.revertedWithCustomError(yafi, "NoOutstandingLoan");
      await expect(yafi.connect(merchant).repay({ value: 0 }))
        .to.be.revertedWithCustomError(yafi, "ZeroAmount");
    });
  });

  describe("Rule 3: minimum sale", function () {
    it("rejects sales below the minimum, including zero", async function () {
      await expect(sale(MIN_SALE - 1n)).to.be.revertedWithCustomError(yafi, "SaleBelowMinimum").withArgs(MIN_SALE);
      await expect(sale(0)).to.be.revertedWithCustomError(yafi, "SaleBelowMinimum");
    });

    it("accepts a sale equal to the minimum", async function () {
      await sale(MIN_SALE);
      expect((await m()).salesCount).to.equal(1);
    });
  });

  describe("Interest on the outstanding balance", function () {
    it("rejects a rate above the maximum", async function () {
      await expect(yafi.grantCredit(merchant.address, E("0.1"), 1000, MAX_RATE + 1))
        .to.be.revertedWithCustomError(yafi, "RateAboveMaximum").withArgs(MAX_RATE);
    });

    it("accrues simple interest over time on what is still owed", async function () {
      await yafi.grantCredit(merchant.address, E("0.4"), 1000, 4000); // 40% a year
      await wait(YEAR / 2);
      // About 0.4 + 0.4 * 40% / 2 = 0.48 (a few extra seconds of blocks allowed)
      expect(await yafi.currentDebt(merchant.address)).to.be.closeTo(E("0.48"), E("0.0001"));
    });

    it("prepaying early saves interest", async function () {
      // Two merchants with the same loan; one prepays half right away
      await yafi.grantCredit(merchant.address, E("0.4"), 1000, 4000);
      await yafi.grantCredit(stranger.address, E("0.4"), 1000, 4000);
      await yafi.connect(merchant).repay({ value: E("0.2") });
      await wait(YEAR / 2);
      const early = await yafi.currentDebt(merchant.address);
      const late = await yafi.currentDebt(stranger.address);
      expect(early).to.be.closeTo(E("0.24"), E("0.0001")); // 0.2 + 0.2 * 20%
      expect(late - E("0.2")).to.be.greaterThan(early);     // paying 0.2 at the end costs more
    });

    it("sales repay interest too, and the loan closes exactly at zero", async function () {
      await yafi.grantCredit(merchant.address, E("0.1"), 3000, 4000);
      await wait(YEAR / 4);
      await repayBySales(E("0.1"));
      const r = await m();
      expect(r.creditBalance).to.equal(0);
      expect(r.loanInterest).to.be.greaterThan(0);
      expect(r.totalRepaid).to.equal(E("0.1") + r.loanInterest);
      expect(await yafi.treasury()).to.equal(E("10") + r.loanInterest);
    });

    it("previewSale includes accrued interest when capping at the debt", async function () {
      await yafi.grantCredit(merchant.address, E("0.01"), 3000, 4000);
      await wait(YEAR);
      const [retained] = await yafi.previewSale(merchant.address, E("1"));
      expect(retained).to.be.closeTo(E("0.014"), E("0.00001")); // debt 0.01 + 40%
    });

    it("charges interest on the principal only, however often the contract is touched", async function () {
      // Two identical loans; one gets a tiny sale (with tiny retention) every month, the other is left alone
      await yafi.grantCredit(merchant.address, E("0.4"), 1, MAX_RATE);
      await yafi.grantCredit(stranger.address, E("0.4"), 1, MAX_RATE);
      for (let i = 0; i < 12; i++) {
        await wait(YEAR / 12);
        await sale(MIN_SALE);
      }
      // Simple interest: 0.4 * 75% = 0.3 a year on each, never interest on interest
      expect(await yafi.currentDebt(stranger.address)).to.be.closeTo(E("0.7"), E("0.0001"));
      const r = await m();
      expect(r.loanInterest).to.be.closeTo(E("0.3"), E("0.0001"));
      expect(r.creditBalance).to.equal(E("0.4"));                // retention went to interest first
      expect(r.accruedInterest).to.equal(r.loanInterest - r.loanRepaid);
    });

    it("no interest runs while the merchant is frozen", async function () {
      await yafi.grantCredit(merchant.address, E("0.4"), 1000, 4000);
      await wait(YEAR / 4);
      await yafi.setMerchantFrozen(merchant.address, true);
      const atFreeze = await yafi.currentDebt(merchant.address);
      await wait(YEAR / 4);
      expect(await yafi.currentDebt(merchant.address)).to.equal(atFreeze);
      await yafi.setMerchantFrozen(merchant.address, false);
      await wait(YEAR / 4);
      // Charged for two quarters, not three: 0.4 + 0.4 * 40% / 2
      expect(await yafi.currentDebt(merchant.address)).to.be.closeTo(E("0.48"), E("0.0001"));
    });
  });

  describe("Automatic repayment from sales", function () {
    beforeEach(async function () {
      await yafi.grantCredit(merchant.address, E("0.5"), 1000, 0);
    });

    it("splits the sale: 90% to the merchant, 10% to the treasury", async function () {
      const tx = sale(E("0.1"));
      await expect(tx).to.changeEtherBalances([customer, merchant, yafi], [E("-0.1"), E("0.09"), E("0.01")]);
      await expect(tx).to.emit(yafi, "SaleProcessed")
        .withArgs(merchant.address, customer.address, E("0.1"), E("0.01"), E("0.09"));
      const r = await m();
      expect(r.creditBalance).to.equal(E("0.49"));
      expect(r.salesCount).to.equal(1);
    });

    it("never retains more than the outstanding debt and closes the loan", async function () {
      await yafi.setRetention(merchant.address, 3000);
      await sale(E("1.6")); // retains 0.48
      const tx = sale(E("1"));
      await expect(tx).to.changeEtherBalances([merchant, yafi], [E("0.98"), E("0.02")]);
      await expect(tx).to.emit(yafi, "CreditFullyRepaid");
      expect((await m()).creditBalance).to.equal(0);
    });
  });

  describe("Lender tools", function () {
    beforeEach(async function () {
      await yafi.grantCredit(merchant.address, E("0.2"), 1000, 4000);
    });

    it("a frozen merchant has no retention and no new loans, but can still prepay", async function () {
      await yafi.setMerchantFrozen(merchant.address, true);
      await expect(sale(E("0.1"))).to.changeEtherBalance(merchant, E("0.1"));
      expect(await yafi.creditLimit(merchant.address)).to.equal(0);
      await yafi.connect(merchant).repay({ value: E("0.3") });
      await expect(yafi.grantCredit(merchant.address, E("0.1"), 1000, 0))
        .to.be.revertedWithCustomError(yafi, "MerchantFrozen");
    });

    it("writes off an unrecoverable loan and removes the line", async function () {
      await wait(30 * 24 * 3600);
      await expect(yafi.writeOff(merchant.address)).to.emit(yafi, "CreditWrittenOff");
      const r = await m();
      expect(r.creditBalance).to.equal(0);
      expect(r.loansWrittenOff).to.equal(1);
      expect(r.totalWrittenOff).to.be.greaterThan(E("0.2"));
      expect(await yafi.creditLimit(merchant.address)).to.equal(0);
      await yafi.setCreditLine(merchant.address, E("0.05")); // lender rehabilitates
      expect(await yafi.creditLimit(merchant.address)).to.equal(E("0.05"));
    });

    it("pause stops sales and new loans, but not prepayments", async function () {
      await yafi.setPaused(true);
      await expect(sale(E("0.1"))).to.be.revertedWithCustomError(yafi, "Paused");
      await expect(yafi.grantCredit(stranger.address, E("0.1"), 1000, 0)).to.be.revertedWithCustomError(yafi, "Paused");
      await yafi.connect(merchant).repay({ value: E("0.01") });
      await yafi.setPaused(false);
      await sale(E("0.1"));
    });

    it("records when the loan was granted and the last repayment", async function () {
      const r0 = await m();
      expect(r0.loanGrantedAt).to.be.greaterThan(0);
      expect(r0.lastRepaymentAt).to.equal(0);
      await sale(E("0.1"));
      expect((await m()).lastRepaymentAt).to.be.greaterThanOrEqual(r0.loanGrantedAt);
    });

    it("ownership moves in two steps", async function () {
      await yafi.transferOwnership(stranger.address);
      expect(await yafi.owner()).to.equal(admin.address);
      await expect(yafi.connect(customer).acceptOwnership()).to.be.revertedWithCustomError(yafi, "NotPendingOwner");
      await yafi.connect(stranger).acceptOwnership();
      expect(await yafi.owner()).to.equal(stranger.address);
    });

    it("only the owner can use lender tools", async function () {
      const calls = [
        () => yafi.connect(stranger).grantCredit(stranger.address, E("0.1"), 1000, 0),
        () => yafi.connect(stranger).writeOff(merchant.address),
        () => yafi.connect(stranger).setPaused(true),
        () => yafi.connect(stranger).setMerchantFrozen(merchant.address, true),
        () => yafi.connect(stranger).setCreditLine(merchant.address, 1),
        () => yafi.connect(stranger).withdrawTreasury(stranger.address, 1),
        () => yafi.connect(stranger).syncTreasury()
      ];
      for (const call of calls) await expect(call()).to.be.revertedWithCustomError(yafi, "NotOwner");
    });

    it("rejects retention outside 0.01%-30% and treasury overdrafts", async function () {
      await expect(yafi.setRetention(merchant.address, 3001)).to.be.revertedWithCustomError(yafi, "RetentionOutOfRange");
      await expect(yafi.withdrawTreasury(admin.address, E("11"))).to.be.revertedWithCustomError(yafi, "InsufficientTreasury");
      await expect(yafi.withdrawTreasury(stranger.address, E("1"))).to.changeEtherBalance(stranger, E("1"));
    });
  });
});
