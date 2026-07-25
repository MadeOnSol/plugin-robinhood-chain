import type { Action, IAgentRuntime, Memory, State, HandlerCallback } from "@elizaos/core";
import { RobinhoodChainClient } from "../client.js";
import { RHC_CLIENT_KEY } from "../index.js";
import { toContent } from "../content.js";

function getClient(runtime: IAgentRuntime): RobinhoodChainClient {
  return ((runtime as unknown as Record<string, unknown>)[RHC_CLIENT_KEY] as RobinhoodChainClient) ?? new RobinhoodChainClient();
}

const AUTH_HINT = "Authentication required. Set ROBINHOOD_CHAIN_API_KEY (or MADEONSOL_API_KEY) — get a free `msk_` key at https://madeonsol.com/pricing.";

const TIERS = ["elite", "good", "neutral", "spammer"] as const;

export const rhcRecentBondsAction: Action = {
  name: "GET_RHC_RECENT_BONDS",
  description:
    "Get recent graduations on Robinhood Chain, newest peak first. On RHC a \"graduation\" is the $40,000 peak market-cap milestone, NOT a bonding-curve completion — most RHC launchpads (noxa, pons, clanker) launch direct-to-DEX with no curve, so the set is defined purely by peak MC. Each row carries symbol, launchpad, deployer address + reputation tier, live MC, peak MC and the peak timestamp. Filter by deployer_tier, or raise the floor with min_peak (it can only raise, never lower, the $40K bar). BASIC+.",
  similes: [
    "robinhood chain recent graduations",
    "rhc recent bonds",
    "what just graduated on robinhood chain",
    "rhc tokens that hit 40k",
  ],

  validate: async (_runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
    const text = (message.content?.text || "").toLowerCase();
    return /\b(rhc|robinhood)\b/.test(text) && /\b(graduat|bonded|bonds|recent bond)/.test(text);
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
    const deployerTier = TIERS.find((t) => text.includes(t));

    const result = await client.getRecentBonds({ limit: 20, ...(deployerTier ? { deployer_tier: deployerTier } : {}) });

    if (result.error) {
      callback?.({ text: result.status === 401 ? AUTH_HINT : `Error: ${result.error}` });
      return undefined;
    }

    const data = result.data!;
    const fmtUsd = (v?: number | null) => (v == null ? "?" : v >= 1e6 ? `$${(v / 1e6).toFixed(2)}M` : v >= 1e3 ? `$${(v / 1e3).toFixed(1)}K` : `$${v.toFixed(0)}`);
    const lines = (data.tokens || []).slice(0, 12).map(
      (t) => `${t.symbol || t.address.slice(0, 10)} — peak ${fmtUsd(t.peak_mc_usd)}, now ${fmtUsd(t.market_cap_usd)}${t.deployer_tier ? ` [${t.deployer_tier}]` : ""}${t.launchpad ? ` (${t.launchpad})` : ""}`,
    );

    callback?.({
      text: `Robinhood Chain recent graduations (peak MC >= $${data.graduation_mc.toLocaleString("en-US")}):\n${lines.join("\n") || "None."}`,
      content: toContent(data),
    });
    return undefined;
  },

  examples: [
    [
      { name: "user1", content: { text: "What just graduated on Robinhood Chain?" } },
      { name: "assistant", content: { text: "Here are the most recent RHC graduations..." } },
    ],
  ] as Action["examples"],
};
