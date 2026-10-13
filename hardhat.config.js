require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

// The private key is only read from .env (never committed; see .gitignore).
const accounts = process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [];

module.exports = {
  // Same compiler version used for the Remix deployment on Monad Testnet (0.8.34).
  solidity: "0.8.34",
  networks: {
    monadTestnet: {
      url: process.env.MONAD_RPC_URL || "https://testnet-rpc.monad.xyz",
      chainId: 10143,
      accounts,
    },
  },
};
