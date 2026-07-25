import type { Action, IAgentRuntime, Memory, State, HandlerCallback } from "@elizaos/core";
import { RobinhoodChainClient } from "../client.js";
import { RHC_CLIENT_KEY } from "../index.js";
import { toContent } from "../content.js";

function getClient(runtime: IAgentRuntime): RobinhoodChainClient {
  return ((runtime as unknown as Record<string, unknown>)[RHC_CLIENT_KEY] as RobinhoodChainClient) ?? new RobinhoodChainClient();
}

const AUTH_HINT = "Authentication required. Set ROBINHOOD_CHAIN_API_KEY (or MADEONSOL_API_KEY) — get a free `msk_` key at https://madeonsol.com/pricing.";
const PRO_HINT = "This endpoint requires the PRO tier or higher. See https://madeonsol.com/pricing.";
const EVM_RE = /\b(0x[0-9a-fA-F]{40})\b/;

export const rhcDeployerHistoryAction: Action = {
  name: "GET_RHC_DEPLOYER_HISTORY",
  description:
    "Get a Robinhood Chain deployer's full deploy history — their reputation row (tier, graduation_rate, runner_rate, best peak MC, launchpads, deploy timeline) plus every token they deployed, newest first, enriched with live MC, peak MC and graduation status. Deep pagination (limit up to 1000). Robinhood Chain has no per-day reputation snapshots, so this is a token-deploy history, NOT a daily tier time-series. Unknown wallets return is_deployer:false. PRO+.",
  similes: [
    "robinhood chain deployer history",
    "rhc deployer full deploy history",
    "every token this rhc deployer ever made",
    "rhc deployer track record",
  ],

  validate: async (_runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
    const text = (message.content?.text || "").toLowerCase();
    return /\bdeployer\b/.test(text) && /\b(history|track record|full record|ever)\b/.test(text) && EVM_RE.test(text);
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

    const result = await client.getDeployerHistory(address, { limit: 100 });

    if (result.error) {
      callback?.({ text: result.status === 401 ? AUTH_HINT : result.status === 403 ? PRO_HINT : `Error: ${result.error}` });
      return undefined;
    }

    const data = result.data!;
    if (!data.is_deployer || !data.deployer) {
      callback?.({ text: `${address.slice(0, 10)}… has never deployed a tracked token on Robinhood Chain.`, content: toContent(data) });
      return undefined;
    }
    const d = data.deployer;
    const graduated = data.tokens.filter((t) => t.is_graduated).length;
    const summary = [
      `Robinhood Chain deployer ${address.slice(0, 10)}… [${d.tier}] — ${data.total} tokens deployed`,
      `• Runner rate ${(d.runner_rate * 100).toFixed(0)}% ($100K+ peaks, ${d.runners}), graduation rate ${(d.graduation_rate * 100).toFixed(0)}% ($40K+ peaks, ${d.graduated})`,
      `• This page: ${data.tokens.length} tokens, ${graduated} graduated${data.has_more ? " (more pages available)" : ""}`,
    ].join("\n");

    callback?.({ text: summary, content: toContent(data) });
    return undefined;
  },

  examples: [
    [
      { name: "user1", content: { text: "Show the full deploy history for Robinhood Chain deployer 0x1234567890abcdef1234567890abcdef12345678" } },
      { name: "assistant", content: { text: "Here's that RHC deployer's full history..." } },
    ],
  ] as Action["examples"],
};
