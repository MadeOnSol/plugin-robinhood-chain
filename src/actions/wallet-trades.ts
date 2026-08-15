import type { Action, IAgentRuntime, Memory, State, HandlerCallback } from "@elizaos/core";
import { RobinhoodChainClient } from "../client.js";
import { RHC_CLIENT_KEY } from "../index.js";
import { toContent } from "../content.js";

function getClient(runtime: IAgentRuntime): RobinhoodChainClient {
  return ((runtime as unknown as Record<string, unknown>)[RHC_CLIENT_KEY] as RobinhoodChainClient) ?? new RobinhoodChainClient();
}

const AUTH_HINT = "Authentication required. Set ROBINHOOD_CHAIN_API_KEY (or MADEONSOL_API_KEY) — get a free `msk_` key at https://madeonsol.com/pricing.";
const TIER_HINT = "This endpoint requires the PRO tier or higher. See https://madeonsol.com/pricing.";

function extractAddress(text: string): string | undefined {
  return text.match(/0x[a-fA-F0-9]{40}/)?.[0]?.toLowerCase();
}

export const rhcWalletTradesAction: Action = {
  name: "GET_RHC_WALLET_TRADES",
  description:
    "One Robinhood Chain wallet's swap tape, newest first. Filters by WALLET (the global tape filtered by token is a different call). Cursor-paginated on an opaque keyset. PRO+.",
  similes: [
    "robinhood chain wallet trades",
    "rhc wallet tape",
    "what has this rhc wallet been trading",
    "rhc wallet swap history",
    "recent trades by this robinhood chain wallet",
  ],

  validate: async (_runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
    const text = (message.content?.text || "").toLowerCase();
    return /\b(rhc|robinhood)\b/.test(text)
      && /\b(trades?|tape|swaps?|trading|bought|sold)\b/.test(text)
      && !!extractAddress(text)
      && !/\bwatchlist|tracked\b/.test(text);
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    _options?: unknown,
    callback?: HandlerCallback,
  ) => {
    const text = (message.content?.text || "").toLowerCase();
    const address = extractAddress(text);
    if (!address) {
      callback?.({ text: "I need a wallet address (0x + 40 hex) to pull the Robinhood Chain trade tape for." });
      return undefined;
    }

    const action = /\bbuys?\b|\bbought\b/.test(text) ? "buy" : /\bsells?\b|\bsold\b/.test(text) ? "sell" : undefined;

    const result = await getClient(runtime).getWalletTrades(address, { limit: 25, action });
    if (result.error) {
      callback?.({
        text: result.status === 401 ? AUTH_HINT
          : result.status === 403 ? TIER_HINT
          : `Error: ${result.error}`,
      });
      return undefined;
    }

    const d = result.data!;
    if (!d.trades?.length) {
      callback?.({ text: `No Robinhood Chain trades for ${address.slice(0, 10)}…${action ? ` on the ${action} side` : ""} in the window.`, content: toContent(d) });
      return undefined;
    }

    const rows = d.trades.slice(0, 15).map((t) => {
      const label = t.token_symbol || t.token_address?.slice(0, 10) || "?";
      const size = t.eth_amount != null ? `${Number(t.eth_amount).toFixed(4)} ETH` : "?";
      const mc = t.mc_usd_at_trade != null ? ` @ $${Math.round(t.mc_usd_at_trade).toLocaleString("en-US")} MC` : "";
      return `  ${(t.action || "?").toUpperCase()} ${label} — ${size}${mc} · ${t.block_time}`;
    });

    const lines = [
      `Robinhood Chain trades for ${address.slice(0, 10)}… (${d.count} returned)`,
      ...rows,
    ];
    if (d.has_more) lines.push(`More available — page with before=${d.next_before}`);

    callback?.({ text: lines.join("\n"), content: toContent(d) });
    return undefined;
  },

  examples: [
    [
      { name: "user1", content: { text: "Show recent trades by 0x1234567890abcdef1234567890abcdef12345678 on Robinhood Chain." } },
      { name: "assistant", content: { text: "Here is the RHC trade tape for that wallet..." } },
    ],
  ] as Action["examples"],
};
