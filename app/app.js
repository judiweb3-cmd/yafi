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

  const ABI = [
    "function owner() view returns (address)",
    "function treasury() view returns (uint256)",
    "function merchants(address) view returns (uint256 creditBalance, uint256 totalGranted, uint256 totalRepaid, uint256 salesCount, uint16 retentionBps, bool isActive)",
    "function previewSale(address merchant, uint256 amount) view returns (uint256 retained, uint256 netToMerchant)",
    "function repaymentProgressBps(address merchant) view returns (uint256)",
    "function processSale(address merchant) payable",
    "function grantCredit(address merchant, uint256 amount, uint16 retentionBps)",
    "function fundTreasury() payable",
    "event SaleProcessed(address indexed merchant, address indexed payer, uint256 amount, uint256 retained, uint256 netToMerchant)",
    "event CreditFullyRepaid(address indexed merchant, uint256 totalRepaid)"
  ];

  // No cache (balances change every block) and fast polling: Monad confirms in under a second
  const provider = new ethers.JsonRpcProvider(CFG.rpcUrl, CFG.chainId, { staticNetwork: true, cacheTimeout: -1, pollingInterval: 500 });
  const yafi = new ethers.Contract(CFG.contract, ABI, provider);
  const configured = CFG.contract !== ethers.ZeroAddress && CFG.merchant !== ethers.ZeroAddress;

  // ---------- Language ----------
  const T = {
    es: {
      footer: "Demo en Monad Testnet · montos de prueba, no es dinero real",
      heroTitle: "Tus ventas son tu crédito",
      heroLead: "Microcrédito para comerciantes que se paga solo: una pequeña parte de cada venta abona al préstamo.",
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
      preparing: "Preparando tu cuenta…",
      paying: "Procesando pago…",
      paidTitle: "¡Pago enviado!",
      paidDetail: "Rosa recibió {net} y {ret} fueron a su préstamo.",
      paidTime: "Confirmado en {s} s",
      receipt: "Ver comprobante",
      payAgain: "Pagar otra vez",
      seeRosa: "Ver lo que ve Rosa",
      needFunds: "Tu cuenta de prueba aún no tiene saldo.",
      needFundsHelp: "Pásale este código al equipo de YAFI para que te envíe saldo de prueba:",
      copy: "Copiar código", copied: "Copiado",
      noWallet: "No encontramos MetaMask en este navegador.",
      orWallet: "¿Tienes MetaMask con MON de prueba? Paga directo desde tu billetera:",
      payWallet: "Pagar {x} con mi billetera",
      hello: "Hola, Rosa",
      owe: "Te falta pagar",
      paidPct: "{p}% pagado",
      loanOf: "Préstamo de {x} · {r}% de cada venta",
      salesYafi: "Ventas con YAFI", repaid: "Ya pagaste",
      noLoanYet: "Todavía no tienes un préstamo activo.",
      fullyPaid: "¡Préstamo pagado! Tu buen historial ya cuenta para un préstamo mayor.",
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
      footer: "Demo on Monad Testnet · test amounts, not real money",
      heroTitle: "Your sales are your credit",
      heroLead: "Microcredit for merchants that repays itself: a small part of every sale goes to the loan.",
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
      preparing: "Setting up your account…",
      paying: "Processing payment…",
      paidTitle: "Payment sent!",
      paidDetail: "Rosa received {net} and {ret} went to her loan.",
      paidTime: "Confirmed in {s} s",
      receipt: "View receipt",
      payAgain: "Pay again",
      seeRosa: "See what Rosa sees",
      needFunds: "Your test account has no balance yet.",
      needFundsHelp: "Send this code to the YAFI team so they can send you test funds:",
      copy: "Copy code", copied: "Copied",
      noWallet: "MetaMask was not found in this browser.",
      orWallet: "Have MetaMask with testnet MON? Pay straight from your wallet:",
      payWallet: "Pay {x} with my wallet",
      hello: "Hi, Rosa",
      owe: "Left to repay",
      paidPct: "{p}% repaid",
      loanOf: "Loan of {x} · {r}% of each sale",
      salesYafi: "Sales with YAFI", repaid: "Repaid so far",
      noLoanYet: "You don't have an active loan yet.",
      fullyPaid: "Loan repaid! Your good record now counts toward a bigger loan.",
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
  function friendlyError(e) {
    console.error(e);
    const m = (e && (e.shortMessage || e.reason || e.message)) || "";
    const yafiMsg = m.match(/YAFI: [^"']+/);
    return yafiMsg ? yafiMsg[0] : t("error");
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
    if (!CFG.sponsorKey) return false;
    const sponsor = new ethers.Wallet(CFG.sponsorKey, provider);
    const tx = await sponsor.sendTransaction({ to: c.address, value: ethers.parseEther(CFG.starterMon) });
    await tx.wait();
    return true;
  }

  // ---------- Views ----------
  const view = () => document.getElementById("view");
  let timers = [];
  function clearTimers() { timers.forEach(clearInterval); timers = []; }

  function renderHome() {
    view().innerHTML = `
      <section class="card hero">
        <h1><span class="grad-text">${t("heroTitle")}</span></h1>
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

  // Customer
  let amount = 10;
  async function renderPay() {
    if (!configured) return notConfigured();
    view().innerHTML = `
      <p><a href="#/">${t("back")}</a></p>
      <section class="card">
        ${merchantHeader()}
        <h2 style="margin-top:18px">${t("payTitle")}</h2>
        <div class="chips">
          ${[5, 10, 20].map((v) => `<button class="chip ${v === amount ? "on" : ""}" data-v="${v}" type="button">S/ ${v}</button>`).join("")}
        </div>
        <div class="split" id="split"><div class="muted small"><span class="spinner"></span></div></div>
        <button class="btn btn-primary" id="payBtn" type="button">${t("payBtn", { x: "S/ " + amount.toFixed(2) })}</button>
        <p class="muted small" id="payNote"></p>
      </section>`;
    view().querySelectorAll(".chip").forEach((b) => b.addEventListener("click", () => { amount = Number(b.dataset.v); renderPay(); }));
    document.getElementById("payBtn").addEventListener("click", pay);
    try {
      const wei = weiFromSoles(amount);
      const [retained, net] = await yafi.previewSale(CFG.merchant, wei);
      const split = document.getElementById("split");
      if (!split) return;
      split.innerHTML = retained > 0n
        ? `<div class="row"><span>${t("rosaGets")}</span><b>${soles(net)}</b></div>
           <div class="row loan"><span>${t("loanGets")}</span><b>${soles(retained)}</b></div>`
        : `<div class="muted small">${t("noLoan")}</div>`;
    } catch (e) {
      document.getElementById("split").innerHTML = `<div class="muted small">${esc(friendlyError(e))}</div>`;
    }
  }

  async function pay() {
    const btn = document.getElementById("payBtn");
    const note = document.getElementById("payNote");
    btn.disabled = true;
    try {
      const wei = weiFromSoles(amount);
      btn.innerHTML = `<span class="spinner"></span>${t("preparing")}`;
      // Monad charges gas on the gas limit, not on gas used, so keep a generous margin.
      const ok = await ensureFunds(wei + ethers.parseEther("0.03"));
      if (!ok) return renderNeedFunds();
      btn.innerHTML = `<span class="spinner"></span>${t("paying")}`;
      const t0 = performance.now();
      const tx = await yafi.connect(getCustomer()).processSale(CFG.merchant, { value: wei });
      const rcpt = await tx.wait();
      const secs = ((performance.now() - t0) / 1000).toFixed(1);
      let retained = 0n, net = wei;
      for (const log of rcpt.logs) {
        try {
          const p = yafi.interface.parseLog(log);
          if (p && p.name === "SaleProcessed") { retained = p.args.retained; net = p.args.netToMerchant; }
        } catch (e) { /* other event */ }
      }
      renderPaid(net, retained, secs, tx.hash);
    } catch (e) {
      btn.disabled = false;
      btn.textContent = t("payBtn", { x: "S/ " + amount.toFixed(2) });
      note.textContent = friendlyError(e);
    }
  }

  function renderPaid(net, retained, secs, hash) {
    view().innerHTML = `
      <section class="card done">
        <div class="check">✓</div>
        <h2>${t("paidTitle")}</h2>
        <p>${t("paidDetail", { net: "<b>" + soles(net) + "</b>", ret: "<b class='grad-text'>" + soles(retained) + "</b>" })}</p>
        <p><span class="badge">⚡ ${t("paidTime", { s: secs })}</span></p>
        <p class="small"><a href="${CFG.explorer}/tx/${hash}" target="_blank" rel="noopener">${t("receipt")}</a></p>
      </section>
      <button class="btn btn-primary" id="againBtn" type="button">${t("payAgain")}</button>
      <a class="btn btn-secondary" href="#/rosa">${t("seeRosa")}</a>`;
    document.getElementById("againBtn").addEventListener("click", renderPay);
  }

  function renderNeedFunds() {
    const addr = getCustomer().address;
    view().innerHTML = `
      <p><a href="#/">${t("back")}</a></p>
      <section class="card">
        <h2>${t("needFunds")}</h2>
        <p class="muted">${t("needFundsHelp")}</p>
        <p class="mono">${addr}</p>
        <button class="btn btn-secondary" id="copyBtn" type="button">${t("copy")}</button>
      </section>
      <button class="btn btn-primary" id="againBtn" type="button">${t("payAgain")}</button>
      <section class="card" style="margin-top:14px">
        <p class="muted small">${t("orWallet")}</p>
        <button class="btn btn-secondary" id="walletBtn" type="button">${t("payWallet", { x: "S/ " + amount.toFixed(2) })}</button>
        <p class="muted small" id="walletNote"></p>
      </section>`;
    document.getElementById("againBtn").addEventListener("click", renderPay);
    document.getElementById("walletBtn").addEventListener("click", payWithWallet);
    document.getElementById("copyBtn").addEventListener("click", async (ev) => {
      try { await navigator.clipboard.writeText(addr); ev.target.textContent = t("copied"); } catch (e) { /* no clipboard */ }
    });
  }

  // Fallback for visitors who already have MetaMask (e.g. a judge): pay from their own wallet.
  async function payWithWallet() {
    const btn = document.getElementById("walletBtn");
    const note = document.getElementById("walletNote");
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span>${t("paying")}`;
    try {
      if (!window.ethereum) throw new Error(t("noWallet"));
      const bp = new ethers.BrowserProvider(window.ethereum);
      await bp.send("eth_requestAccounts", []);
      try {
        await bp.send("wallet_switchEthereumChain", [{ chainId: "0x" + CFG.chainId.toString(16) }]);
      } catch (e) { /* user switches network manually */ }
      const signer = await bp.getSigner();
      const wei = weiFromSoles(amount);
      const t0 = performance.now();
      const tx = await yafi.connect(signer).processSale(CFG.merchant, { value: wei });
      const rcpt = await provider.waitForTransaction(tx.hash);
      const secs = ((performance.now() - t0) / 1000).toFixed(1);
      let retained = 0n, net = wei;
      for (const log of rcpt.logs) {
        try {
          const p = yafi.interface.parseLog(log);
          if (p && p.name === "SaleProcessed") { retained = p.args.retained; net = p.args.netToMerchant; }
        } catch (e) { /* other event */ }
      }
      renderPaid(net, retained, secs, tx.hash);
    } catch (e) {
      btn.disabled = false;
      btn.textContent = t("payWallet", { x: "S/ " + amount.toFixed(2) });
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
      const m = await yafi.merchants(CFG.merchant);
      const pct = Number(await yafi.repaymentProgressBps(CFG.merchant)) / 100;
      if (m.totalGranted === 0n) {
        el.innerHTML = `<p class="muted">${t("noLoanYet")}</p>`;
        return;
      }
      const top = m.creditBalance === 0n
        ? `<p><span class="badge">🎉 ${t("fullyPaid")}</span></p>`
        : `<div class="label">${t("owe")}</div><div class="big">${soles(m.creditBalance)}</div>`;
      el.innerHTML = `
        ${top}
        <div class="bar"><span style="width:${Math.min(100, pct)}%"></span></div>
        <div class="row small" style="display:flex;justify-content:space-between">
          <span class="grad-text" style="font-weight:700">${t("paidPct", { p: pct.toFixed(1) })}</span>
          <span class="muted">${t("loanOf", { x: soles(m.totalGranted), r: (Number(m.retentionBps) / 100).toFixed(0) })}</span>
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
      if (fromBlock === null) fromBlock = Math.max(0, latest - 90);
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
      try { document.getElementById("treas").textContent = soles(await yafi.treasury()) + "  (" + ethers.formatEther(await yafi.treasury()) + " MON)"; } catch (e) { /* contract not reachable yet */ }
    };
    showTreasury();
    document.getElementById("connectBtn").addEventListener("click", async () => {
      try {
        if (!window.ethereum) throw new Error(t("noWallet"));
        const bp = new ethers.BrowserProvider(window.ethereum);
        await bp.send("eth_requestAccounts", []);
        try {
          await bp.send("wallet_switchEthereumChain", [{ chainId: "0x" + CFG.chainId.toString(16) }]);
        } catch (e) { /* user switches network manually */ }
        adminSigner = await bp.getSigner();
        document.getElementById("who").textContent = await adminSigner.getAddress();
      } catch (e) { toast(friendlyError(e)); }
    });
    const run = async (btnId, fn) => {
      const b = document.getElementById(btnId);
      if (!adminSigner) return toast(t("connect"));
      const label = b.textContent;
      b.disabled = true;
      b.innerHTML = `<span class="spinner"></span>${label}`;
      try { const tx = await fn(); await tx.wait(); toast(t("done")); showTreasury(); }
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
