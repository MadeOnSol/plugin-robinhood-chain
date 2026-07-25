import type { Action, IAgentRuntime, Memory, State, HandlerCallback } from "@elizaos/core";
import { RobinhoodChainClient } from "../client.js";
import { RHC_CLIENT_KEY } from "../index.js";
import { toContent } from "../content.js";

function getClient(runtime: IAgentRuntime): RobinhoodChainClient {
  return ((runtime as unknown as Record<string, unknown>)[RHC_CLIENT_KEY] as RobinhoodChainClient) ?? new RobinhoodChainClient();
}

const AUTH_HINT = "Authentication required. Set ROBINHOOD_CHAIN_API_KEY (or MADEONSOL_API_KEY) — get a free `msk_` key at https://madeonsol.com/pricing.";
const EVM_RE = /\b(0x[0-9a-fA-F]{40})\b/;

export const rhcDeployerTrajectoryAction: Action = {
  name: "GET_RHC_DEPLOYER_TRAJECTORY",
  description:
    "Get a Robinhood Chain deployer's skill curve over time — is this deployer improving or declining? Returns the current streak, longest hit/miss streaks, a 10-token rolling success rate, an improving/declining/stable trend, average days between deploys, and average recovery (launches burned between a miss and the next hit). The per-token success event is the $40K peak-MC GRADUATION, not a bonding curve (RHC launchpads are direct-to-DEX) — the response says so in success_metric. Capped at 500 tokens; truncated flags a partial curve. Unknown wallets return is_deployer:false. BASIC+.",
  similes: [
    "robinhood chain deployer trajectory",
    "rhc deployer getting better or worse",
    "is this rhc deployer improving",
    "rhc deployer skill curve",
    "rhc deployer streak",
  ],

  validate: async (_runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
    const text = (message.content?.text || "").toLowerCase();
    return /\b(trajectory|improving|declining|getting better|getting worse|streak|skill curve|trend)\b/.test(text) && EVM_RE.test(text);
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
      callback?.({ text: "Please include a deployer EVM wallet address (0x, 40 hex)." });
      return undefined;
    }

    const result = await client.getDeployerTrajectory(address);

    if (result.error) {
      callback?.({ text: result.status === 401 ? AUTH_HINT : `Error: ${result.error}` });
      return undefined;
    }

    const data = result.data!;
    if (!data.is_deployer || !data.trajectory) {
      callback?.({ text: `${address.slice(0, 10)}… has never deployed a tracked token on Robinhood Chain.`, content: toContent(data) });
      return undefined;
    }
    const t = data.trajectory;
    const summary = [
      `Robinhood Chain deployer ${address.slice(0, 10)}… is ${t.trend} (success = ${data.success_metric ?? "$40K+ peak MC"})`,
      `• Current streak: ${t.current_streak.count} ${t.current_streak.type}, longest hit ${t.longest_bond_streak}, longest miss ${t.longest_fail_streak}`,
      `• ${t.total_tokens_analyzed} tokens analyzed${data.truncated ? " (truncated at 500)" : ""}, ${t.avg_days_between_deploys ?? "?"} days between deploys`,
    ].join("\n");

    callback?.({ text: summary, content: toContent(data) });
    return undefined;
  },

  examples: [
    [
      { name: "user1", content: { text: "Is Robinhood Chain deployer 0x1234567890abcdef1234567890abcdef12345678 improving or declining?" } },
      { name: "assistant", content: { text: "Here's the RHC deployer trajectory..." } },
    ],
  ] as Action["examples"],
};
