import type { Action, IAgentRuntime, Memory, State, HandlerCallback } from "@elizaos/core";
import { RobinhoodChainClient } from "../client.js";
import { RHC_CLIENT_KEY } from "../index.js";
import { toContent } from "../content.js";

function getClient(runtime: IAgentRuntime): RobinhoodChainClient {
  return ((runtime as unknown as Record<string, unknown>)[RHC_CLIENT_KEY] as RobinhoodChainClient) ?? new RobinhoodChainClient();
}

const AUTH_HINT = "Authentication required. Set ROBINHOOD_CHAIN_API_KEY (or MADEONSOL_API_KEY) — get a free `msk_` key at https://madeonsol.com/pricing.";
const EVM_ALL_RE = /0x[0-9a-fA-F]{40}/g;
const MAX_ADDRESSES = 20;

export const rhcTokenBatchBuyerQualityAction: Action = {
  name: "GET_RHC_TOKEN_BATCH_BUYER_QUALITY",
  description:
    "Score the early-buyer cohorts of several Robinhood Chain tokens in ONE request — each entry is the same 0–100 read as the single-token endpoint (score, confidence, signal, and the breakdown: early buyers analyzed, alpha wallets, KOLs, bundle buyers, dump-cluster count, recycled early buyers, average historical win rate, bot_dominated). MAX 20 ADDRESSES — deliberately lower than the Solana batch cap of 50, because RHC buyer-quality is a per-token cohort computation, not a set-based lookup. A token that fails to score degrades to an error entry rather than failing the whole batch. BASIC+.",
  similes: [
    "robinhood chain batch buyer quality",
    "score several rhc tokens early buyers",
    "rhc bulk buyer quality",
    "compare rhc buyer cohorts",
  ],

  validate: async (_runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
    const text = message.content?.text || "";
    const matches = text.match(EVM_ALL_RE) || [];
    return matches.length >= 2 && /\b(buyer quality|buyer score|early buyer|quality score|buyer cohort)\b/i.test(text);
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    _options?: unknown,
    callback?: HandlerCallback,
  ) => {
    const client = getClient(runtime);
    const all = [...new Set(message.content?.text?.match(EVM_ALL_RE) ?? [])];
    const addresses = all.slice(0, MAX_ADDRESSES);
    if (addresses.length === 0) {
      callback?.({ text: `Please include 1-${MAX_ADDRESSES} Robinhood Chain token addresses (0x, 40 hex).` });
      return undefined;
    }

    const result = await client.getTokenBatchBuyerQuality(addresses);

    if (result.error) {
      callback?.({ text: result.status === 401 ? AUTH_HINT : `Error: ${result.error}` });
      return undefined;
    }

    const data = result.data!;
    const lines = (data.tokens || []).map((t) =>
      "error" in t
        ? `${t.token_address.slice(0, 10)}… — could not be scored`
        : `${t.token_address.slice(0, 10)}… — ${t.quality.score}/100 (${t.quality.signal}, ${t.quality.confidence} confidence)`,
    );
    const dropped = all.length > MAX_ADDRESSES ? ` — ${all.length - MAX_ADDRESSES} address(es) dropped, the cap is ${MAX_ADDRESSES}` : "";

    callback?.({
      text: `Robinhood Chain batch buyer-quality (${data.scored}/${data.requested} scored)${dropped}:\n${lines.join("\n")}`,
      content: toContent(data),
    });
    return undefined;
  },

  examples: [
    [
      { name: "user1", content: { text: "Score the early buyers on Robinhood Chain tokens 0x1234567890abcdef1234567890abcdef12345678 and 0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" } },
      { name: "assistant", content: { text: "Here's the RHC batch buyer-quality read..." } },
    ],
  ] as Action["examples"],
};
