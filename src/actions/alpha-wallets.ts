import type { Action, IAgentRuntime, Memory, State, HandlerCallback } from "@elizaos/core";
import { RobinhoodChainClient } from "../client.js";
import { RHC_CLIENT_KEY } from "../index.js";
import { toContent } from "../content.js";

function getClient(runtime: IAgentRuntime): RobinhoodChainClient {
  return ((runtime as unknown as Record<string, unknown>)[RHC_CLIENT_KEY] as RobinhoodChainClient) ?? new RobinhoodChainClient();
}

const AUTH_HINT = "Authentication required. Set ROBINHOOD_CHAIN_API_KEY (or MADEONSOL_API_KEY) — get a free `msk_` key at https://madeonsol.com/pricing.";

export const rhcAlphaWalletsAction: Action = {
  name: "GET_RHC_ALPHA_WALLETS",
  description:
    "Rank Robinhood Chain trader wallets by realized on-chain performance (smart-money discovery). net_eth is realized net flow (sell − buy); win_rate is the share of tokens taken out profitably; likely_bot flags arb/MM fleets. Filter by classification (human/bot/smart_money), identity (known_kol/unknown), memecoin_share, and more. PRO+.",
  similes: [
    "robinhood chain alpha wallets",
    "rhc smart money",
    "best traders on robinhood chain",
    "rhc wallet ranking",
    "smart money wallets robinhood chain",
  ],

  validate: async (_runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
    const text = (message.content?.text || "").toLowerCase();
    return /\b(rhc|robinhood)\b/.test(text) && /\b(alpha|smart money|best trader|top wallet|wallet ranking)/.test(text);
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
    const classification = text.includes("smart money") ? "smart_money" : text.includes("bot") ? "bot" : text.includes("human") ? "human" : "all";
    const identity = text.includes("unknown") ? "unknown" : text.includes("known kol") || text.includes("kol") ? "known_kol" : "all";

    const result = await client.getAlphaWallets({ classification: classification as "all" | "human" | "bot" | "smart_money", identity: identity as "all" | "known_kol" | "unknown", limit: 15 });

    if (result.error) {
      callback?.({ text: result.status === 401 ? AUTH_HINT : result.status === 403 ? "This endpoint requires the PRO tier or higher. See https://madeonsol.com/pricing." : `Error: ${result.error}` });
      return undefined;
    }

    const data = result.data!;
    const lines = (data.wallets || []).slice(0, 12).map(
      (w, i) => `${i + 1}. ${w.wallet.slice(0, 10)}… [${w.classification}${w.is_known_kol ? ", KOL" : ""}] — net ${Number(w.net_eth).toFixed(3)} ETH, win ${w.win_rate != null ? `${(w.win_rate * 100).toFixed(0)}%` : "?"}, ${w.tokens} tokens`,
    );

    callback?.({ text: `Robinhood Chain alpha wallets (${data.total} total):\n${lines.join("\n")}`, content: toContent(data) });
    return undefined;
  },

  examples: [
    [
      { name: "user1", content: { text: "Show smart-money wallets on Robinhood Chain." } },
      { name: "assistant", content: { text: "Here are the RHC alpha wallets..." } },
    ],
  ] as Action["examples"],
};
