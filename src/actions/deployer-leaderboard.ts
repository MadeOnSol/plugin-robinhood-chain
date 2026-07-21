import type { Action, IAgentRuntime, Memory, State, HandlerCallback } from "@elizaos/core";
import { RobinhoodChainClient } from "../client.js";
import { RHC_CLIENT_KEY } from "../index.js";
import { toContent } from "../content.js";

function getClient(runtime: IAgentRuntime): RobinhoodChainClient {
  return ((runtime as unknown as Record<string, unknown>)[RHC_CLIENT_KEY] as RobinhoodChainClient) ?? new RobinhoodChainClient();
}

const AUTH_HINT = "Authentication required. Set ROBINHOOD_CHAIN_API_KEY (or MADEONSOL_API_KEY) — get a free `msk_` key at https://madeonsol.com/developer.";

export const rhcDeployerLeaderboardAction: Action = {
  name: "GET_RHC_DEPLOYER_LEADERBOARD",
  description:
    "Get the Robinhood Chain deployer reputation leaderboard. Most RHC launchpads are direct-to-DEX, so graduation is a market-cap milestone: graduation_rate = share of a deployer's tokens that hit $40K+ peak MC; runner_rate = share that hit $100K+. tier is elite/good/neutral/spammer. Sortable and filterable by tier/min_tokens. BASIC+.",
  similes: [
    "robinhood chain deployer leaderboard",
    "rhc top deployers",
    "best deployers on robinhood chain",
    "rhc deployer reputation ranking",
  ],

  validate: async (_runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
    const text = (message.content?.text || "").toLowerCase();
    return /\b(rhc|robinhood)\b/.test(text) && /\b(deployer)\b/.test(text) && /\b(leaderboard|top|best|ranking)\b/.test(text);
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
    const tier = (["elite", "good", "neutral", "spammer"] as const).find((t) => text.includes(t));
    const sort = text.includes("runner") ? "runner_rate" : text.includes("peak") ? "best_peak_mc_usd" : "graduation_rate";

    const result = await client.getDeployerLeaderboard({ sort: sort as "graduation_rate" | "runner_rate" | "best_peak_mc_usd", limit: 15, ...(tier ? { tier } : {}) });

    if (result.error) {
      callback?.({ text: result.status === 401 ? AUTH_HINT : `Error: ${result.error}` });
      return undefined;
    }

    const data = result.data!;
    const lines = (data.deployers || []).slice(0, 12).map(
      (d, i) => `${i + 1}. ${d.deployer_address.slice(0, 10)}… [${d.tier}] — ${d.tokens_deployed} tokens, grad ${(d.graduation_rate * 100).toFixed(0)}%, run ${(d.runner_rate * 100).toFixed(0)}%`,
    );

    callback?.({ text: `Robinhood Chain deployer leaderboard (${data.total} total, sort=${sort}):\n${lines.join("\n")}`, content: toContent(data) });
    return undefined;
  },

  examples: [
    [
      { name: "user1", content: { text: "Show the top deployers on Robinhood Chain by graduation rate." } },
      { name: "assistant", content: { text: "Here's the RHC deployer leaderboard..." } },
    ],
  ] as Action["examples"],
};
