# YAFI · Finance NOW!

**Collect, grow and pay right from your phone.** Your sales are your credit.

> A payments app that never mentions blockchain. Every QR sale an informal merchant receives automatically repays a small microloan on **Monad**, and builds the credit history they never had.

**Track:** Consumer Products & Payments · Monad Metropolis Hackathon 2026
**Live demo:** https://judiweb3-cmd.github.io/yafi/ (Monad Testnet; no wallet needed, test balance arrives automatically)
**Contract (v2):** [`0x21B86c97989ae1962928706dCe8042568C340845`](https://testnet.monadexplorer.com/address/0x21B86c97989ae1962928706dCe8042568C340845) on Monad Testnet (chain ID 10143)
**Demo video:** https://youtu.be/tZQGx8nTA9I · **Pitch video:** https://youtu.be/tbX6vABEUr0

🇪🇸 [Leer en español](README.es.md)

---

## The problem

About **70% of workers in Peru are informal** ([INEI, 2025](https://www.expreso.com.pe/economia/formalizacion-laboral-impulsaria-crecimiento-en-peru-mas-del-70-de-trabajadores-sigue-en-informalidad-epen-inei-noticia/1283864/)). A street vendor like Rosa (an illustrative example, not a real user) sells breakfast from a cart every day, and many customers already pay her by scanning a QR code with a mobile wallet such as Yape (similar to Venmo). But she has no payslips and no formal credit history, so banks say no.

When she needs working capital, the option left is often *gota a gota* ("drop by drop"), an informal daily-repayment loan. An IPE study found that about **211,000 Peruvian families** used it in one year, and that **half of informal borrowers pay more than 500% a year** ([IPE via Gestión, 2024](https://gestion.pe/tu-dinero/finanzas-personales/prestamos-gota-a-gota-acechan-a-211000-familias-cuanto-cobran-informalidad-noticia/)).

Rosa does have something lenders want: a steady flow of daily sales. YAFI turns that flow into credit.

## Who is building this

I spent 8 years as a credit officer in Peru: at a bank, in the small-business segment, and at financieras (regulated non-bank lenders), in the microenterprise segment. My smallest clients (street breakfast and snack sellers, clothing stalls, massage services) sold S/ 100–200 a day (about US$ 29–58; S/ = Peruvian soles). I could see those sales in the field, but they bought their supplies at the market with no receipts, so nothing on paper proved them, and they were turned down. Many ended up borrowing at 20% a month, or even 5% a day, from informal lenders.

YAFI is my first technical project. I am not a programmer, but I am learning.

## How it works

1. **The lender grants a microloan** (in the demo: S/ 500, about US$ 145, with 10% retention per sale, capped at 30%). The money lands in Rosa's wallet immediately.
2. **A customer pays Rosa by QR**, as they already do with mobile wallets, and gets a branded receipt they can share on WhatsApp. The customer never sees anything about Rosa's loan: that information is hers.
3. **The smart contract splits each sale in the same transaction:** 90% goes to Rosa instantly and 10% repays her loan. No fixed instalments, no trips to a branch, no cash collection. Rosa's phone rings with the YAFI sound and shows the sale.
4. **Every sale and repayment is recorded on chain.** That behavioural history (sales count, amount repaid, loans fully repaid) is the base for bigger loans later, and for a credit record of the informal economy.
5. **Interest is simple and only on the principal** (demo: 6% a month, 72% a year). Every repayment pays interest first, so paying early, from sales or in cash, lowers the cost.

## Risk and pricing controls (v2)

In my experience as a credit officer, lenders apply these rules by hand. `YafiCreditEscrowV2` enforces them, so no admin can skip them:

| Rule | What the contract does | Why lenders use it |
|---|---|---|
| **Credit ladder** | The first loan is capped (demo: S/ 500). A new loan is only possible once the current one is fully repaid, and it can be at most 150% of the last one. | Small first loans limit the loss on an unknown borrower; the line grows only with proven repayment. |
| **No self-payment** | A merchant cannot pay their own QR. They can still prepay directly (for example with cash sales) with `repay()`: that lowers the debt and counts as repayment, but not as a sale. | Stops a borrower from cycling their own money to fake a sales history. |
| **Minimum sale** | Sales below a minimum (demo: S/ 1) are rejected. | Stops dust payments from inflating the sales count used as behavioural history. |
| **Rate cap and freeze** | Interest can never exceed a cap set at deployment (demo: 75% a year). The lender can freeze a merchant during a dispute: no retention and no interest while frozen. | Protects the borrower from abusive pricing and from interest piling up during a dispute. |

The 150% step and the demo limits are illustrative prototype parameters, not figures taken from a regulator. The caps and the minimum are set at deployment and can be changed by the owner with `setLimits`.

The customer never sees a wallet, a seed phrase or the word "blockchain": the app creates an invisible account in the browser, a small sponsor service gives it test balance, and every amount is shown in soles.

## User tests

On 13 October 2026 I tested the live app with real people: family, friends and small merchants (market stalls, corner shops, a street food stall and a clothing store), in person and over WhatsApp. Notes are anonymous: no names or personal data.

| Where | Who | What happened |
|---|---|---|
| Market stall | Merchant and a customer, two phones | S/ 10 sale; Rosa's screen updated live and her loan went from S/ 481.32 to S/ 480.32 |
| Corner shop (bodega) | Merchant and a customer | S/ 44 payment; the sale appeared live on the merchant's phone |
| Another shop | A customer | S/ 10.80 payment, confirmed |
| Street stall in Lima, at night | A customer | Scanned the QR and paid S/ 20 |
| Remote, over WhatsApp | A friend with no crypto background | Paid S/ 5 from her own phone (confirmed in 1.0 s) and said: "so fast" |
| Clothing store | Owner | Interview about her sales pattern (see below) |

What I learned:
- A friend who knows nothing about crypto paid on her own and said: "so fast". No wallet, no sign-up.
- A clothing-store owner sells nothing on some weekdays and S/ 500–800 on weekends and holidays. A fixed instalment would push her into arrears in slow weeks; a share of each sale follows the rhythm of her business.
- People did not understand the blockchain explorer link on the receipt ("what is this?"), so the receipt now looks like a familiar payment voucher and can be shared by WhatsApp. The on-chain proof stays available for judges and auditors.

**Next 100 users.** Market merchants in Peru are organised in associations. The plan is to present YAFI to two market associations (Piura and Lima), aiming for 50 merchants each. Every merchant displays a YAFI QR at the stall, and their customers become users. My 8 years in the field with small businesses are the channel.

## What was built during the hackathon

Everything in this repository was written during the hackathon window (October 2026). There is no pre-existing code.

| Piece | What it does |
|---|---|
| `contracts/YafiCreditEscrowV2.sol` | Escrow that holds the lending treasury, grants loans, splits every sale between the merchant and the loan repayment, charges simple interest on the principal, and enforces the controls above. Retention has a hard 30% cap; reentrancy guard, owner-only lending and custom errors. |
| `contracts/YafiCreditEscrow.sol` | The first version (v1), used for the first on-chain test. Same split logic without the risk controls. |
| `test/` | 45 Hardhat tests: 32 for v2 (the ladder, interest on principal only, no interest while frozen, outstanding loans, self-payment, minimum sale, per-loan progress, the split, never over-collecting, admin controls) and 13 for v1. |
| `app/` | Mobile web app (ES/EN). **Pay Rosa** (customer, with a shareable receipt), **Rosa's view** (live loan balance, sales feed with sound and voice, and the size of her next loan) and an **admin panel** (lender, via MetaMask). |
| `sponsor/` | A small Cloudflare Worker that sends 0.1 test MON to each new visitor, so nobody needs a wallet or a faucet. Its key is a Cloudflare secret, never stored in this repository. |

### Live on Monad Testnet

- **Contract v2:** [`0x21B86c97989ae1962928706dCe8042568C340845`](https://testnet.monadexplorer.com/address/0x21B86c97989ae1962928706dCe8042568C340845), deployed with Remix (Solidity 0.8.34) and funded with a 1 MON lending treasury.
- **Demo merchant "Rosa":** [`0x44e0C28209F3c2735613b13c3813826A9eeC135D`](https://testnet.monadexplorer.com/address/0x44e0C28209F3c2735613b13c3813826A9eeC135D). Loan granted on v2: S/ 500 (0.5 MON) at 10% retention and 6% a month.
- **On-chain activity:** the user-test payments above are listed on the contract's explorer page, each one with its retention to Rosa's loan.
- **v1 proof:** the first version, [`0x1e8902E1c942F1AF71b2A30548f354D1C9e2c831`](https://testnet.monadexplorer.com/address/0x1e8902E1c942F1AF71b2A30548f354D1C9e2c831), still holds the first on-chain test: a 0.5 MON loan, then a S/ 10 sale that left Rosa's debt at S/ 499.

## Try it (judges)

No wallet, no faucet and no setup needed.

1. On a computer or phone, open **Rosa's view**: https://judiweb3-cmd.github.io/yafi/app/#/rosa and tap **Turn on sale sounds**.
2. On another phone (or tab), open **Pay Rosa**: https://judiweb3-cmd.github.io/yafi/app/#/escanear, choose an amount and pay. The first payment takes a few seconds while the test balance arrives.
3. You get a receipt you can share. On Rosa's screen, the sale arrives with the YAFI sound, a voice line, and her debt goes down.
4. To see the Monad side, open the [contract on the explorer](https://testnet.monadexplorer.com/address/0x21B86c97989ae1962928706dCe8042568C340845).

The app follows your browser language; the EN/ES button switches it. If the sponsor ever runs out of test balance, the payment screen offers **Pay with MetaMask** (Monad Testnet, chain ID 10143) inside a collapsed judges/developers option.

By design, customers and merchants only ever see soles: no wallet, token or network names. The only crypto wording is inside that collapsed option and in the lender's admin panel.

## Screenshots

| Home | Receipt | Rosa's live view |
|---|---|---|
| ![Home](docs/screenshots/1-home.png) | ![Receipt](docs/screenshots/3-paid.png) | ![Rosa](docs/screenshots/4-rosa.png) |


## Why Monad

Repayment per sale means many tiny transactions per merchant, cents at a time. It only works if each payment confirms as fast as the QR payment it replaces and costs almost nothing.

- **Speed:** Blocks and finality in under a second ([Monad docs](https://docs.monad.xyz/)). The receipt shows the real confirmation time of every payment.
- **Full EVM compatibility:** a standard Solidity contract, Hardhat tests, Remix deployment and ethers.js, with no changes.
- **Live UX from events:** Rosa's screen polls `SaleProcessed` logs every few seconds, so a sale appears on her phone almost as soon as the customer pays.

Two Monad specifics shaped the design ([Monad docs: differences from Ethereum](https://docs.monad.xyz/developer-essentials/differences)):
- **Gas is charged on the gas limit, not on gas used.** The app lets ethers estimate the exact limit and keeps a margin in the customer's test balance.
- **Reserve balance (10 MON per account).** A payment whose value would take a normal account below 10 MON reverts, unless the account sent no other transaction in the last 3 blocks. Customer accounts pay one sale at a time; the app waits about 2.5 seconds after receiving test balance and between payments from the same account. The sponsor account keeps more than 10 MON.

## Architecture

```
 Customer's phone (browser)                         Monad Testnet
 ┌───────────────────────────┐   processSale()  ┌──────────────────────────────┐
 │ app/ · Pay Rosa            │ ───────────────► │ YafiCreditEscrowV2            │
 │ invisible account (local)  │                  │  • retains X% → loan + interest│
 └─────────────┬─────────────┘                  │  • pays net → Rosa (same tx)  │
               │ first visit                     │  • updates debt and history   │
               ▼                                 │                              │
 ┌───────────────────────────┐  0.1 test MON    │ grantCredit() ◄── lender     │
 │ sponsor/ · Cloudflare      │ ───────────────► │                              │
 │ Worker (key as a secret)   │                  └──────────────┬───────────────┘
 └───────────────────────────┘                                 │ SaleProcessed
 ┌───────────────────────────┐   events / views                │
 │ app/ · Rosa's view         │ ◄────────────────────────────────┘
 └───────────────────────────┘
 ┌───────────────────────────┐   grantCredit()
 │ app/ · Admin (MetaMask)    │ ─────────────────────────────►
 └───────────────────────────┘
```

- **Contract:** holds the treasury, the per-merchant record (`creditBalance`, `accruedInterest`, `currentLoan`, `creditLine`, `annualRateBps`, `frozen`, `totalRepaid`, `salesCount`, `loansRepaid`, `retentionBps`, `lastRepaymentAt`…) and the split logic. `previewSale` shows the split before paying, `currentDebt` includes interest to date, and `creditLimit` shows how much a merchant can borrow now.
- **Frontend:** static HTML, CSS and JavaScript with no build step. It talks to the public Monad RPC through ethers.js. The receipt image is drawn in the browser.
- **Sponsor:** one Cloudflare Worker endpoint. It only tops up accounts below 0.1 MON and accepts requests only from the app's origin.

## Tech stack

Solidity 0.8.34 · Hardhat 2 (with hardhat-toolbox, Chai and Mocha) · ethers.js 6.17 · vanilla HTML/CSS/JS · Cloudflare Workers + Wrangler (sponsor) · Remix IDE + MetaMask (deployment) · GitHub Pages (hosting) · Monad Testnet.

## Run it yourself

Requirements: Node.js 18+ and npm.

```bash
git clone https://github.com/judiweb3-cmd/yafi
cd yafi
npm install
npx hardhat test          # runs the 45 tests
```

**Deploy your own contract (optional).** Either paste `contracts/YafiCreditEscrowV2.sol` into [Remix](https://remix.ethereum.org), compile with 0.8.34 and deploy with MetaMask on Monad Testnet with the constructor arguments `_firstLoanCap = 500000000000000000` (0.5 MON), `_maxLoanCap = 5000000000000000000` (5 MON), `_minSaleAmount = 1000000000000000` (0.001 MON) and `_maxAnnualRateBps = 7500` (75% a year), or use Hardhat:

```bash
cp .env.example .env      # add the PRIVATE_KEY of a testnet-only wallet
INITIAL_TREASURY=1 npm run deploy:testnet          # v2; VERSION=1 deploys v1
```

On Monad, set a manual gas limit (about 4,000,000 for v2) and keep the deployer above 10 MON after any value sent. Then fund the treasury with `fundTreasury()` and call `grantCredit(merchant, amountInWei, retentionBps, annualRateBps)` from the owner account, for example `grantCredit(<merchant>, 500000000000000000, 1000, 7200)` for 0.5 MON, 10% retention per sale and a 72% simple annual rate (6% a month).

**Run the app locally.** Set `contract` and `merchant` in `app/config.js`, then serve the folder:

```bash
npx serve app             # or: python3 -m http.server -d app 8080
```

Routes: `#/` home, `#/escanear` pay Rosa, `#/rosa` merchant view, `#/admin` lender panel.

**Deploy the sponsor (optional).** From `sponsor/`, with a Cloudflare account and a testnet-only wallet:

```bash
npm install
npx wrangler secret put SPONSOR_KEY   # paste the wallet's private key; it stays in Cloudflare
npx wrangler deploy
```

Set `ALLOWED_ORIGINS` in `sponsor/wrangler.toml` to your app's origin, and the resulting URL as `sponsorUrl` in `app/config.js`.

## Contract error messages

v2 uses Solidity custom errors with English names (`SaleBelowMinimum`, `SelfPayment`, `OutstandingLoan`, `AboveCreditLimit`, `RateAboveMaximum`, `MerchantFrozen`, `NotOwner`, `InsufficientTreasury`, `RetentionOutOfRange`…), and the app turns them into plain messages in Spanish or English.

The v1 contract's comments and error messages are in Spanish, for the target market. The deployed source must match this file exactly for explorer verification, so it is published unchanged. Translations:

| Message | Meaning |
|---|---|
| `YAFI: solo administrador` | Only the admin (lender) |
| `YAFI: operacion en curso` | Operation already in progress (reentrancy guard) |
| `YAFI: monto cero` | Amount is zero |
| `YAFI: comerciante invalido` | Invalid merchant address |
| `YAFI: retencion fuera de rango` | Retention outside 0.01%–30% |
| `YAFI: caja insuficiente` | Treasury has insufficient funds |
| `YAFI: desembolso fallido` | Loan disbursement failed |
| `YAFI: abono al comerciante fallido` | Payment to the merchant failed |
| `YAFI: destino invalido` / `retiro fallido` | Invalid withdrawal address / withdrawal failed |
| `YAFI: nuevo admin invalido` | Invalid new admin address |

## Legal path to launch

Peru has no crypto-specific law, so a launch version of YAFI would be designed to fit rules that already exist:

- **Lending:** a launch version of YAFI would lend its own funds. In Peru that requires no banking licence, only an anti-money-laundering registration with the SBS, the banking regulator ([Res. SBS 00650-2024](https://busquedas.elperuano.pe/dispositivo/NL/2264383-1)). Rates would have to stay below the BCRP's maximum for lenders outside the financial system (to be confirmed by a lawyer); the contract already enforces a rate cap.
- **Payments:** customers would pay through a licensed payment provider, such as card networks or an authorised e-wallet, so YAFI would never hold the merchants' money ([BCRP Circular 0026-2026](https://busquedas.elperuano.pe/dispositivo/NL/2561268-1)).
- **Blockchain:** Monad would be the internal ledger. Users only see soles and never buy, hold or exchange crypto.
- **Pilot:** since 2025, the SBS sandbox also accepts firms the SBS does not supervise ([Res. SBS 04142-2025](https://busquedas.elperuano.pe/dispositivo/NL/2461089-1)). The next step is a supervised pilot there, together with a regulated partner.

## Limitations (honest status)

- This is a **testnet prototype**: test MON stands in for soles at a demo rate of 1 sol = 0.001 MON.
- A single admin sets loans and retention; there is no automated scoring yet.
- The invisible customer account stores its key in the browser's localStorage, which is acceptable for testnet only.
- The sponsor has no rate limit: a script could request test balance for many new accounts. On testnet this is accepted and its balance is kept small.
- The contracts have not been audited. An AI-assisted code review of v1 found three contract-level limits. v2 fixes two of them: dust and self-paid sales can no longer inflate `salesCount`, and repayment progress is measured per loan. The third remains: a customer can still pay the merchant outside the contract; repayment only happens on sales that go through YAFI.
- The self-payment block stops a merchant from paying from their own account, not from a second account they control. Scoring in production should weigh repaid value and many distinct payers, not only the sales count.
- YAFI is not a bank and does not take deposits. In Peru, taking deposits from the public requires authorisation from the banking regulator, the SBS (art. 11, Law 26702).
- A launch using virtual assets would probably need to register as a virtual asset service provider with Peru's financial intelligence unit (UIF), under DS 006-2023-JUS.
- Before launch, a Peruvian lawyer must validate this design.

## Roadmap

- A risk engine on top of the v2 ladder: rates and line sizes that react to repayment speed and to how sales evolve.
- Independent informal workers paid daily or weekly (not only merchants).
- Partnerships with regulated lenders and municipal savings banks that would use the behavioural history.
- Savings with yield only through a licensed partner.
- Alerts for days without repayments, in tiers of 3–7, 8–15, 16–30 and 30+ days, read from `lastRepaymentAt`. Messages are sent only with the merchant's consent and never outside the hours Peruvian consumer law allows.
- Payments in soles. A sol-denominated ledger avoids lending dollars to merchants who earn soles, which would add currency risk.
- Production security: a multisig admin key with a time delay, and an allowlist so only licensed payment providers can submit sales.
- A recorded brand voice for the sale alert, and a custom domain.

## Attribution

- [ethers.js](https://github.com/ethers-io/ethers.js) v6.17 (MIT), vendored in `app/vendor/ethers.umd.min.js` and used by the sponsor.
- [Hardhat](https://hardhat.org) and `@nomicfoundation/hardhat-toolbox` (MIT), for compiling and testing.
- [Wrangler](https://github.com/cloudflare/workers-sdk) (MIT/Apache-2.0) and Cloudflare Workers, for the sponsor.
- [Remix IDE](https://remix.ethereum.org) and MetaMask, for deployment.
- [Rates by Exchange Rate API](https://www.exchangerate-api.com), for the live dollar reference shown in English.
- Market figures come from public sources, linked inline.

## Use of AI tools

As the hackathon rules require, I disclose that this project was built with the help of an AI coding assistant, **Claude (Anthropic)**. It drafted the smart contract, tests, frontend, sponsor service and documentation. I defined the product and the credit logic from my 8 years as a microcredit officer, reviewed every step, deployed the contracts and the sponsor, and ran the on-chain and user tests. This is my first technical project: I am not a programmer, but I am learning.

## License

[MIT](LICENSE). The YAFI name and brand are reserved and are not covered by the license.
