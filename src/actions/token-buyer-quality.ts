import type { Action, IAgentRuntime, Memory, State, HandlerCallback } from "@elizaos/core";
import { RobinhoodChainClient } from "../client.js";
import { RHC_CLIENT_KEY } from "../index.js";
import { toContent } from "../content.js";

function getClient(runtime: IAgentRuntime): RobinhoodChainClient {
  return ((runtime as unknown as Record<string, unknown>)[RHC_CLIENT_KEY] as RobinhoodChainClient) ?? new RobinhoodChainClient();
}

const AUTH_HINT = "Authentication required. Set ROBINHOOD_CHAIN_API_KEY (or MADEONSOL_API_KEY) — get a free `msk_` key at https://madeonsol.com/pricing.";
const EVM_RE = /\b(0x[0-9a-fA-F]{40})\b/;

export const rhcBuyerQualityAction: Action = {
  name: "GET_RHC_BUYER_QUALITY",
  description:
    "Get a 0–100 early-buyer quality read on a Robinhood Chain token's first-20 distinct buyer cohort: win-rate, KOL presence, bot-domination and bundle-buyer legs, plus the informational dump-cluster ensemble (dump_cluster_count). Returns score, confidence, signal, and a breakdown. BASIC+.",
  similes: [
    "robinhood chain buyer quality",
    "rhc early buyer score",
    "is this robinhood chain token quality",
    "rhc buyer cohort score",
  ],

  validate: async (_runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
    const text = message.content?.text || "";
    return /\b(buyer quality|buyer score|early buyer|quality score)\b/i.test(text) && EVM_RE.test(text);
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

    const result = await client.getTokenBuyerQuality(address);

    if (result.error) {
      callback?.({ text: result.status === 401 ? AUTH_HINT : `Error: ${result.error}` });
      return undefined;
    }

    const data = result.data!;
    const q = data.quality;
    const b = q.breakdown;
    const summary = [
      `Robinhood Chain buyer-quality for ${address.slice(0, 10)}…: ${q.score}/100 (${q.signal}, ${q.confidence} confidence)`,
      `• ${b.early_buyers_analyzed} early buyers — ${b.alpha_wallet_count} alpha, ${b.kol_count} KOL, ${b.bundle_buyer_count} bundle`,
      `• Dump-cluster: ${b.dump_cluster_count} (informational)${b.bot_dominated ? " · bot-dominated" : ""}`,
    ].join("\n");

    callback?.({ text: summary, content: toContent(data) });
    return undefined;
  },

  examples: [
    [
      { name: "user1", content: { text: "Score the early buyers on Robinhood Chain token 0x1234567890abcdef1234567890abcdef12345678" } },
      { name: "assistant", content: { text: "Here's the RHC buyer-quality read..." } },
    ],
  ] as Action["examples"],
};
