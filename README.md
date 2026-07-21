# @madeonsol/plugin-robinhood-chain

[![npm version](https://img.shields.io/npm/v/@madeonsol/plugin-robinhood-chain?style=flat-square)](https://www.npmjs.com/package/@madeonsol/plugin-robinhood-chain)
[![npm downloads](https://img.shields.io/npm/dm/@madeonsol/plugin-robinhood-chain?style=flat-square)](https://www.npmjs.com/package/@madeonsol/plugin-robinhood-chain)
[![ElizaOS](https://img.shields.io/badge/ElizaOS-plugin-blueviolet?style=flat-square)](https://github.com/elizaOS/eliza)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](LICENSE)

> 🤖 **[Robinhood Chain API](https://madeonsol.com/robinhood)** · 📚 **[API docs](https://madeonsol.com/api-docs)** · 💰 **[Free API key](https://madeonsol.com/pricing)** · 🤖 **[ElizaOS](https://github.com/elizaOS/eliza)**

**ElizaOS plugin for the Robinhood Chain API** — EVM-native, on-chain trading intelligence for **Robinhood Chain (chain id 4663)**. Give your ElizaOS agent live KOL trades, token discovery, launch-bundle detection, buyer-quality scoring, deployer reputation, the DEX trade tape, and smart-money wallet rankings — all from [MadeOnSol](https://madeonsol.com)'s self-hosted RHC node.

> Robinhood Chain intelligence, EVM-native: track Solana KOLs' verified RHC wallets (recovered by tracing their Solana→EVM bridge deposits — a dataset unique to MadeOnSol), rank 40k+ RHC deployers by graduation/runner rate, detect same-block launch bundles and score early-buyer cohorts, and stream the Uniswap v2/v3/v4 trade tape with the real trader EOA. Every field is EVM-native — `token_address` (lowercase `0x`), `eth_amount`, `tx_hash`, `block_number`, `net_flow_eth`. **Same `msk_` API key, same base URL, bundled into every tier at no extra cost.** Get a free key at [madeonsol.com/pricing](https://madeonsol.com/pricing).

New customers get a **5-day free trial** of Pro or Ultra when you pay by card — full access, nothing charged during the trial, cancel anytime. Start at [madeonsol.com/pricing](https://madeonsol.com/pricing).

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

Robinhood Chain is **key-mode only** — a single MadeOnSol API key (`msk_`, Bearer). The x402 pay-per-call rail is Solana-native and is **not** available on Robinhood Chain.

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
| `GET_RHC_TRADES` | `GET /rhc/trades` | PRO+ |
| `GET_RHC_TOKENS` | `GET /rhc/tokens` | PRO+ |
| `GET_RHC_TOKEN` | `GET /rhc/tokens/{address}` | BASIC+ |
| `GET_RHC_TOKEN_CANDLES` | `GET /rhc/tokens/{address}/candles` | PRO+ |
| `GET_RHC_KOL_CONSENSUS` | `GET /rhc/tokens/{address}/kol-consensus` | PRO+ |
| `GET_RHC_BUYER_QUALITY` | `GET /rhc/tokens/{address}/buyer-quality` | BASIC+ |
| `GET_RHC_TOKEN_BUNDLE` | `GET /rhc/tokens/{address}/bundle` | BASIC+ |
| `GET_RHC_DEPLOYER_LEADERBOARD` | `GET /rhc/deployer-hunter/leaderboard` | BASIC+ |
| `GET_RHC_DEPLOYER_PROFILE` | `GET /rhc/deployer-hunter/{address}` | BASIC+ |
| `GET_RHC_ALPHA_WALLETS` | `GET /rhc/alpha-wallets` | PRO+ |

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
- "Show smart-money wallets on Robinhood Chain"

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
```

Every request populates `client.lastRateLimit` (`limit` / `remaining` / `reset` / `requestId`).

## Why Robinhood Chain

Robinhood Chain is an Arbitrum Orbit L2 (chain id 4663). Two things follow from that, and this plugin models both honestly:

- **No atomic multi-signer transaction** → the bundle detector reports `same_block` (3+ first buys in one block) or `none`; there is no `atomic_tx` kind.
- **Direct-to-DEX launchpads** (most RHC launchpads have no bonding curve) → "graduation" is a market-cap milestone: `graduation_rate` = share of a deployer's tokens that reached a $40K+ peak MC; `runner_rate` = share that reached $100K+.

## Tiers

| Tier | Price | Requests/day |
|------|-------|--------------|
| BASIC (free) | $0 | 200 |
| PRO | €43/mo (€430/yr) ≈ $49 | 10,000 |
| ULTRA | €131/mo (€1310/yr) ≈ $149 | 100,000 |

Robinhood Chain coverage is bundled into every tier at no extra cost. BASIC endpoints work with any valid key; `GET /rhc/trades`, `GET /rhc/tokens`, `GET /rhc/tokens/{address}/candles`, `GET /rhc/tokens/{address}/kol-consensus`, and `GET /rhc/alpha-wallets` require PRO+. ULTRA unlocks the deepest fields (e.g. the full bundle cohort with wallet identity, and the KOL-consensus `buyers`/`exited` lists). Get a key at [madeonsol.com/pricing](https://madeonsol.com/pricing) · pricing at [madeonsol.com/pricing](https://madeonsol.com/pricing).

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
- **Free API key** → https://madeonsol.com/pricing
- **Pricing** → https://madeonsol.com/pricing

## License

MIT
