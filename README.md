# @madeonsol/plugin-robinhood-chain

[![npm version](https://img.shields.io/npm/v/@madeonsol/plugin-robinhood-chain?style=flat-square)](https://www.npmjs.com/package/@madeonsol/plugin-robinhood-chain)
[![npm downloads](https://img.shields.io/npm/dm/@madeonsol/plugin-robinhood-chain?style=flat-square)](https://www.npmjs.com/package/@madeonsol/plugin-robinhood-chain)
[![ElizaOS](https://img.shields.io/badge/ElizaOS-plugin-blueviolet?style=flat-square)](https://github.com/elizaOS/eliza)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](LICENSE)

> 🤖 **[Robinhood Chain API](https://madeonsol.com/robinhood)** · 📚 **[API docs](https://madeonsol.com/api-docs)** · 💰 **[Free API key](https://madeonsol.com/pricing)** · 🤖 **[ElizaOS](https://github.com/elizaOS/eliza)**

**ElizaOS plugin for the Robinhood Chain API** — EVM-native, on-chain trading intelligence for **Robinhood Chain (chain id 4663)**. Give your ElizaOS agent live KOL trades, KOL coordination and first touches, token discovery and batch lookups, launch-bundle detection, buyer-quality scoring, deployer reputation with trajectory/history/alerts, the DEX trade tape, smart-money wallet rankings, and the RHC **rule engine** — all from [MadeOnSol](https://madeonsol.com)'s self-hosted RHC node.

> **0.5.0** — version alignment with the wider RHC SDK release: the stream channel names were corrected in the TS/Python/Rust SDKs (the RHC firehose channel is `rhc:dex_trades`; the server accepts `rhc:trades` only as a deprecated alias of it). This plugin's actions are REST-only, so nothing here changed behavior.

> **New in 0.6.0 — wallet intelligence.** Ten new operations covering the Robinhood Chain wallet surface, which had no SDK binding at all until now: six new actions — `GET_RHC_WALLET`, `GET_RHC_WALLET_PNL`, `GET_RHC_WALLET_POSITIONS`, `GET_RHC_WALLET_TRADES`, `MANAGE_RHC_WALLET_TRACKER` (list / add / remove / relabel in one action) and `GET_RHC_WALLET_TRACKER_FEED` (merged tape or per-wallet rollup). Everything is **ETH**-denominated, and cost basis is FIFO over a rolling 90-day window — `cost_basis_observable_from` names the date the window opens, so a position opened before it reads as a sell with no matching buy. The profile / PnL / positions trio shares ONE snapshot cache server-side, so calling all three on an address costs roughly one computation rather than three; `cache_hit` says which call paid for it. Watchlist quotas are **per chain** (PRO 50 / ULTRA 100 / BUSINESS 500 RHC wallets), independent of your Solana list.

> **New in 0.4.0 — the rule engine: 52 endpoints (was 30).** 22 new operations let your agent create and manage server-side rules that push signals to a webhook or WebSocket: **copy-trade rules** (watch up to 250 source wallets, ETH-denominated sizing), **price alerts** (market-cap drop + optional recovery leg), **KOL coordination alerts** (N+ KOLs on one token in a window) and **first-touch subscriptions** (the first tracked-KOL buy on a token). Rules are data, never execution — a fired rule delivers a *suggested* size, it never places an order. Every quota is **per chain**: a full set of Solana rules does not consume RHC capacity.
>
> Earlier: deployer intelligence deepened — `trajectory` (is this deployer improving or declining), the paginated `tokens` launch list, `history`, chain-wide `stats`, the `alerts` feed and `best-tokens` from reputable deployers only. Plus KOL `coordination` and `first-touches`, and two batch endpoints (50 tokens per price lookup, 20 per buyer-quality scoring) that count as one request each.

> Robinhood Chain intelligence, EVM-native: track Solana KOLs' verified RHC wallets (recovered by tracing their Solana→EVM bridge deposits — a dataset unique to MadeOnSol), rank 99k+ RHC deployers by graduation/runner rate, detect same-block launch bundles and score early-buyer cohorts, and stream the Uniswap v2/v3/v4 trade tape with the effective trader EOA (`tx.from`, or the ERC-4337 userOp sender when bundled — never the bundler or the router). Every field is EVM-native — `token_address` (lowercase `0x`), `eth_amount`, `tx_hash`, `block_number`, `net_flow_eth`. **Same `msk_` API key, same base URL, bundled into every tier at no extra cost.** Get a free key at [madeonsol.com/pricing](https://madeonsol.com/pricing).

## Quick start (10 seconds)

```bash
npm install @madeonsol/plugin-robinhood-chain
```

```ts
import { robinhoodChainPlugin } from "@madeonsol/plugin-robinhood-chain";
const agent = {
  plugins: [robinhoodChainPlugin],
  settings: { ROBINHOOD_CHAIN_API_KEY: "msk_..." }, // free key at https://madeonsol.com/pricing
};
// Then ask the agent: "What are KOLs buying on Robinhood Chain right now?"
```

## Authentication

This plugin is **key-mode only** — a single MadeOnSol API key (`msk_`, Bearer). Robinhood Chain does have a keyless x402 pay-per-call rail (a narrow 6-endpoint subset, dual-accept USDG-on-RHC or USDC-on-Solana — see [madeonsol.com/robinhood/x402](https://madeonsol.com/robinhood/x402)), but it is **not** wired into this plugin.

| Setting | Notes |
|---|---|
| `ROBINHOOD_CHAIN_API_KEY` | Your `msk_` key. [Get a free one](https://madeonsol.com/pricing) — the same key already covers the Solana API. |
| `MADEONSOL_API_KEY` | Fallback — used if `ROBINHOOD_CHAIN_API_KEY` is unset. |
| `ROBINHOOD_CHAIN_API_URL` | Optional base URL. Default `https://madeonsol.com`. |

## What it does

Gives your ElizaOS agent access to MadeOnSol's Robinhood Chain intelligence API. Every action maps to one real `/rhc/*` endpoint.

| Action | Endpoint | Tier |
|---|---|---|
| `GET_RHC_KOL_FEED` | `GET /rhc/kol/feed` | BASIC+ |
| `GET_RHC_KOL_LEADERBOARD` | `GET /rhc/kol/leaderboard` | BASIC+ |
| `GET_RHC_KOL_HOT_TOKENS` | `GET /rhc/kol/hot-tokens` | BASIC+ |
| `GET_RHC_KOL_PROFILE` | `GET /rhc/kol/{wallet}` | BASIC+ |
| `GET_RHC_KOL_COORDINATION` | `GET /rhc/kol/coordination` | BASIC+ |
| `GET_RHC_KOL_FIRST_TOUCHES` | `GET /rhc/kol/first-touches` | BASIC+ |
| `GET_RHC_TRADES` | `GET /rhc/trades` | PRO+ |
| `GET_RHC_TOKENS` | `GET /rhc/tokens` | PRO+ |
| `GET_RHC_TOKEN` | `GET /rhc/tokens/{address}` | BASIC+ |
| `GET_RHC_TOKEN_BATCH` | `POST /rhc/token/batch` (max 50) | BASIC+ |
| `GET_RHC_TOKEN_CANDLES` | `GET /rhc/tokens/{address}/candles` | PRO+ |
| `GET_RHC_KOL_CONSENSUS` | `GET /rhc/tokens/{address}/kol-consensus` | PRO+ |
| `GET_RHC_BUYER_QUALITY` | `GET /rhc/tokens/{address}/buyer-quality` | BASIC+ |
| `GET_RHC_TOKEN_BATCH_BUYER_QUALITY` | `POST /rhc/tokens/batch/buyer-quality` (**max 20**) | BASIC+ |
| `GET_RHC_TOKEN_BUNDLE` | `GET /rhc/tokens/{address}/bundle` | BASIC+ |
| `GET_RHC_DEPLOYER_LEADERBOARD` | `GET /rhc/deployer-hunter/leaderboard` | BASIC+ |
| `GET_RHC_DEPLOYER_PROFILE` | `GET /rhc/deployer-hunter/{address}` | BASIC+ |
| `GET_RHC_DEPLOYER_TRAJECTORY` | `GET /rhc/deployer-hunter/{address}/trajectory` | BASIC+ |
| `GET_RHC_DEPLOYER_TOKENS` | `GET /rhc/deployer-hunter/{address}/tokens` | BASIC+ |
| `GET_RHC_DEPLOYER_HISTORY` | `GET /rhc/deployer-hunter/{address}/history` | PRO+ |
| `GET_RHC_DEPLOYER_BEST_TOKENS` | `GET /rhc/deployer-hunter/best-tokens` | BASIC+ |
| `GET_RHC_DEPLOYER_STATS` | `GET /rhc/deployer-hunter/stats` | BASIC+ |
| `GET_RHC_DEPLOYER_ALERTS` | `GET /rhc/deployer-hunter/alerts` | BASIC+ |
| `GET_RHC_RECENT_BONDS` | `GET /rhc/deployer-hunter/recent-bonds` | BASIC+ |
| `GET_RHC_ALPHA_WALLETS` | `GET /rhc/alpha-wallets` | PRO+ |

### Rule engine

Rules are **data, not execution** — a fired rule delivers a signal (webhook and/or WebSocket) with a *suggested* size; nothing is ever traded on your behalf. Every quota below is **per chain**, so Solana rules do not eat into your RHC allowance.

The four `MANAGE_*` actions list your rules by default, and pause / resume / delete only when the message names an explicit rule id (numeric for copy-trade and price alerts, a UUID for coordination alerts and first-touch subscriptions). **Creating** a rule takes a webhook URL and returns a one-time `webhook_secret`, so it lives on the typed client rather than on a natural-language action.

| Action | Endpoints | Tier |
|---|---|---|
| `MANAGE_RHC_COPYTRADE_RULES` | `GET\|POST /rhc/copytrade/subscriptions`, `GET\|PATCH\|DELETE /rhc/copytrade/subscriptions/{id}` | PRO+ |
| `GET_RHC_COPYTRADE_SIGNALS` | `GET /rhc/copytrade/signals` | PRO+ |
| `MANAGE_RHC_PRICE_ALERTS` | `GET\|POST /rhc/price-alerts`, `GET\|PATCH\|DELETE /rhc/price-alerts/{id}` | PRO+ |
| `GET_RHC_PRICE_ALERT_EVENTS` | `GET /rhc/price-alerts/events` | PRO+ |
| `MANAGE_RHC_COORDINATION_ALERTS` | `GET\|POST /rhc/kol/coordination/alerts`, `GET\|PATCH\|DELETE /rhc/kol/coordination/alerts/{id}` | PRO+ |
| `MANAGE_RHC_FIRST_TOUCH_SUBSCRIPTIONS` | `GET\|POST /rhc/kol/first-touches/subscriptions`, `GET\|PATCH\|DELETE /rhc/kol/first-touches/subscriptions/{id}` | ULTRA+ |

Three RHC-specific behaviours worth knowing before you build on these:

- **Price alerts are polled (~15s), not sub-second.** RHC prices are written by `rhc-dex-stream` on a separate box and emit no notification, so the evaluator polls. Effective latency is that ~15s interval *plus* the token's own price-update cadence. The Solana price alerts fire sub-second; assuming parity will mis-size a strategy. Alerts also expire 30 days after creation, and `token_address` / `drop_pct` / `recovery_pct` are immutable (delete and recreate to change a threshold).
- **RHC copy-trade has no market-cap band.** The producer's event carries no market cap, so a `min_mc_usd` / `max_mc_usd` filter could only be a per-event lookup in the hot path of a ~3.3M trades/day chain. It is omitted rather than shipped as a filter that silently never matches. Amounts are ETH (`min_trade_eth`, `sizing_amount`), not SOL.
- **Coordination scores: `quality` is real, `earliness` is defaulted.** The v1 scorer is shared with Solana so the number is comparable, but RHC has no early-entry equivalent, so that component is defaulted to 50 while `quality` uses the real KOL 7-day win rate. Each fired signal records which components were real in `score_inputs`. Likewise, first-touch filters offer `min_kol_winrate` and `strategy` instead of Solana's `min_scout_tier` / `min_n_touches` — RHC has no scout score, and a filter that silently matched nothing would be worse than its absence.

## Usage

```ts
import { robinhoodChainPlugin } from "@madeonsol/plugin-robinhood-chain";

const agent = {
  plugins: [robinhoodChainPlugin],
  settings: {
    ROBINHOOD_CHAIN_API_KEY: "msk_your_api_key_here", // free at madeonsol.com/pricing
  },
};
```

Your agent can then answer queries like:

- "What are KOLs buying on Robinhood Chain right now?"
- "Show the RHC KOL leaderboard this week"
- "Which Robinhood Chain tokens are 2+ KOLs buying in the last hour?"
- "Is there a launch bundle on `0x…`?"
- "Score the early buyers on `0x…`"
- "Top Robinhood Chain deployers by graduation rate"
- "Is Robinhood Chain deployer `0x…` improving or declining?"
- "List every token deployer `0x…` has launched on Robinhood Chain"
- "What just graduated on Robinhood Chain?"
- "Show the latest RHC deployer alerts from elite deployers"
- "Which Robinhood Chain tokens have 3+ KOLs coordinating right now?"
- "Show smart-money wallets on Robinhood Chain"
- "List my Robinhood Chain copy-trade rules"
- "Pause RHC copy-trade rule 12"
- "What have my Robinhood Chain copy-trade rules fired lately?"
- "Show my RHC price alerts"
- "Which of my Robinhood Chain price alerts dipped this week?"
- "List my RHC KOL coordination alert rules"
- "Show my Robinhood Chain first-touch subscriptions"

### Programmatic client

Every endpoint is also on a typed client — call it directly from a custom action:

```ts
import { RobinhoodChainClient } from "@madeonsol/plugin-robinhood-chain";

const client = new RobinhoodChainClient({ apiKey: process.env.ROBINHOOD_CHAIN_API_KEY });

// Live KOL feed — EVM-native (eth_amount, token_address, tx_hash, block_number)
const { data } = await client.getKolFeed({ limit: 10, action: "buy" });
for (const t of data.trades) {
  console.log(`${t.kol_name} ${t.action} ${t.token_symbol} for ${t.eth_amount} ETH (${t.launchpad})`);
}

// Same-block launch-bundle detection (no atomic_tx on this Arbitrum Orbit L2)
const bundle = await client.getTokenBundle("0x1234567890abcdef1234567890abcdef12345678");
// bundle.data.bundle → { wallet_count, bundle_kind: "same_block" | "none", held_pct_of_supply, ... }

// KOL consensus — net_flow_eth denominated
const consensus = await client.getTokenKolConsensus("0x1234567890abcdef1234567890abcdef12345678");

// Is this deployer improving? (success = $40K+ peak MC, not a bonding curve)
const traj = await client.getDeployerTrajectory("0x1234567890abcdef1234567890abcdef12345678");
// traj.data.trajectory → { trend: "improving" | "declining" | "stable", current_streak, rolling_bond_rates, ... }

// Deployer alert feed — tradability-filtered by default (liquidity_usd >= $100)
const alerts = await client.getDeployerAlerts({ deployer_tier: "elite", limit: 50 });
// each alert: tier (resolved NOW) + tier_at_alert (snapshot) + tier_is_stale
// pass { include_untradeable: true } for the raw tape

// Batch: up to 50 tokens priced in ONE request (counts as one call)
const batch = await client.getTokenBatch(["0x1234…", "0xabcd…"]);
// unknown addresses come back as { address, found: false } — the array stays positional

// Batch buyer-quality — MAX 20 addresses, not 50 (per-token cohort computation)
const scores = await client.getTokenBatchBuyerQuality(["0x1234…", "0xabcd…"]);
```

#### Rule engine (writes)

```ts
// Copy-trade rule — ETH-denominated, no market-cap band on RHC.
// The rule delivers a SUGGESTED size; it never places an order.
const rule = await client.createCopytradeSubscription({
  name: "elite RHC wallets",
  source_wallets: ["0x1234…", "0xabcd…"], // lowercased server-side
  min_trade_eth: 0.05,
  only_action: "buy",
  sizing_mode: "proportional",
  sizing_amount: 0.25,
  delivery_mode: "webhook",
  webhook_url: "https://your-app.example/rhc-copytrade",
});
// rule.data.webhook_secret is shown ONCE — store it. Payloads are signed
// HMAC-SHA256 over `<timestamp>.<body>` in X-MadeOnSol-Signature.

// Catch-up after a missed webhook (7-day retention)
const signals = await client.getCopytradeSignals({ subscription_id: rule.data!.subscription.id });

// Price alert — market-cap denominated, baseline captured NOW.
// Evaluated on a ~15s POLL, not sub-second like the Solana alerts.
const alert = await client.createPriceAlert({
  token_address: "0x1234567890abcdef1234567890abcdef12345678",
  drop_pct: 30,
  recovery_pct: 15, // optional second leg, measured off the dip low
  delivery_mode: "websocket",
});
// alert.data.evaluation → { mode: "polled", interval_seconds: 15, note }

// Dip / recovery history (30-day retention)
const events = await client.getPriceAlertEvents({ event_type: "dip", limit: 100 });

// Coordination alert rule — quality is real, earliness is defaulted on RHC
const coord = await client.createCoordinationAlert({ min_kols: 4, window_minutes: 15, min_score: 60 });

// First-touch subscription (ULTRA+) — filters is a whole-object REPLACE on update
const ft = await client.createFirstTouchSubscription({
  filters: { min_first_buy_eth: 0.1, min_kol_winrate: 0.55, strategy: "swing" },
});

// Pause / resume / delete
await client.updateCopytradeSubscription(rule.data!.subscription.id, { is_active: false });
await client.deletePriceAlert(alert.data!.alert.id);
await client.deleteFirstTouchSubscription(ft.data!.subscription.id); // UUID
```

Every request populates `client.lastRateLimit` (`limit` / `remaining` / `reset` / `requestId`).

## Why Robinhood Chain

Robinhood Chain is an Arbitrum Orbit L2 (chain id 4663). Two things follow from that, and this plugin models both honestly:

- **No atomic multi-signer transaction** → the bundle detector reports `same_block` (3+ first buys in one block) or `none`; there is no `atomic_tx` kind.
- **Direct-to-DEX launchpads** (most RHC launchpads have no bonding curve) → "graduation" is a market-cap milestone: `graduation_rate` = share of a deployer's tokens that reached a $40K+ peak MC; `runner_rate` = share that reached $100K+.
- **Tiers ride `runner_rate`, not `graduation_rate`** → `elite` = 5+ tokens, 24h+ of deployer history, `runner_rate >= 0.50`; `good` = same with `>= 0.25`. `graduation_rate` is still returned and still means the $40K bar, but it no longer sets the tier (it proved farmable by operators rotating wallets); only `spammer` still keys off it (20+ tokens, `graduation_rate < 0.05`).

## Tiers

| Tier | Price | Requests/day |
|------|-------|--------------|
| BASIC (free) | $0 | 200 |
| PRO | €43/mo (€430/yr) ≈ $49 | 10,000 |
| ULTRA | €131/mo (€1310/yr) ≈ $149 | 100,000 |
| BUSINESS | €400/mo (€4000/yr) ≈ $449 | 500,000 |

Robinhood Chain coverage is bundled into every tier at no extra cost. BASIC endpoints work with any valid key; `GET /rhc/trades`, `GET /rhc/tokens`, `GET /rhc/tokens/{address}/candles`, `GET /rhc/tokens/{address}/kol-consensus`, `GET /rhc/deployer-hunter/{address}/history`, `GET /rhc/alpha-wallets`, and the whole rule engine except first touches (copy-trade rules + signals, price alerts + events, coordination alerts) require PRO+. First-touch subscriptions require ULTRA+. Rule-engine quotas — how many rules, and how many source wallets per copy-trade rule — scale with tier and are counted **per chain**. ULTRA also unlocks the deepest read fields (the full bundle cohort with wallet identity, the KOL-consensus `buyers`/`exited` lists, `first_kol.evm_address` on first-touches, and the full 500-alert page on the deployer alert feed — BASIC/PRO cap at 50). Get a key at [madeonsol.com/pricing](https://madeonsol.com/pricing).

## Also Available

| Platform | Package |
|---|---|
| Solana Agent Kit | [`solana-agent-kit-plugin-robinhood-chain`](https://www.npmjs.com/package/solana-agent-kit-plugin-robinhood-chain) |
| TypeScript SDK | [`robinhood-chain-sdk`](https://www.npmjs.com/package/robinhood-chain-sdk) on npm |
| Python SDK | [`robinhood-chain`](https://pypi.org/project/robinhood-chain/) on PyPI |
| Rust SDK | [`robinhood-chain`](https://crates.io/crates/robinhood-chain) on crates.io |
| MCP Server (Claude, Cursor) | [`mcp-server-robinhood-chain`](https://www.npmjs.com/package/mcp-server-robinhood-chain) |

## Links

- **Robinhood Chain product** → https://madeonsol.com/robinhood
- **API docs** → https://madeonsol.com/api-docs
- **Pricing & free API key** → https://madeonsol.com/pricing

## License

MIT
