import type { Action, IAgentRuntime, Memory, State, HandlerCallback } from "@elizaos/core";
import { RobinhoodChainClient } from "../client.js";
import { RHC_CLIENT_KEY } from "../index.js";
import { toContent } from "../content.js";

function getClient(runtime: IAgentRuntime): RobinhoodChainClient {
  return ((runtime as unknown as Record<string, unknown>)[RHC_CLIENT_KEY] as RobinhoodChainClient) ?? new RobinhoodChainClient();
}

const AUTH_HINT = "Authentication required. Set ROBINHOOD_CHAIN_API_KEY (or MADEONSOL_API_KEY) — get a free `msk_` key at https://madeonsol.com/pricing.";

type Scout = {
  name: string | null;
  first_touches_30d: number;
  avg_followers_4h: number | null;
  swarm_3plus_pct: number | null;
  scout_tier: "S" | "A" | "B" | "C" | null;
};

export const rhcKolScoutsAction: Action = {
  name: "GET_RHC_KOL_SCOUTS",
  description:
    "Get the Robinhood Chain scout KOL leaderboard: KOLs whose first touches (a buy of a token no KOL bought before) drew other KOLs within 4 hours, over the last 30 days. Per KOL: first touches, avg_followers_4h, swarm_3plus_pct / swarm_5plus_pct and scout_tier (S/A/B/C on swarm_3plus_pct). KOLs with fewer than min_first_touches (default 30) are left out. PRO+.",
  similes: [
    "rhc scout leaderboard",
    "robinhood chain scouts",
    "which kols find tokens first on robinhood chain",
    "rhc kol scouts",
  ],

  validate: async (_runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
    const text = message.content?.text || "";
    return /\bscouts?\b/i.test(text) && /\b(robinhood|rhc)\b/i.test(text);
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    _options?: unknown,
    callback?: HandlerCallback,
  ) => {
    const client = getClient(runtime);
    const tier = (message.content?.text || "").match(/\btier\s+([SABC])\b/)?.[1] as "S" | "A" | "B" | "C" | undefined;
    const result = await client.getKolScoutLeaderboard({ limit: 10, scout_tier: tier });
    if (result.error) {
      callback?.({ text: result.status === 401 ? AUTH_HINT : `Error: ${result.error}` });
      return undefined;
    }

    const data = result.data as { scouts?: Scout[] } | undefined;
    const scouts = data?.scouts ?? [];
    if (scouts.length === 0) {
      callback?.({ text: "No Robinhood Chain scouts meet the first-touch minimum right now.", content: toContent(data) });
      return undefined;
    }
    const lines = scouts.slice(0, 10).map((s, i) =>
      `${i + 1}. ${s.name ?? "unnamed KOL"}${s.scout_tier ? ` [${s.scout_tier}]` : ""}: ${s.first_touches_30d} first touches${s.swarm_3plus_pct != null ? `, ${s.swarm_3plus_pct.toFixed(1)}% drew 3+ KOLs` : ""}${s.avg_followers_4h != null ? `, ${s.avg_followers_4h.toFixed(1)} avg followers in 4h` : ""}`,
    );
    callback?.({ text: `Robinhood Chain scout KOLs (30 days):\n${lines.join("\n")}`, content: toContent(data) });
    return undefined;
  },

  examples: [
    [
      { name: "user1", content: { text: "Who are the best scouts on Robinhood Chain?" } },
      { name: "assistant", content: { text: "Here are the Robinhood Chain scout KOLs..." } },
    ],
  ] as Action["examples"],
};
