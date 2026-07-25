import type { Action, IAgentRuntime, Memory, State, HandlerCallback } from "@elizaos/core";
import { RobinhoodChainClient } from "../client.js";
import { RHC_CLIENT_KEY } from "../index.js";
import { toContent } from "../content.js";

function getClient(runtime: IAgentRuntime): RobinhoodChainClient {
  return ((runtime as unknown as Record<string, unknown>)[RHC_CLIENT_KEY] as RobinhoodChainClient) ?? new RobinhoodChainClient();
}

const AUTH_HINT = "Authentication required. Set ROBINHOOD_CHAIN_API_KEY (or MADEONSOL_API_KEY) — get a free `msk_` key at https://madeonsol.com/pricing.";

const TIERS = ["elite", "good", "neutral", "spammer"] as const;

export const rhcDeployerAlertsAction: Action = {
  name: "GET_RHC_DEPLOYER_ALERTS",
  description:
    "Get the live Robinhood Chain deployer alert feed — new_deploy and graduated events from tracked deployers, newest first, each with the token, launchpad, MC at alert, current MC, liquidity and priority (high/medium). A tradability filter runs BY DEFAULT (liquidity_usd >= $100) so drained pools are not served as buy signals; pass include_untradeable=true for the raw tape. deployer_tier is resolved at READ time from the live reputation table — tier_at_alert holds the snapshot and tier_is_stale flags drift. Tiers ride runner_rate ($100K peak MC) since migration 267. Poll forward with since, page back with before. BASIC+ (ULTRA gets the full limit; BASIC/PRO cap at 50).",
  similes: [
    "robinhood chain deployer alerts",
    "rhc deployer alert feed",
    "new deploys on robinhood chain",
    "rhc deployer signals",
  ],

  validate: async (_runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
    const text = (message.content?.text || "").toLowerCase();
    return /\b(rhc|robinhood)\b/.test(text) && /\b(alert|signal|new deploy|just deployed|notification)/.test(text);
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
    const alertType = text.includes("graduat") ? "graduated" : text.includes("new deploy") ? "new_deploy" : undefined;

    const result = await client.getDeployerAlerts({
      limit: 25,
      ...(deployerTier ? { deployer_tier: deployerTier } : {}),
      ...(alertType ? { alert_type: alertType as "new_deploy" | "graduated" } : {}),
    });

    if (result.error) {
      callback?.({ text: result.status === 401 ? AUTH_HINT : `Error: ${result.error}` });
      return undefined;
    }

    const data = result.data!;
    const fmtUsd = (v?: number | null) => (v == null ? "?" : v >= 1e6 ? `$${(v / 1e6).toFixed(2)}M` : v >= 1e3 ? `$${(v / 1e3).toFixed(1)}K` : `$${v.toFixed(0)}`);
    const lines = (data.alerts || []).slice(0, 12).map(
      (a) => `${a.token_symbol || a.token_address.slice(0, 10)} — ${a.alert_type} [${a.tier ?? "?"}${a.tier_is_stale ? ", was " + a.tier_at_alert : ""}], MC ${fmtUsd(a.current_mc_usd ?? a.mc_at_alert)}, liq ${fmtUsd(a.liquidity_usd)}`,
    );

    callback?.({
      text: `Robinhood Chain deployer alerts (${data.alerts.length}, tradability filter: ${data.tradability_filter}):\n${lines.join("\n") || "None."}`,
      content: toContent(data),
    });
    return undefined;
  },

  examples: [
    [
      { name: "user1", content: { text: "Show the latest Robinhood Chain deployer alerts from elite deployers." } },
      { name: "assistant", content: { text: "Here are the recent RHC deployer alerts..." } },
    ],
  ] as Action["examples"],
};
