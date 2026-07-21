import type { Action, IAgentRuntime, Memory, State, HandlerCallback } from "@elizaos/core";
import { RobinhoodChainClient } from "../client.js";
import { RHC_CLIENT_KEY } from "../index.js";
import { toContent } from "../content.js";

function getClient(runtime: IAgentRuntime): RobinhoodChainClient {
  return ((runtime as unknown as Record<string, unknown>)[RHC_CLIENT_KEY] as RobinhoodChainClient) ?? new RobinhoodChainClient();
}

const AUTH_HINT = "Authentication required. Set ROBINHOOD_CHAIN_API_KEY (or MADEONSOL_API_KEY) — get a free `msk_` key at https://madeonsol.com/developer.";
const EVM_RE = /\b(0x[0-9a-fA-F]{40})\b/;

export const rhcTokenCandlesAction: Action = {
  name: "GET_RHC_TOKEN_CANDLES",
  description:
    "Get 1-minute OHLC candles for a Robinhood Chain token: price + market-cap OHLC, close liquidity, volume with buy/sell split, and trade/buy/sell counts, ordered oldest→newest. PRO+.",
  similes: [
    "robinhood chain candles",
    "rhc ohlc",
    "rhc token chart data",
    "price candles on robinhood chain",
  ],

  validate: async (_runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
    const text = message.content?.text || "";
    return /\b(candle|ohlc|chart|price history)\b/i.test(text) && EVM_RE.test(text);
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    _options?: unknown,
    callback?: HandlerCallback,
  ) => {
    const client = getClient(runtime);
    const address = (message.content?.text || "").match(EVM_RE)?.[1];
    if (!address) {
      callback?.({ text: "Please include a token address (0x, 40 hex)." });
      return undefined;
    }

    const result = await client.getTokenCandles(address, { limit: 60 });

    if (result.error) {
      callback?.({ text: result.status === 401 ? AUTH_HINT : result.status === 403 ? "This endpoint requires the PRO tier or higher. See https://madeonsol.com/pricing." : `Error: ${result.error}` });
      return undefined;
    }

    const data = result.data!;
    const candles = data.candles || [];
    const last = candles[candles.length - 1];
    const summary = last
      ? `Robinhood Chain 1m candles for ${address.slice(0, 10)}… — ${data.count} candles. Latest close $${last.close_price_usd}, volume $${Number(last.volume_usd).toFixed(0)}.`
      : `No candles available for ${address.slice(0, 10)}….`;

    callback?.({ text: summary, content: toContent(data) });
    return undefined;
  },

  examples: [
    [
      { name: "user1", content: { text: "Show 1m OHLC candles for Robinhood Chain token 0x1234567890abcdef1234567890abcdef12345678" } },
      { name: "assistant", content: { text: "Here are the RHC candles..." } },
    ],
  ] as Action["examples"],
};
