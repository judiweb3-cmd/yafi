// YAFI demo configuration (Monad Testnet).
window.YAFI_CONFIG = {
  chainId: 10143,
  rpcUrl: "https://testnet-rpc.monad.xyz",
  explorer: "https://testnet.monadexplorer.com",

  // YafiCreditEscrow deployed on Monad Testnet
  contract: "0x1e8902E1c942F1AF71b2A30548f354D1C9e2c831",

  // Wallet of "Rosa", the demo merchant
  merchant: "0x44e0C28209F3c2735613b13c3813826A9eeC135D",

  // Optional, and NEVER committed: key of a testnet-only "sponsor" wallet that tops up
  // each visitor automatically. Empty = the visitor shows a code and the admin sends test
  // funds from #/admin, or the visitor pays with their own MetaMask.
  sponsorKey: "",

  // Demo exchange rate: 1 sol (PEN) = 0.001 testnet MON
  monPerSol: 0.001,

  // Test balance sent to each visitor (MON). Monad charges gas on the gas limit,
  // so this leaves room for several payments.
  starterMon: "0.1"
};
