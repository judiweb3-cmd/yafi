// YAFI demo configuration (Monad Testnet).
window.YAFI_CONFIG = {
  chainId: 10143,
  rpcUrl: "https://testnet-rpc.monad.xyz",
  explorer: "https://testnet.monadexplorer.com",

  // YafiCreditEscrowV2 deployed on Monad Testnet (v1 was 0x1e8902E1c942F1AF71b2A30548f354D1C9e2c831)
  contract: "0x21B86c97989ae1962928706dCe8042568C340845",

  // Wallet of "Rosa", the demo merchant
  merchant: "0x44e0C28209F3c2735613b13c3813826A9eeC135D",

  // Keep EMPTY in this repo. Anything here is served publicly by GitHub Pages, so a key
  // pasted here is a published key. It is only for local testing with a throwaway
  // testnet wallet. Empty = the visitor pays with their own MetaMask, or shows a code
  // and the admin sends test funds from #/admin.
  sponsorKey: "",

  // Demo exchange rate: 1 sol (PEN) = 0.001 testnet MON
  monPerSol: 0.001,

  // Default interest rate shown in the admin panel (% per month; 6% = 72% simple annual)
  demoMonthlyRate: 6,

  // Reference exchange rate shown to English-speaking visitors (S/ per US$, verified 12 Oct 2026)
  solesPerUsd: 3.436,

  // Optional URL of a small sponsor service that sends test balance to new visitors.
  // Its key lives as a secret on that service, never in this repo.
  sponsorUrl: "",

  // Test balance sent to each visitor (MON). Monad charges gas on the gas limit,
  // so this leaves room for several payments.
  starterMon: "0.1"
};
