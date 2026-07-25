import type { Action, IAgentRuntime, Memory, State, HandlerCallback } from "@elizaos/core";
import { RobinhoodChainClient } from "../client.js";
import { RHC_CLIENT_KEY } from "../index.js";
import { toContent } from "../content.js";

function getClient(runtime: IAgentRuntime): RobinhoodChainClient {
  return ((runtime as unknown as Record<string, unknown>)[RHC_CLIENT_KEY] as RobinhoodChainClient) ?? new RobinhoodChainClient();
}

const AUTH_HINT = "Authentication required. Set ROBINHOOD_CHAIN_API_KEY (or MADEONSOL_API_KEY) — get a free `msk_` key at https://madeonsol.com/pricing.";

export const rhcKolLeaderboardAction: Action = {
  name: "GET_RHC_KOL_LEADERBOARD",
  description:
    "Get the KOL activity leaderboard on Robinhood Chain — KOLs ranked by trade count then net ETH flow (buy_eth − sell_eth) over a 24h/7d/30d window. EVM-native. BASIC+.",
  similes: [
    "robinhood chain kol leaderboard",
    "rhc top kols",
    "rhc kol rankings",
    "most active kols on robinhood chain",
  ],

  validate: async (_runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
    const text = (message.content?.text || "").toLowerCase();
    return /\b(rhc|robinhood)\b/.test(text) && /\b(leaderboard|top kol|kol rank|ranking)/.test(text);
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
    const period = text.includes("30d") || text.includes("month") ? "30d" : text.includes("7d") || text.includes("week") ? "7d" : "24h";

    const result = await client.getKolLeaderboard({ period, limit: 10 });

    if (result.error) {
      callback?.({ text: result.status === 401 ? AUTH_HINT : `Error: ${result.error}` });
      return undefined;
    }

    const data = result.data!;
    const lines = (data.leaderboard || []).slice(0, 10).map(
      (r, i) => `${i + 1}. ${r.kol_name || "Unnamed"} — ${r.trades} trades, net ${Number(r.net_eth).toFixed(3)} ETH, ${r.tokens_traded} tokens`,
    );

    callback?.({ text: `Robinhood Chain KOL leaderboard (${data.period}):\n${lines.join("\n")}`, content: toContent(data) });
    return undefined;
  },

  examples: [
    [
      { name: "user1", content: { text: "Show the Robinhood Chain KOL leaderboard for the last 7d." } },
      { name: "assistant", content: { text: "Here's the RHC KOL leaderboard..." } },
    ],
  ] as Action["examples"],
};
