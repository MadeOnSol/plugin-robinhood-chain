// Basic smoke test — run after `npm run build`: node test/smoke.mjs
// No network: exercises construction, action registration, and the no-key guard.
import assert from "node:assert";
import plugin, { RobinhoodChainClient, robinhoodChainPlugin } from "../dist/index.js";

// Plugin shape
assert.equal(plugin, robinhoodChainPlugin, "default export is the plugin");
assert.equal(plugin.name, "robinhood-chain");
assert.equal(plugin.actions.length, 14, "expected 14 RHC actions");

const names = plugin.actions.map((a) => a.name);
assert.equal(new Set(names).size, 14, "action names must be unique");
for (const a of plugin.actions) {
  assert.ok(typeof a.handler === "function", `${a.name} has a handler`);
  assert.ok(typeof a.validate === "function", `${a.name} has a validate`);
  assert.ok(a.description && a.description.length > 0, `${a.name} has a description`);
}

// Client method surface (14 endpoints)
const client = new RobinhoodChainClient({ apiKey: "msk_test" });
for (const m of [
  "getKolFeed", "getKolLeaderboard", "getKolHotTokens", "getKol",
  "getTrades", "getTokens", "getToken", "getTokenCandles",
  "getTokenKolConsensus", "getTokenBuyerQuality", "getTokenBundle",
  "getDeployerLeaderboard", "getDeployer", "getAlphaWallets",
]) {
  assert.ok(typeof client[m] === "function", `client.${m} exists`);
}

// No-key guard returns a 401 result rather than throwing / hitting network
const noKey = new RobinhoodChainClient();
const res = await noKey.getKolFeed();
assert.equal(res.status, 401, "no key → 401");
assert.ok(res.error && res.error.includes("developer"), "401 error points to /developer");

console.log("plugin-robinhood-chain smoke test: OK (14 actions, 14 client methods, no-key guard)");
