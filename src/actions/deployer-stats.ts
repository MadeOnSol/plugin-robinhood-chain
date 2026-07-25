import type { Action, IAgentRuntime, Memory, State, HandlerCallback } from "@elizaos/core";
import { RobinhoodChainClient } from "../client.js";
import { RHC_CLIENT_KEY } from "../index.js";
import { toContent } from "../content.js";

function getClient(runtime: IAgentRuntime): RobinhoodChainClient {
  return ((runtime as unknown as Record<string, unknown>)[RHC_CLIENT_KEY] as RobinhoodChainClient) ?? new RobinhoodChainClient();
}

const AUTH_HINT = "Authentication required. Set ROBINHOOD_CHAIN_API_KEY (or MADEONSOL_API_KEY) — get a free `msk_` key at https://madeonsol.com/pricing.";

export const rhcDeployerStatsAction: Action = {
  name: "GET_RHC_DEPLOYER_STATS",
  description:
    "Get the chain-wide Robinhood Chain deployer reputation summary — total deployers and tokens, deployer/token population per tier, reputable (elite+good) count, spam token share, and 24h/7d alert volume. Also returns tier_rules, the thresholds actually in force: elite and good are earned on runner_rate (peak MC >= $100,000) and require deploy history; spammer keys off graduation_rate (peak MC >= $40,000). graduation_rate is still reported but no longer sets the tier. BASIC+.",
  similes: [
    "robinhood chain deployer stats",
    "rhc deployer tier breakdown",
    "how many deployers on robinhood chain",
    "rhc spam rate deployers",
  ],

  validate: async (_runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
    const text = (message.content?.text || "").toLowerCase();
    return /\b(rhc|robinhood)\b/.test(text) && /\bdeployer/.test(text) && /\b(stats|statistics|summary|breakdown|how many|overview|spam)\b/.test(text);
  },

  handler: async (
    runtime: IAgentRuntime,
    _message: Memory,
    _state?: State,
    _options?: unknown,
    callback?: HandlerCallback,
  ) => {
    const client = getClient(runtime);
    const result = await client.getDeployerStats();

    if (result.error) {
      callback?.({ text: result.status === 401 ? AUTH_HINT : `Error: ${result.error}` });
      return undefined;
    }

    const data = result.data!;
    const tiers = Object.entries(data.by_tier)
      .map(([tier, v]) => `${tier} ${v.deployers}`)
      .join(", ");
    const summary = [
      `Robinhood Chain deployers: ${data.total_deployers} tracked across ${data.total_tokens} tokens`,
      `• Tiers — ${tiers}. Reputable (elite+good): ${data.reputable_deployers}`,
      `• Spam token share ${data.spam_token_share != null ? `${(data.spam_token_share * 100).toFixed(1)}%` : "?"} · alerts 24h ${data.alerts_24h}, 7d ${data.alerts_7d}`,
      `• Tier basis: ${data.runner_definition} sets elite/good; ${data.graduation_definition} is the graduation bar`,
    ].join("\n");

    callback?.({ text: summary, content: toContent(data) });
    return undefined;
  },

  examples: [
    [
      { name: "user1", content: { text: "Give me the Robinhood Chain deployer stats overview." } },
      { name: "assistant", content: { text: "Here's the RHC deployer reputation summary..." } },
    ],
  ] as Action["examples"],
};
