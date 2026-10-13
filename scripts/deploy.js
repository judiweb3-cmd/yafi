const { ethers } = require("hardhat");

// Deploys YafiCreditEscrowV2 (default) or the original YafiCreditEscrow with VERSION=1.
// V2 limits, in MON: FIRST_LOAN_CAP (default 0.5 = S/ 500) and MIN_SALE (default 0.001 = S/ 1).
async function main() {
  const initialTreasury = ethers.parseEther(process.env.INITIAL_TREASURY || "0");
  if (process.env.VERSION === "1") {
    const v1 = await ethers.deployContract("YafiCreditEscrow", { value: initialTreasury });
    await v1.waitForDeployment();
    console.log("YafiCreditEscrow deployed at:", await v1.getAddress());
    return;
  }
  const firstLoanCap = ethers.parseEther(process.env.FIRST_LOAN_CAP || "0.5");
  const minSale = ethers.parseEther(process.env.MIN_SALE || "0.001");
  const yafi = await ethers.deployContract("YafiCreditEscrowV2", [firstLoanCap, minSale], { value: initialTreasury });
  await yafi.waitForDeployment();
  console.log("YafiCreditEscrowV2 deployed at:", await yafi.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
