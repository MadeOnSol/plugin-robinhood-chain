import type { Action, IAgentRuntime, Memory, State, HandlerCallback } from "@elizaos/core";
import { RobinhoodChainClient } from "../client.js";
import { RHC_CLIENT_KEY } from "../index.js";
import { toContent } from "../content.js";

function getClient(runtime: IAgentRuntime): RobinhoodChainClient {
  return ((runtime as unknown as Record<string, unknown>)[RHC_CLIENT_KEY] as RobinhoodChainClient) ?? new RobinhoodChainClient();
}

const AUTH_HINT = "Authentication required. Set ROBINHOOD_CHAIN_API_KEY (or MADEONSOL_API_KEY) — get a free `msk_` key at https://madeonsol.com/developer.";
const EVM_RE = /\b(0x[0-9a-fA-F]{40})\b/;

export const rhcDeployerProfileAction: Action = {
  name: "GET_RHC_DEPLOYER_PROFILE",
  description:
    "Get one Robinhood Chain deployer's full reputation row (tier, bonding_rate, runner_rate, best peak MC, launchpads, deploy timeline) plus their 50 most recent tokens with live MC and peak MC. Unknown wallets return is_deployer:false (not a 404). BASIC+.",
  similes: [
    "robinhood chain deployer profile",
    "rhc deployer stats",
    "is this a deployer on robinhood chain",
    "deployer reputation robinhood chain",
  ],

  validate: async (_runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
    const text = message.content?.text || "";
    return /\b(deployer|deployed|deploy)\b/i.test(text) && EVM_RE.test(text);
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

    const result = await client.getDeployer(address);

    if (result.error) {
      callback?.({ text: result.status === 401 ? AUTH_HINT : `Error: ${result.error}` });
      return undefined;
    }

    const data = result.data!;
    if (!data.is_deployer || !data.deployer) {
      callback?.({ text: `${address.slice(0, 10)}… has never deployed a tracked token on Robinhood Chain.`, content: toContent(data) });
      return undefined;
    }
    const d = data.deployer;
    const summary = [
      `Robinhood Chain deployer ${address.slice(0, 10)}… [${d.tier}]`,
      `• ${d.tokens_deployed} tokens deployed, ${d.graduated} graduated, ${d.runners} runners (${(d.runner_rate * 100).toFixed(0)}%)`,
      `• Best peak MC ${d.best_peak_mc_usd != null ? `$${Number(d.best_peak_mc_usd).toFixed(0)}` : "?"}, launchpads: ${d.launchpads.join(", ") || "?"}`,
    ].join("\n");

    callback?.({ text: summary, content: toContent(data) });
    return undefined;
  },

  examples: [
    [
      { name: "user1", content: { text: "Is 0x1234567890abcdef1234567890abcdef12345678 a deployer on Robinhood Chain?" } },
      { name: "assistant", content: { text: "Here's the RHC deployer profile..." } },
    ],
  ] as Action["examples"],
};
