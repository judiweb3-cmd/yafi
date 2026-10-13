/* YAFI · demo web app
 * Customer (#/pagar): pays Rosa from an invisible account created in their browser.
 * Rosa (#/rosa): sees live how much of her loan is left to repay.
 * Admin (#/admin): the lender grants loans and sends test funds with MetaMask.
 */
(function () {
  "use strict";

  const CFG = window.YAFI_CONFIG;
  const { ethers } = window;

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* no storage available */ } }
  };

  // Works with both deployed versions: v2 adds the credit ladder, the self-payment block and
  // a minimum sale, and returns a longer merchant record. The version is detected on chain.
  const ABI = [
    "function owner() view returns (address)",
    "function treasury() view returns (uint256)",
    "function merchants(address) view returns (uint256 creditBalance, uint256 currentLoan, uint256 totalGranted, uint256 totalRepaid, uint256 salesCount, uint32 loansRepaid, uint16 retentionBps, bool isActive)",
    "function creditLimit(address merchant) view returns (uint256)",
    "function firstLoanCap() view returns (uint256)",
    "function minSaleAmount() view returns (uint256)",
    "function previewSale(address merchant, uint256 amount) view returns (uint256 retained, uint256 netToMerchant)",
    "function repaymentProgressBps(address merchant) view returns (uint256)",
    "function processSale(address merchant) payable",
    "function grantCredit(address merchant, uint256 amount, uint16 retentionBps)",
    "function fundTreasury() payable",
    "event SaleProcessed(address indexed merchant, address indexed payer, uint256 amount, uint256 retained, uint256 netToMerchant)",
    "event CreditFullyRepaid(address indexed merchant, uint256 totalRepaid)",
    "error NotOwner()",
    "error Reentrancy()",
    "error ZeroAddress()",
    "error ZeroAmount()",
    "error RetentionOutOfRange()",
    "error InsufficientTreasury()",
    "error TransferFailed()",
    "error OutstandingLoan()",
    "error AboveCreditLimit(uint256 limit)",
    "error SelfPayment()",
    "error SaleBelowMinimum(uint256 minimum)"
  ];
  const ABI_V1_MERCHANTS = [
    "function merchants(address) view returns (uint256 creditBalance, uint256 totalGranted, uint256 totalRepaid, uint256 salesCount, uint16 retentionBps, bool isActive)"
  ];

  // No cache (balances change every block) and fast polling: Monad confirms in under a second
  const provider = new ethers.JsonRpcProvider(CFG.rpcUrl, CFG.chainId, { staticNetwork: true, cacheTimeout: -1, pollingInterval: 500 });
  const yafi = new ethers.Contract(CFG.contract, ABI, provider);
  const yafiV1 = new ethers.Contract(CFG.contract, ABI_V1_MERCHANTS, provider);
  const configured = CFG.contract !== ethers.ZeroAddress && CFG.merchant !== ethers.ZeroAddress;

  // v2 exposes firstLoanCap(); v1 reverts on it. Only a definite answer is cached, so a
  // network hiccup does not lock the app into the wrong version.
  let v2Known = null;
  async function isV2() {
    if (v2Known !== null) return v2Known;
    try { await yafi.firstLoanCap(); v2Known = true; } catch (e) {
      if (e && e.code === "CALL_EXCEPTION") v2Known = false; else throw e;
    }
    return v2Known;
  }
  // Same shape for both versions; currentLoan is the loan being repaid now.
  async function readMerchant(addr) {
    if (await isV2()) {
      const m = await yafi.merchants(addr);
      return { creditBalance: m.creditBalance, currentLoan: m.currentLoan, totalGranted: m.totalGranted, totalRepaid: m.totalRepaid,
        salesCount: m.salesCount, retentionBps: m.retentionBps, isActive: m.isActive, limit: await yafi.creditLimit(addr) };
    }
    const m = await yafiV1.merchants(addr);
    return { creditBalance: m.creditBalance, currentLoan: m.totalGranted, totalGranted: m.totalGranted, totalRepaid: m.totalRepaid,
      salesCount: m.salesCount, retentionBps: m.retentionBps, isActive: m.isActive, limit: null };
  }

  // ---------- Language ----------
  const T = {
    es: {
      footer: "Demo · montos de prueba, no es dinero real",
      heroTitle: "¡Finanzas YA!",
      heroSlogan: "Cobra, crece y paga desde tu celular.",
      heroLead: "Tus ventas son tu crédito: una pequeña parte de cada venta paga tu préstamo, sola.",
      howTitle: "Cómo funciona",
      how1: "Rosa vende desayunos en Piura y recibe un préstamo de YAFI.",
      how2: "Cada cliente le paga con el celular, como siempre.",
      how3: "Un % pactado de cada venta paga el préstamo. El resto le llega a Rosa al instante.",
      asCustomer: "Pagar a Rosa", asCustomerSub: "Prueba como cliente",
      asMerchant: "Ver como Rosa", asMerchantSub: "Prueba como comerciante",
      shopName: "Desayunos Rosa", shopSub: "Carrito de desayunos · Piura",
      payTitle: "¿Cuánto vas a pagar?",
      rosaGets: "Rosa recibe", loanGets: "Paga su préstamo",
      noLoan: "Rosa no tiene préstamo activo: recibe el 100%.",
      payBtn: "Pagar {x}",
      payTo: "Pagar a",
      verified: "Comercio verificado",
      erase: "Borrar",
      range: "Monto entre {min} y {max}.",
      paidTo: "Pagaste a",
      opNumber: "N° de operación",
      date: "Fecha",
      preparing: "Conectando de forma segura…",
      paying: "Procesando pago…",
      paidTitle: "¡Pago enviado!",
      paidDetail: "Rosa recibió {net} y {ret} fueron a su préstamo.",
      paidAll: "Rosa recibió {net} completos.",
      paidTime: "Confirmado en {s} s",
      receipt: "Ver comprobante",
      payAgain: "Pagar otra vez",
      seeRosa: "Ver lo que ve Rosa",
      needFunds: "Activa tu saldo de prueba",
      needFundsHelp: "Esta demo usa saldo de prueba, no dinero real. Copia tu código y envíalo al equipo de YAFI (por ejemplo, por WhatsApp) para activarlo.",
      copy: "Copiar código de activación", copied: "Código copiado ✔",
      noWallet: "No encontramos MetaMask en este navegador.",
      wrongNetwork: "Cambia MetaMask a la red Monad Testnet e inténtalo de nuevo.",
      waitMoment: "Espera un segundo y vuelve a intentarlo.",
      lowFunds: "Saldo de prueba insuficiente para este pago.",
      orWallet: "Para jueces y desarrolladores: pagar con MetaMask (Monad Testnet)",
      payWallet: "Pagar {x} con MetaMask",
      hello: "Hola, Rosa",
      owe: "Te falta pagar",
      paidPct: "{p}% pagado",
      loanOf: "Préstamo de {x} · {r}% de cada venta",
      salesYafi: "Ventas con YAFI", repaid: "Ya pagaste",
      noLoanYet: "Todavía no tienes un préstamo activo.",
      fullyPaid: "¡Préstamo pagado! Tu buen historial ya cuenta para un préstamo mayor.",
      nextLoan: "Tu próximo préstamo puede ser de hasta {x}.",
      firstLoan: "Tu primer préstamo puede ser de hasta {x}.",
      availableLine: "Línea disponible para Rosa: {x}",
      noLineYet: "Rosa debe terminar de pagar su préstamo actual antes de recibir otro.",
      errSaleMin: "El pago mínimo es {x}.",
      errSelfPay: "Un comercio no puede pagarse a sí mismo.",
      errOutstanding: "Rosa debe terminar de pagar su préstamo actual antes de recibir otro.",
      errAboveLimit: "El monto supera la línea disponible: {x}.",
      errNotOwner: "Solo la administradora puede hacer esto.",
      errTreasury: "La caja no tiene fondos suficientes.",
      errRetention: "La retención debe estar entre 0.01% y 30%.",
      liveSales: "Ventas en vivo",
      waitingSales: "Esperando ventas… abre «Pagar a Rosa» en otro celular.",
      saleRow: "Venta de {x}",
      saleLoan: "{x} al préstamo",
      justNow: "ahora",
      back: "← Inicio",
      notConfigured: "La demo aún no está conectada al contrato. Vuelve en unos minutos.",
      error: "Algo falló. Intenta de nuevo.",
      adminTitle: "Panel de la prestamista",
      adminLead: "Solo para la administradora. Usa MetaMask en Monad Testnet.",
      connect: "Conectar MetaMask",
      treasury: "Caja disponible",
      grantTitle: "Otorgar préstamo a Rosa",
      amountSoles: "Monto (S/)",
      retention: "Retención por venta (%)",
      grantBtn: "Desembolsar",
      fundTitle: "Enviar saldo de prueba a un visitante",
      address: "Código del visitante",
      fundBtn: "Enviar {x} MON",
      done: "Listo ✔"
    },
    en: {
      footer: "Demo · test amounts, not real money",
      heroTitle: "Finance NOW!",
      heroSlogan: "Collect, grow and pay right from your phone.",
      heroLead: "Your sales are your credit: a small part of every sale repays your loan, automatically.",
      howTitle: "How it works",
      how1: "Rosa sells breakfast in Piura, Peru, and gets a loan from YAFI.",
      how2: "Each customer pays her by phone, as usual.",
      how3: "An agreed % of every sale repays the loan. The rest reaches Rosa instantly.",
      asCustomer: "Pay Rosa", asCustomerSub: "Try it as a customer",
      asMerchant: "See it as Rosa", asMerchantSub: "Try it as the merchant",
      shopName: "Rosa's Breakfast", shopSub: "Breakfast cart · Piura, Peru",
      payTitle: "How much are you paying?",
      rosaGets: "Rosa receives", loanGets: "Repays her loan",
      noLoan: "Rosa has no active loan: she receives 100%.",
      payBtn: "Pay {x}",
      payTo: "Pay to",
      verified: "Verified merchant",
      erase: "Delete",
      range: "Amount between {min} and {max}.",
      paidTo: "You paid",
      opNumber: "Operation no.",
      date: "Date",
      preparing: "Connecting securely…",
      paying: "Processing payment…",
      paidTitle: "Payment sent!",
      paidDetail: "Rosa received {net} and {ret} went to her loan.",
      paidAll: "Rosa received the full {net}.",
      paidTime: "Confirmed in {s} s",
      receipt: "View receipt",
      payAgain: "Pay again",
      seeRosa: "See what Rosa sees",
      needFunds: "Activate your test balance",
      needFundsHelp: "This demo uses test balance, not real money. Copy your code and send it to the YAFI team (e.g. by WhatsApp) to activate it.",
      copy: "Copy activation code", copied: "Code copied ✔",
      noWallet: "MetaMask was not found in this browser.",
      wrongNetwork: "Switch MetaMask to the Monad Testnet network and try again.",
      waitMoment: "Wait a second and try again.",
      lowFunds: "Not enough test balance for this payment.",
      orWallet: "For judges and developers: pay with MetaMask (Monad Testnet)",
      payWallet: "Pay {x} with MetaMask",
      hello: "Hi, Rosa",
      owe: "Left to repay",
      paidPct: "{p}% repaid",
      loanOf: "Loan of {x} · {r}% of each sale",
      salesYafi: "Sales with YAFI", repaid: "Repaid so far",
      noLoanYet: "You don't have an active loan yet.",
      fullyPaid: "Loan repaid! Your good record now counts toward a bigger loan.",
      nextLoan: "Your next loan can be up to {x}.",
      firstLoan: "Your first loan can be up to {x}.",
      availableLine: "Credit available to Rosa: {x}",
      noLineYet: "Rosa must finish repaying her current loan before getting another.",
      errSaleMin: "The minimum payment is {x}.",
      errSelfPay: "A merchant cannot pay themselves.",
      errOutstanding: "Rosa must finish repaying her current loan before getting another.",
      errAboveLimit: "The amount is above the available credit: {x}.",
      errNotOwner: "Only the admin can do this.",
      errTreasury: "The treasury does not have enough funds.",
      errRetention: "Retention must be between 0.01% and 30%.",
      liveSales: "Live sales",
      waitingSales: "Waiting for sales… open “Pay Rosa” on another phone.",
      saleRow: "Sale of {x}",
      saleLoan: "{x} to the loan",
      justNow: "now",
      back: "← Home",
      notConfigured: "The demo is not connected to the contract yet. Check back in a few minutes.",
      error: "Something went wrong. Please try again.",
      adminTitle: "Lender panel",
      adminLead: "Admin only. Uses MetaMask on Monad Testnet.",
      connect: "Connect MetaMask",
      treasury: "Available treasury",
      grantTitle: "Grant a loan to Rosa",
      amountSoles: "Amount (S/)",
      retention: "Retention per sale (%)",
      grantBtn: "Disburse",
      fundTitle: "Send test funds to a visitor",
      address: "Visitor code",
      fundBtn: "Send {x} MON",
      done: "Done ✔"
    }
  };

  let lang = store.get("yafi_lang") || ((navigator.language || "es").startsWith("es") ? "es" : "en");
  function t(key, vars) {
    let s = (T[lang] && T[lang][key]) || T.es[key] || key;
    if (vars) for (const k in vars) s = s.replace("{" + k + "}", vars[k]);
    return s;
  }

  // ---------- Utilities ----------
  function soles(wei) {
    const sol = Number(ethers.formatEther(wei)) / CFG.monPerSol;
    return "S/ " + sol.toFixed(2);
  }
  function weiFromSoles(sol) {
    return ethers.parseEther((sol * CFG.monPerSol).toFixed(18));
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function toast(msg) {
    const el = document.getElementById("toast");
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { el.hidden = true; }, 3500);
  }
  function decodeRevert(e) {
    const cands = [e && e.data, e && e.info && e.info.error && e.info.error.data,
      e && e.info && e.info.error && e.info.error.data && e.info.error.data.data, e && e.error && e.error.data];
    for (const d of cands) {
      if (typeof d !== "string" || !/^0x[0-9a-f]{8}/i.test(d)) continue;
      try { const p = yafi.interface.parseError(d); if (p) return p; } catch (err) { /* not ours */ }
    }
    return null;
  }
  function friendlyError(e) {
    console.error(e);
    const m = (e && (e.shortMessage || e.reason || e.message)) || "";
    // v2 custom errors. ethers does not always decode them (e.g. when gas estimation
    // reverts), so the raw revert data is decoded here against the contract ABI.
    const rv = (e && e.revert) || decodeRevert(e);
    if (rv && rv.name) {
      switch (rv.name) {
        case "SaleBelowMinimum": return t("errSaleMin", { x: soles(rv.args[0]) });
        case "SelfPayment": return t("errSelfPay");
        case "OutstandingLoan": return t("errOutstanding");
        case "AboveCreditLimit": return t("errAboveLimit", { x: soles(rv.args[0]) });
        case "NotOwner": return t("errNotOwner");
        case "InsufficientTreasury": return t("errTreasury");
        case "RetentionOutOfRange": return t("errRetention");
      }
    }
    // v1 revert strings
    const yafiMsg = m.match(/YAFI: [^"']+/);
    if (yafiMsg) return yafiMsg[0];
    if (e && e.code === "WRONG_NETWORK") return t("wrongNetwork");
    if (/insufficient funds/i.test(m)) return t("lowFunds");
    if (e && e.code === "CALL_EXCEPTION") return t("waitMoment"); // e.g. Monad reserve-balance revert
    return t("error");
  }

  // ---------- Invisible customer account ----------
  let customer = null;
  function getCustomer() {
    if (customer) return customer;
    let pk = store.get("yafi_pk");
    let w;
    try { w = pk ? new ethers.Wallet(pk) : null; } catch (e) { w = null; }
    if (!w) {
      w = ethers.Wallet.createRandom();
      store.set("yafi_pk", w.privateKey);
    }
    customer = w.connect(provider);
    return customer;
  }
  async function ensureFunds(minWei) {
    const c = getCustomer();
    let bal = await provider.getBalance(c.address);
    if (bal >= minWei) return true;
    if (CFG.sponsorUrl) {
      // The sponsor service holds its key as a server-side secret and sends test balance.
      const res = await fetch(CFG.sponsorUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: c.address })
      }).catch(() => null);
      if (!res || !res.ok) return false;
      // Wait until the balance arrives (Monad confirms in under a second; allow for slow RPCs)
      for (let i = 0; i < 30; i++) {
        bal = await provider.getBalance(c.address);
        if (bal >= minWei) return true;
        await new Promise((r) => setTimeout(r, 500));
      }
      return false;
    }
    if (!CFG.sponsorKey) return false;
    // Local testing only: a throwaway key in a config that is never published
    const sponsor = new ethers.Wallet(CFG.sponsorKey, provider);
    const tx = await sponsor.sendTransaction({ to: c.address, value: ethers.parseEther(CFG.starterMon) });
    await tx.wait();
    return true;
  }

  // ---------- External wallet (MetaMask) ----------
  // Switch (or add) Monad Testnet first, then build the provider, then verify the chain,
  // so a payment can never be prompted on another network.
  async function connectWallet() {
    if (!window.ethereum) throw new Error(t("noWallet"));
    await window.ethereum.request({ method: "eth_requestAccounts" });
    const chainHex = "0x" + CFG.chainId.toString(16);
    try {
      await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: chainHex }] });
    } catch (e) {
      if (e && e.code === 4902) {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [{
            chainId: chainHex,
            chainName: "Monad Testnet",
            nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
            rpcUrls: [CFG.rpcUrl],
            blockExplorerUrls: [CFG.explorer]
          }]
        });
      }
    }
    const bp = new ethers.BrowserProvider(window.ethereum);
    const net = await bp.getNetwork();
    if (net.chainId !== BigInt(CFG.chainId)) {
      const err = new Error(t("wrongNetwork"));
      err.code = "WRONG_NETWORK";
      throw err;
    }
    return bp.getSigner();
  }

  // ---------- Views ----------
  const view = () => document.getElementById("view");
  let timers = [];
  function clearTimers() { timers.forEach(clearInterval); timers = []; }

  function renderHome() {
    view().innerHTML = `
      <section class="card hero">
        <h1><span class="grad-text">${t("heroTitle")}</span></h1>
        <p class="slogan">${t("heroSlogan")}</p>
        <p class="lead">${t("heroLead")}</p>
        <a class="btn btn-primary role-btn" href="#/pagar"><span class="ico">📱</span><span>${t("asCustomer")}<small>${t("asCustomerSub")}</small></span></a>
        <a class="btn btn-secondary role-btn" href="#/rosa"><span class="ico">🥪</span><span>${t("asMerchant")}<small>${t("asMerchantSub")}</small></span></a>
      </section>
      <section class="card">
        <h2>${t("howTitle")}</h2>
        <ol class="steps">
          <li><span class="n">1</span><span>${t("how1")}</span></li>
          <li><span class="n">2</span><span>${t("how2")}</span></li>
          <li><span class="n">3</span><span>${t("how3")}</span></li>
        </ol>
      </section>`;
  }

  function merchantHeader() {
    return `<div class="merchant-head"><div class="avatar">🥪</div><div><div class="name">${t("shopName")}</div><div class="sub">${t("shopSub")}</div></div></div>`;
  }

  function notConfigured() {
    view().innerHTML = `<p><a href="#/">${t("back")}</a></p><div class="card">${t("notConfigured")}</div>`;
  }

  // Customer: a payment screen modelled on the mobile wallets people already use
  // (merchant card, big amount, keypad, one button). No addresses, tokens or networks.
  const MIN_SOL = 1;   // v2 minimum sale (S/ 1)
  const MAX_SOL = 50;  // keeps the test balance enough for several payments
  let amountStr = "10";
  let lastPayAt = 0;
  let previewTimer = null;
  const amountNum = () => Number(amountStr) || 0;
  const fmtSol = (n) => "S/ " + n.toFixed(2);
  // English viewers (e.g. global judges) also see an approximate US dollar reference.
  // Prices stay in soles: Rosa sells in Peru.
  const usdRef = (n) => (lang === "en" && CFG.solesPerUsd) ? `≈ US$ ${(n / CFG.solesPerUsd).toFixed(2)}` : "";
  const currentRoute = () => location.hash.replace(/^#\/?/, "");

  function shopCard() {
    return `
      <div class="shop">
        <div class="avatar">🥪</div>
        <div class="shop-info">
          <div class="name">${t("shopName")}</div>
          <div class="sub">${t("shopSub")}</div>
        </div>
        <span class="verified" title="${t("verified")}">✓</span>
      </div>`;
  }

  async function renderPay() {
    if (!configured) return notConfigured();
    const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "⌫"];
    view().innerHTML = `
      <div class="pay-top"><a href="#/" class="back">${t("back")}</a><span class="muted small">${t("payTo")}</span></div>
      ${shopCard()}
      <section class="amount-box">
        <div class="amount" id="amount"></div>
        <div class="usd muted small" id="usd"></div>
        <div class="split-pill" id="split"><span class="spinner"></span></div>
      </section>
      <div class="chips">
        ${[5, 10, 20].map((v) => `<button class="chip" data-v="${v}" type="button">S/ ${v}</button>`).join("")}
      </div>
      <div class="keypad">
        ${keys.map((k) => `<button class="key" data-k="${k}" type="button" aria-label="${k === "⌫" ? t("erase") : k}">${k}</button>`).join("")}
      </div>
      <button class="btn btn-primary pay-btn" id="payBtn" type="button"></button>
      <p class="muted small center" id="payNote"></p>
      <div class="overlay" id="overlay" hidden><div class="ring"></div><p id="overlayText"></p></div>`;
    view().querySelectorAll(".chip").forEach((b) => b.addEventListener("click", () => { amountStr = b.dataset.v; onAmount(); }));
    view().querySelectorAll(".key").forEach((b) => b.addEventListener("click", () => pressKey(b.dataset.k)));
    document.getElementById("payBtn").addEventListener("click", pay);
    onAmount();
  }

  function pressKey(k) {
    if (k === "⌫") amountStr = amountStr.slice(0, -1) || "0";
    else if (k === ".") { if (!amountStr.includes(".")) amountStr += "."; }
    else {
      if (/\.\d{2}$/.test(amountStr)) return; // two decimals max
      const next = amountStr === "0" ? k : amountStr + k;
      if (Number(next) > MAX_SOL) return;
      amountStr = next;
    }
    onAmount();
  }

  function onAmount() {
    const n = amountNum();
    const el = document.getElementById("amount");
    if (!el) return;
    el.innerHTML = `<span class="cur">S/</span>${esc(amountStr)}`;
    document.getElementById("usd").textContent = usdRef(n);
    view().querySelectorAll(".chip").forEach((c) => c.classList.toggle("on", c.dataset.v === amountStr));
    const ok = n >= MIN_SOL && n <= MAX_SOL;
    const btn = document.getElementById("payBtn");
    btn.disabled = !ok;
    btn.textContent = t("payBtn", { x: fmtSol(n) });
    document.getElementById("payNote").textContent = ok ? "" : t("range", { min: fmtSol(MIN_SOL), max: fmtSol(MAX_SOL) });
    clearTimeout(previewTimer);
    if (ok) previewTimer = setTimeout(refreshSplit, 250);
    else document.getElementById("split").textContent = "";
  }

  async function refreshSplit() {
    const split = document.getElementById("split");
    if (!split) return;
    const asked = amountStr;
    try {
      const [retained, net] = await yafi.previewSale(CFG.merchant, weiFromSoles(amountNum()));
      if (asked !== amountStr || !document.getElementById("split")) return; // amount changed meanwhile
      split.innerHTML = retained > 0n
        ? `<span>${t("rosaGets")} <b>${soles(net)}</b></span><span class="dot">·</span><span class="loan">${t("loanGets")} <b>${soles(retained)}</b></span>`
        : `<span>${t("noLoan")}</span>`;
    } catch (e) {
      split.textContent = friendlyError(e);
    }
  }

  function overlay(text) {
    const o = document.getElementById("overlay");
    if (!o) return;
    o.hidden = !text;
    if (text) document.getElementById("overlayText").textContent = text;
  }

  async function pay() {
    const note = document.getElementById("payNote");
    const sol = amountNum();
    try {
      const wei = weiFromSoles(sol);
      overlay(t("preparing"));
      // Monad reserve-balance rule: a low-balance account may only spend if it sent no other
      // transaction in the last 3 blocks (~1.2 s), so space out back-to-back payments.
      const wait = lastPayAt + 2500 - Date.now();
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      // Monad charges gas on the gas limit, not on gas used, so keep a generous margin.
      const ok = await ensureFunds(wei + ethers.parseEther("0.03"));
      if (!ok) return renderNeedFunds();
      overlay(t("paying"));
      const t0 = performance.now();
      const tx = await yafi.connect(getCustomer()).processSale(CFG.merchant, { value: wei });
      const rcpt = await tx.wait();
      lastPayAt = Date.now();
      if (currentRoute() !== "pagar") return; // the user navigated away meanwhile
      renderPaid(sol, rcpt, ((performance.now() - t0) / 1000).toFixed(1), tx.hash);
    } catch (e) {
      overlay(null);
      if (note) note.textContent = friendlyError(e);
    }
  }

  function splitFromReceipt(rcpt, wei) {
    let retained = 0n, net = wei;
    for (const log of rcpt.logs) {
      try {
        const p = yafi.interface.parseLog(log);
        if (p && p.name === "SaleProcessed") { retained = p.args.retained; net = p.args.netToMerchant; }
      } catch (e) { /* other event */ }
    }
    return { retained, net };
  }

  function renderPaid(sol, rcpt, secs, hash) {
    const { retained, net } = splitFromReceipt(rcpt, weiFromSoles(sol));
    const when = new Date().toLocaleString(lang === "es" ? "es-PE" : "en-US", { dateStyle: "medium", timeStyle: "short" });
    const opNum = hash.slice(2, 10).toUpperCase(); // short, human operation number
    view().innerHTML = `
      <section class="receipt">
        <svg class="check" viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="24"/><path d="M15 27l7 7 15-15"/></svg>
        <h2>${t("paidTitle")}</h2>
        <div class="receipt-amount">${fmtSol(sol)}</div>
        ${usdRef(sol) ? `<div class="muted small">${usdRef(sol)}</div>` : ""}
        <p class="muted">${t("paidTo")} <b>${t("shopName")}</b></p>
        <div class="receipt-rows">
          <div class="row"><span>${t("rosaGets")}</span><b>${soles(net)}</b></div>
          <div class="row loan"><span>${t("loanGets")}</span><b>${soles(retained)}</b></div>
          <div class="row"><span>${t("opNumber")}</span><b>${opNum}</b></div>
          <div class="row"><span>${t("date")}</span><b>${esc(when)}</b></div>
        </div>
        <p><span class="badge">⚡ ${t("paidTime", { s: secs })}</span></p>
        <p class="small"><a href="${CFG.explorer}/tx/${hash}" target="_blank" rel="noopener">${t("receipt")}</a></p>
      </section>
      <button class="btn btn-primary" id="againBtn" type="button">${t("payAgain")}</button>
      <a class="btn btn-secondary" href="#/rosa">${t("seeRosa")}</a>`;
    document.getElementById("againBtn").addEventListener("click", renderPay);
  }

  // Shown only when no automatic test balance is available (no sponsor configured).
  function renderNeedFunds() {
    const addr = getCustomer().address;
    view().innerHTML = `
      <div class="pay-top"><a href="#/" class="back">${t("back")}</a></div>
      <section class="card center">
        <div class="big-ico">🎟️</div>
        <h2>${t("needFunds")}</h2>
        <p class="muted">${t("needFundsHelp")}</p>
        <button class="btn btn-primary" id="copyBtn" type="button">${t("copy")}</button>
        <button class="btn btn-secondary" id="againBtn" type="button">${t("payAgain")}</button>
      </section>
      <details class="card">
        <summary class="muted small">${t("orWallet")}</summary>
        <button class="btn btn-secondary" id="walletBtn" type="button" style="margin-top:12px">${t("payWallet", { x: fmtSol(amountNum()) })}</button>
        <p class="muted small" id="walletNote"></p>
      </details>`;
    document.getElementById("againBtn").addEventListener("click", renderPay);
    document.getElementById("walletBtn").addEventListener("click", payWithWallet);
    document.getElementById("copyBtn").addEventListener("click", async (ev) => {
      try { await navigator.clipboard.writeText(addr); ev.target.textContent = t("copied"); } catch (e) { toast(addr); }
    });
  }

  // Fallback for visitors who already have MetaMask (e.g. a judge): pay from their own wallet.
  async function payWithWallet() {
    const btn = document.getElementById("walletBtn");
    const note = document.getElementById("walletNote");
    const sol = amountNum();
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span>${t("paying")}`;
    try {
      const signer = await connectWallet();
      const t0 = performance.now();
      const tx = await yafi.connect(signer).processSale(CFG.merchant, { value: weiFromSoles(sol) });
      const rcpt = await provider.waitForTransaction(tx.hash);
      renderPaid(sol, rcpt, ((performance.now() - t0) / 1000).toFixed(1), tx.hash);
    } catch (e) {
      btn.disabled = false;
      btn.textContent = t("payWallet", { x: fmtSol(sol) });
      note.textContent = friendlyError(e);
    }
  }

  // Rosa (merchant)
  const seen = new Set();
  let feedItems = [];
  let fromBlock = null;

  async function renderRosa() {
    if (!configured) return notConfigured();
    view().innerHTML = `
      <p><a href="#/">${t("back")}</a></p>
      <section class="card hero">
        <div class="merchant-head"><div class="avatar">🥪</div><div><div class="name">${t("hello")}</div><div class="sub">${t("shopSub")}</div></div></div>
        <div id="loan" style="margin-top:18px"><span class="spinner"></span></div>
      </section>
      <section class="card">
        <h2>${t("liveSales")}</h2>
        <ul class="feed" id="feed"></ul>
      </section>`;
    renderFeed();
    await refreshLoan();
    await pollSales();
    timers.push(setInterval(refreshLoan, 3000));
    timers.push(setInterval(pollSales, 3000));
  }

  async function refreshLoan() {
    const el = document.getElementById("loan");
    if (!el) return;
    try {
      const m = await readMerchant(CFG.merchant);
      const pct = Number(await yafi.repaymentProgressBps(CFG.merchant)) / 100;
      if (m.totalGranted === 0n) {
        const first = m.limit ? `<p class="small">${t("firstLoan", { x: soles(m.limit) })}</p>` : "";
        el.innerHTML = `<p class="muted">${t("noLoanYet")}</p>${first}`;
        return;
      }
      // Credit ladder (v2): once repaid, show how big the next loan can be
      const next = m.limit ? `<p class="small">${t("nextLoan", { x: "<b>" + soles(m.limit) + "</b>" })}</p>` : "";
      const top = m.creditBalance === 0n
        ? `<p><span class="badge">🎉 ${t("fullyPaid")}</span></p>${next}`
        : `<div class="label">${t("owe")}</div><div class="big">${soles(m.creditBalance)}</div>`;
      el.innerHTML = `
        ${top}
        <div class="bar"><span style="width:${Math.min(100, pct)}%"></span></div>
        <div class="row small" style="display:flex;justify-content:space-between">
          <span class="grad-text" style="font-weight:700">${t("paidPct", { p: pct.toFixed(1) })}</span>
          <span class="muted">${t("loanOf", { x: soles(m.currentLoan), r: (Number(m.retentionBps) / 100).toFixed(0) })}</span>
        </div>
        <div class="stats" style="margin-top:14px">
          <div class="stat"><span class="muted small">${t("salesYafi")}</span><b>${m.salesCount}</b></div>
          <div class="stat"><span class="muted small">${t("repaid")}</span><b>${soles(m.totalRepaid)}</b></div>
        </div>`;
    } catch (e) {
      el.innerHTML = `<p class="muted small">${esc(friendlyError(e))}</p>`;
    }
  }

  async function pollSales() {
    try {
      const latest = await provider.getBlockNumber();
      // Start near the tip, and jump forward if we fell far behind (tab hidden, view left)
      if (fromBlock === null || latest - fromBlock > 200) fromBlock = Math.max(0, latest - 90);
      if (latest < fromBlock) return;
      const to = Math.min(latest, fromBlock + 99); // public RPCs cap the block range
      const logs = await yafi.queryFilter(yafi.filters.SaleProcessed(CFG.merchant), fromBlock, to);
      fromBlock = to + 1;
      let added = false;
      for (const l of logs) {
        const id = l.transactionHash + ":" + l.index;
        if (seen.has(id)) continue;
        seen.add(id);
        feedItems.unshift({ amount: l.args.amount, retained: l.args.retained, at: Date.now(), fresh: true });
        added = true;
      }
      feedItems = feedItems.slice(0, 15);
      if (added) renderFeed();
    } catch (e) {
      console.warn("pollSales", e);
    }
  }

  function renderFeed() {
    const el = document.getElementById("feed");
    if (!el) return;
    if (!feedItems.length) { el.innerHTML = `<li class="muted small">${t("waitingSales")}</li>`; return; }
    el.innerHTML = feedItems.map((f) => `
      <li class="${f.fresh ? "new" : ""}">
        <span>${t("saleRow", { x: soles(f.amount) })}<br /><span class="loan">${t("saleLoan", { x: soles(f.retained) })}</span></span>
        <span class="amt">+${soles(f.amount - f.retained)}</span>
      </li>`).join("");
    feedItems.forEach((f) => { f.fresh = false; });
  }

  // Admin (lender)
  let adminSigner = null;
  async function renderAdmin() {
    view().innerHTML = `
      <p><a href="#/">${t("back")}</a></p>
      <section class="card">
        <h2>${t("adminTitle")}</h2>
        <p class="muted small">${t("adminLead")}</p>
        <button class="btn btn-primary" id="connectBtn" type="button">${t("connect")}</button>
        <p class="mono" id="who"></p>
        <p><span class="label">${t("treasury")}</span><br /><b id="treas">…</b></p>
      </section>
      <section class="card">
        <h2>${t("grantTitle")}</h2>
        <p class="muted small" id="line"></p>
        <label class="field"><span>${t("amountSoles")}</span><input id="gAmt" type="number" min="1" value="500" /></label>
        <label class="field"><span>${t("retention")}</span><input id="gRet" type="number" min="1" max="30" value="10" /></label>
        <button class="btn btn-secondary" id="grantBtn" type="button">${t("grantBtn")}</button>
      </section>
      <section class="card">
        <h2>${t("fundTitle")}</h2>
        <label class="field"><span>${t("address")}</span><input id="fAddr" placeholder="0x…" /></label>
        <button class="btn btn-secondary" id="fundBtn" type="button">${t("fundBtn", { x: CFG.starterMon })}</button>
      </section>`;
    const showTreasury = async () => {
      try { const tr = await yafi.treasury(); document.getElementById("treas").textContent = soles(tr) + "  (" + ethers.formatEther(tr) + " MON)"; } catch (e) { /* contract not reachable yet */ }
    };
    // Credit ladder (v2): show how much Rosa can borrow now
    const showLine = async () => {
      try {
        const m = await readMerchant(CFG.merchant);
        const el = document.getElementById("line");
        if (!el || m.limit === null) return;
        el.textContent = m.limit > 0n ? t("availableLine", { x: soles(m.limit) }) : t("noLineYet");
        if (m.limit > 0n) document.getElementById("gAmt").value = Math.floor(Number(ethers.formatEther(m.limit)) / CFG.monPerSol);
      } catch (e) { /* contract not reachable yet */ }
    };
    showTreasury();
    showLine();
    document.getElementById("connectBtn").addEventListener("click", async () => {
      try {
        adminSigner = await connectWallet();
        document.getElementById("who").textContent = await adminSigner.getAddress();
      } catch (e) { toast(friendlyError(e)); }
    });
    const run = async (btnId, fn) => {
      const b = document.getElementById(btnId);
      if (!adminSigner) return toast(t("connect"));
      const label = b.textContent;
      b.disabled = true;
      b.innerHTML = `<span class="spinner"></span>${label}`;
      try { const tx = await fn(); await tx.wait(); toast(t("done")); showTreasury(); showLine(); }
      catch (e) { toast(friendlyError(e)); }
      finally { b.disabled = false; b.textContent = label; }
    };
    document.getElementById("grantBtn").addEventListener("click", () => run("grantBtn", () => {
      const sol = Number(document.getElementById("gAmt").value);
      const bps = Math.round(Number(document.getElementById("gRet").value) * 100);
      return yafi.connect(adminSigner).grantCredit(CFG.merchant, weiFromSoles(sol), bps);
    }));
    document.getElementById("fundBtn").addEventListener("click", () => run("fundBtn", () => {
      const to = document.getElementById("fAddr").value.trim();
      return adminSigner.sendTransaction({ to: ethers.getAddress(to), value: ethers.parseEther(CFG.starterMon) });
    }));
  }

  // ---------- Router ----------
  function route() {
    clearTimers();
    const h = location.hash.replace(/^#\/?/, "");
    if (h === "pagar") renderPay();
    else if (h === "rosa") renderRosa();
    else if (h === "admin") renderAdmin();
    else renderHome();
    document.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = t(el.dataset.i18n); });
    document.getElementById("lang").textContent = lang === "es" ? "EN" : "ES";
    document.documentElement.lang = lang;
    window.scrollTo(0, 0);
  }

  document.getElementById("lang").addEventListener("click", () => {
    lang = lang === "es" ? "en" : "es";
    store.set("yafi_lang", lang);
    route();
  });
  window.addEventListener("hashchange", route);
  route();
})();
