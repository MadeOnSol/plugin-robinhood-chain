import type { Action, IAgentRuntime, Memory, State, HandlerCallback } from "@elizaos/core";
import { RobinhoodChainClient } from "../client.js";
import { RHC_CLIENT_KEY } from "../index.js";
import { toContent } from "../content.js";

function getClient(runtime: IAgentRuntime): RobinhoodChainClient {
  return ((runtime as unknown as Record<string, unknown>)[RHC_CLIENT_KEY] as RobinhoodChainClient) ?? new RobinhoodChainClient();
}

const AUTH_HINT = "Authentication required. Set ROBINHOOD_CHAIN_API_KEY (or MADEONSOL_API_KEY) — get a free `msk_` key at https://madeonsol.com/pricing.";

const PERIODS = ["24h", "7d", "30d", "all"] as const;

export const rhcDeployerBestTokensAction: Action = {
  name: "GET_RHC_DEPLOYER_BEST_TOKENS",
  description:
    "Get the highest-peaking Robinhood Chain tokens launched by REPUTABLE deployers (elite or good tier) in a window — 24h, 7d, 30d or all. Ranked by peak MC, with each token's live MC, peak MC + peak time, liquidity, launchpad and its deployer's tier/graduation_rate/runner_rate. Deliberately gated on deployer tier: this answers \"what did the deployers worth tracking actually produce\", not \"what is the biggest token on the chain\". Scans at most 1000 candidates (truncated flags it). BASIC+.",
  similes: [
    "robinhood chain best tokens from good deployers",
    "rhc top tokens by reputable deployers",
    "best rhc launches this week",
    "what did elite robinhood chain deployers launch",
  ],

  validate: async (_runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
    const text = (message.content?.text || "").toLowerCase();
    return /\b(rhc|robinhood)\b/.test(text) && /\b(best|top|highest)\b/.test(text) && /\b(reputable|elite|good deployer|deployers|deployer)\b/.test(text) && /\b(token|launch)/.test(text);
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
    const period = PERIODS.find((p) => text.includes(p)) ?? (/\b(week|7 day)/.test(text) ? "7d" : /\b(month|30 day)/.test(text) ? "30d" : /\b(today|day|24 hour)/.test(text) ? "24h" : "7d");

    const result = await client.getDeployerBestTokens({ period, limit: 15 });

    if (result.error) {
      callback?.({ text: result.status === 401 ? AUTH_HINT : `Error: ${result.error}` });
      return undefined;
    }

    const data = result.data!;
    const fmtUsd = (v?: number | null) => (v == null ? "?" : v >= 1e6 ? `$${(v / 1e6).toFixed(2)}M` : v >= 1e3 ? `$${(v / 1e3).toFixed(1)}K` : `$${v.toFixed(0)}`);
    const lines = (data.tokens || []).slice(0, 12).map(
      (t, i) => `${i + 1}. ${t.symbol || t.address.slice(0, 10)} — peak ${fmtUsd(t.peak_mc_usd)}, now ${fmtUsd(t.market_cap_usd)}${t.deployer ? ` [${t.deployer.tier} deployer]` : ""}`,
    );

    callback?.({
      text: `Best Robinhood Chain tokens from reputable deployers (${data.period}, ${data.reputable_deployers} elite/good deployers${data.truncated ? ", candidate scan truncated" : ""}):\n${lines.join("\n") || "None in window."}`,
      content: toContent(data),
    });
    return undefined;
  },

  examples: [
    [
      { name: "user1", content: { text: "What are the best Robinhood Chain tokens from reputable deployers this week?" } },
      { name: "assistant", content: { text: "Here are the top RHC launches from elite/good deployers..." } },
    ],
  ] as Action["examples"],
};
