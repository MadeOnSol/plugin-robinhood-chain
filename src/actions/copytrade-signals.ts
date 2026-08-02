import type { Action, IAgentRuntime, Memory, State, HandlerCallback } from "@elizaos/core";
import { RobinhoodChainClient } from "../client.js";
import { RHC_CLIENT_KEY } from "../index.js";
import { toContent } from "../content.js";

function getClient(runtime: IAgentRuntime): RobinhoodChainClient {
  return ((runtime as unknown as Record<string, unknown>)[RHC_CLIENT_KEY] as RobinhoodChainClient) ?? new RobinhoodChainClient();
}

const AUTH_HINT = "Authentication required. Set ROBINHOOD_CHAIN_API_KEY (or MADEONSOL_API_KEY) — get a free `msk_` key at https://madeonsol.com/pricing.";
const SUB_ID_RE = /(?:rule|subscription|id|#)\s*#?\s*(\d{1,12})\b/i;

export const rhcCopytradeSignalsAction: Action = {
  name: "GET_RHC_COPYTRADE_SIGNALS",
  description:
    "Get the fire history of your Robinhood Chain copy-trade rules — every signal a rule produced, newest first, with the source wallet, buy/sell, token, the source's ETH size, the `suggested_eth_amount` your sizing mode computed, price, DEX, tx hash and whether delivery succeeded. This is the CATCH-UP path for a missed webhook or a dropped WebSocket connection, not a live stream. Retained 7 days. Filter to a single rule by naming its numeric id. PRO+.",
  similes: [
    "robinhood chain copy trade signals",
    "rhc copytrade fire history",
    "what did my rhc copy trade rules fire",
    "missed rhc copytrade webhooks",
  ],

  validate: async (_runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
    const text = (message.content?.text || "").toLowerCase();
    return (
      /\b(rhc|robinhood)\b/.test(text) &&
      /\b(copy[- ]?trade|copytrade)\b/.test(text) &&
      /\b(signal|signals|fired|fire history|history|missed)\b/.test(text)
    );
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
    const subId = Number(text.match(SUB_ID_RE)?.[1]);

    const result = await client.getCopytradeSignals({
      limit: 50,
      ...(Number.isInteger(subId) && subId > 0 ? { subscription_id: subId } : {}),
    });

    if (result.error) {
      callback?.({ text: result.status === 401 ? AUTH_HINT : `Error: ${result.error}` });
      return undefined;
    }

    const data = result.data!;
    const lines = (data.signals || [])
      .slice(0, 15)
      .map(
        (s) =>
          `${s.action.toUpperCase()} ${s.token_symbol || s.token_address.slice(0, 10)} — source ${s.source_wallet.slice(0, 10)}… traded ${s.source_eth_amount ?? "?"} ETH, suggested ${s.suggested_eth_amount ?? "?"} ETH (rule #${s.subscription_id}, ${s.delivered ? "delivered" : "NOT delivered"})`,
      );

    callback?.({
      text: `Robinhood Chain copy-trade signals (${data.count}):\n${lines.join("\n") || "None in the retained 7-day window."}`,
      content: toContent(data),
    });
    return undefined;
  },

  examples: [
    [
      { name: "user1", content: { text: "What have my Robinhood Chain copy-trade rules fired lately?" } },
      { name: "assistant", content: { text: "Here are your recent RHC copy-trade signals..." } },
    ],
  ] as Action["examples"],
};
