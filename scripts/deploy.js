const { ethers } = require("hardhat");

async function main() {
  const initialTreasury = ethers.parseEther(process.env.INITIAL_TREASURY || "0");
  const yafi = await ethers.deployContract("YafiCreditEscrow", { value: initialTreasury });
  await yafi.waitForDeployment();
  console.log("YafiCreditEscrow deployed at:", await yafi.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
