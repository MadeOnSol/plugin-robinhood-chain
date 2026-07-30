import type { Action, IAgentRuntime, Memory, State, HandlerCallback } from "@elizaos/core";
import { RobinhoodChainClient } from "../client.js";
import { RHC_CLIENT_KEY } from "../index.js";
import { toContent } from "../content.js";

function getClient(runtime: IAgentRuntime): RobinhoodChainClient {
  return ((runtime as unknown as Record<string, unknown>)[RHC_CLIENT_KEY] as RobinhoodChainClient) ?? new RobinhoodChainClient();
}

const AUTH_HINT = "Authentication required. Set ROBINHOOD_CHAIN_API_KEY (or MADEONSOL_API_KEY) — get a free `msk_` key at https://madeonsol.com/pricing.";
const EVM_RE = /\b(0x[0-9a-fA-F]{40})\b/;

export const rhcTradesAction: Action = {
  name: "GET_RHC_TRADES",
  description:
    "Get the Robinhood Chain DEX trade tape — every Uniswap v2/v3/v4 swap on chain 4663, each row carrying the effective trading account (trader_eoa — tx.from normally, or the ERC-4337 userOp sender when the trade was bundled; never the router or the bundler), gas/ordering for MEV analysis, pool state, and KOL/deployer flags. Filter by token, dex, action, min_eth. PRO+.",
  similes: [
    "robinhood chain trades",
    "rhc dex trade tape",
    "rhc swaps",
    "robinhood chain firehose",
    "trades for a robinhood chain token",
  ],

  validate: async (_runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
    const text = (message.content?.text || "").toLowerCase();
    return /\b(rhc|robinhood)\b/.test(text) && /\b(trade tape|dex trade|swaps|firehose|trades)\b/.test(text);
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
    const token = text.match(EVM_RE)?.[1];
    const action = /\bbuy\b/i.test(text) ? "buy" : /\bsell\b/i.test(text) ? "sell" : undefined;

    const result = await client.getTrades({ limit: 15, ...(token ? { token } : {}), ...(action ? { action: action as "buy" | "sell" } : {}) });

    if (result.error) {
      callback?.({ text: result.status === 401 ? AUTH_HINT : result.status === 403 ? "This endpoint requires the PRO tier or higher. See https://madeonsol.com/pricing." : `Error: ${result.error}` });
      return undefined;
    }

    const data = result.data!;
    const lines = (data.trades || []).slice(0, 12).map(
      (t) => `${(t.trader_eoa || t.trader || "?").slice(0, 10)}… ${t.action || "?"} on ${t.dex}${t.is_kol ? ` [KOL ${t.kol_name || ""}]` : ""} — ${t.eth_amount == null ? "?" : Number(t.eth_amount).toFixed(4)} ETH`,
    );

    callback?.({ text: `Robinhood Chain trade tape (${data.count} rows):\n${lines.join("\n")}`, content: toContent(data) });
    return undefined;
  },

  examples: [
    [
      { name: "user1", content: { text: "Show the latest Robinhood Chain DEX trades for 0x1234567890abcdef1234567890abcdef12345678" } },
      { name: "assistant", content: { text: "Here's the RHC trade tape..." } },
    ],
  ] as Action["examples"],
};
