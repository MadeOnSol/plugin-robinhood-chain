import type { Action, IAgentRuntime, Memory, State, HandlerCallback } from "@elizaos/core";
import { RobinhoodChainClient } from "../client.js";
import { RHC_CLIENT_KEY } from "../index.js";
import { toContent } from "../content.js";

function getClient(runtime: IAgentRuntime): RobinhoodChainClient {
  return ((runtime as unknown as Record<string, unknown>)[RHC_CLIENT_KEY] as RobinhoodChainClient) ?? new RobinhoodChainClient();
}

const AUTH_HINT = "Authentication required. Set ROBINHOOD_CHAIN_API_KEY (or MADEONSOL_API_KEY) — get a free `msk_` key at https://madeonsol.com/pricing.";

export const rhcTokensAction: Action = {
  name: "GET_RHC_TOKENS",
  description:
    "Discover Robinhood Chain tokens — live-priced tokens with market cap, liquidity, peak MC + drawdown, launchpad, and deployer reputation tier. Sortable (last_trade/market_cap/liquidity/peak_mc) and filterable by min_mc_usd, min_liquidity_usd, launchpad. PRO+.",
  similes: [
    "robinhood chain tokens",
    "rhc token discovery",
    "list robinhood chain tokens",
    "top robinhood chain tokens by market cap",
  ],

  validate: async (_runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
    const text = (message.content?.text || "").toLowerCase();
    return /\b(rhc|robinhood)\b/.test(text) && /\b(tokens|discover|list|scan|top token)/.test(text);
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    _options?: unknown,
    callback?: HandlerCallback,
  ) => {
    const client = getClient(runtime);
    const text = (message.content?.text || "").toLowerCase();
    const sort = text.includes("liquidity") ? "liquidity" : text.includes("peak") ? "peak_mc" : text.includes("market cap") || text.includes("mc") ? "market_cap" : "last_trade";

    const result = await client.getTokens({ sort: sort as "last_trade" | "market_cap" | "liquidity" | "peak_mc", limit: 15 });

    if (result.error) {
      callback?.({ text: result.status === 401 ? AUTH_HINT : result.status === 403 ? "This endpoint requires the PRO tier or higher. See https://madeonsol.com/pricing." : `Error: ${result.error}` });
      return undefined;
    }

    const data = result.data!;
    const fmtUsd = (v?: number | null) => (v == null ? "?" : v >= 1e6 ? `$${(v / 1e6).toFixed(2)}M` : v >= 1e3 ? `$${(v / 1e3).toFixed(1)}K` : `$${v.toFixed(0)}`);
    const lines = (data.tokens || []).slice(0, 12).map(
      (t) => `${t.symbol || t.token_address.slice(0, 10)} — MC ${fmtUsd(t.market_cap_usd)}, liq ${fmtUsd(t.liquidity_usd)}${t.deployer_tier ? ` [${t.deployer_tier}]` : ""}`,
    );

    callback?.({ text: `Robinhood Chain tokens (sort=${data.sort}):\n${lines.join("\n")}`, content: toContent(data) });
    return undefined;
  },

  examples: [
    [
      { name: "user1", content: { text: "List the top Robinhood Chain tokens by market cap." } },
      { name: "assistant", content: { text: "Here are the top RHC tokens..." } },
    ],
  ] as Action["examples"],
};
