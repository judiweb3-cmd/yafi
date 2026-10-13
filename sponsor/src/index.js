// YAFI sponsor: sends a small amount of TESTNET MON to new demo visitors so they can pay
// without ever seeing a wallet. The private key is a Cloudflare secret (SPONSOR_KEY),
// never stored in this repository.
import { ethers } from "ethers";

const CHAIN_ID = 10143; // Monad Testnet

function json(body, status, headers) {
  return new Response(JSON.stringify(body), { status, headers: { ...headers, "Content-Type": "application/json" } });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const allowed = (env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
    const cors = {
      "Access-Control-Allow-Origin": allowed.includes(origin) ? origin : allowed[0] || "",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Vary": "Origin"
    };
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405, cors);
    if (!allowed.includes(origin)) return json({ error: "origin_not_allowed" }, 403, cors);

    let address;
    try {
      address = ethers.getAddress((await request.json()).address);
    } catch (e) {
      return json({ error: "bad_address" }, 400, cors);
    }

    const provider = new ethers.JsonRpcProvider(env.RPC_URL, Number(env.CHAIN_ID || CHAIN_ID), { staticNetwork: true });
    const amount = ethers.parseEther(env.STARTER_MON || "0.1");
    try {
      // Only top up accounts below one starter amount, so one visitor cannot drain the sponsor.
      // The app asks for help only when a payment plus gas (at most 0.08) does not fit.
      if ((await provider.getBalance(address)) >= amount) return json({ ok: true, funded: false }, 200, cors);
      const wallet = new ethers.Wallet(env.SPONSOR_KEY, provider);
      const tx = await wallet.sendTransaction({ to: address, value: amount });
      return json({ ok: true, funded: true, tx: tx.hash }, 200, cors);
    } catch (e) {
      return json({ error: "sponsor_failed" }, 502, cors);
    }
  }
};
