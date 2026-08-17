import type { Action, IAgentRuntime, Memory, State, HandlerCallback } from "@elizaos/core";
import { RobinhoodChainClient } from "../client.js";
import { RHC_CLIENT_KEY } from "../index.js";
import { toContent } from "../content.js";

function getClient(runtime: IAgentRuntime): RobinhoodChainClient {
  return ((runtime as unknown as Record<string, unknown>)[RHC_CLIENT_KEY] as RobinhoodChainClient) ?? new RobinhoodChainClient();
}

const AUTH_HINT = "Authentication required. Set ROBINHOOD_CHAIN_API_KEY (or MADEONSOL_API_KEY) — get a free `msk_` key at https://madeonsol.com/pricing.";

// Words that look like tickers but are not (chain / unit / metric shorthands).
const NOT_TICKERS = new Set(["RHC", "ETF", "ETFS", "MC", "USD", "ETH", "USDC", "USDG", "PNL", "LP", "DEX", "KOL", "KOLS"]);

export const rhcEquitiesAction: Action = {
  name: "GET_RHC_EQUITIES",
  description:
    "List Robinhood Chain tokenized equities — every official Robinhood tokenized stock and ETF (NVDA, SPY, AAPL…) with live price / market cap / liquidity and 24h trades, ETH volume, buys/sells and distinct buyers/sellers. Identity is the issuer BEACON (EIP-1967 beacon proxy on 0xe10b6f6b…151b00, read from our own node), never the name — look-alike 'GameStop • Robinhood Token' contracts are excluded by construction. Sortable by volume/trades/market_cap/last_trade/symbol; filter by exact ticker (symbol) or substring (q). BASIC+.",
  similes: [
    "robinhood chain equities",
    "robinhood tokenized stocks",
    "rhc tokenized etfs",
    "robinhood chain stock tokens",
    "nvda on robinhood chain",
    "tokenized stocks on rhc",
  ],

  validate: async (_runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
    const text = (message.content?.text || "").toLowerCase();
    return /\b(rhc|robinhood)\b/.test(text) && /\b(equit(y|ies)|tokenized (stock|equit|etf)|stock tokens?|stocks?|etfs?|tickers?)\b/.test(text);
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    _options?: unknown,
    callback?: HandlerCallback,
  ) => {
    const client = getClient(runtime);
    const text = message.content?.text || "";
    const lower = text.toLowerCase();
    // A bare all-caps ticker (1–6 letters, optional ".X" class suffix) pins the exact-symbol filter.
    const tickerLike = (text.match(/\b([A-Z]{1,6}(?:\.[A-Z])?)\b/g) || []).find((t) => !NOT_TICKERS.has(t));
    const sort =
      lower.includes("market cap") || /\bmc\b/.test(lower)
        ? "market_cap"
        : /\btrades?\b/.test(lower)
          ? "trades"
          : /\b(recent|last trade|latest)\b/.test(lower)
            ? "last_trade"
            : /\b(alphabet|by symbol)\b/.test(lower)
              ? "symbol"
              : "volume";

    const result = await client.getEquities({
      sort: sort as "volume" | "trades" | "market_cap" | "last_trade" | "symbol",
      limit: 20,
      ...(tickerLike ? { symbol: tickerLike } : {}),
    });

    if (result.error) {
      callback?.({ text: result.status === 401 ? AUTH_HINT : `Error: ${result.error}` });
      return undefined;
    }

    const data = result.data!;
    const fmtUsd = (v?: number | null) => (v == null ? "?" : v >= 1e6 ? `$${(v / 1e6).toFixed(2)}M` : v >= 1e3 ? `$${(v / 1e3).toFixed(1)}K` : `$${v.toFixed(2)}`);
    const lines = (data.equities || []).slice(0, 15).map(
      (e) =>
        `${e.symbol || e.token_address.slice(0, 10)} (${e.name || e.onchain_name || "?"}) — ${fmtUsd(e.price_usd)}, MC ${fmtUsd(e.market_cap_usd)}, liq ${fmtUsd(e.liquidity_usd)}, 24h ${e.trades_24h} trades / ${Number(e.volume_eth_24h || 0).toFixed(3)} ETH (${e.buyers_24h} buyers / ${e.sellers_24h} sellers)`,
    );

    callback?.({
      text: `Robinhood Chain tokenized equities (${data.count} of ${data.total_equities}, sort=${data.sort}; beacon-verified — identity is the issuer beacon, never the name):\n${lines.join("\n")}`,
      content: toContent(data),
    });
    return undefined;
  },

  examples: [
    [
      { name: "user1", content: { text: "List the tokenized stocks on Robinhood Chain by volume." } },
      { name: "assistant", content: { text: "Here are the beacon-verified Robinhood Chain equities..." } },
    ],
    [
      { name: "user1", content: { text: "What is NVDA doing on Robinhood Chain?" } },
      { name: "assistant", content: { text: "NVDA on Robinhood Chain: price, MC, 24h trades..." } },
    ],
  ] as Action["examples"],
};
