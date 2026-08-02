import type { Action, IAgentRuntime, Memory, State, HandlerCallback } from "@elizaos/core";
import { RobinhoodChainClient } from "../client.js";
import { RHC_CLIENT_KEY } from "../index.js";
import { toContent } from "../content.js";

function getClient(runtime: IAgentRuntime): RobinhoodChainClient {
  return ((runtime as unknown as Record<string, unknown>)[RHC_CLIENT_KEY] as RobinhoodChainClient) ?? new RobinhoodChainClient();
}

const AUTH_HINT = "Authentication required. Set ROBINHOOD_CHAIN_API_KEY (or MADEONSOL_API_KEY) — get a free `msk_` key at https://madeonsol.com/pricing.";
const ID_RE = /(?:alert|id|#)\s*#?\s*(\d{1,12})\b/i;

export const rhcPriceAlertsAction: Action = {
  name: "MANAGE_RHC_PRICE_ALERTS",
  description:
    "List, pause, resume or delete your Robinhood Chain price alerts. An alert is market-cap denominated: the baseline MC is captured when the alert is created, and it fires on a `drop_pct` fall from that baseline, with an optional `recovery_pct` second leg off the dip low. IMPORTANT LATENCY CAVEAT: RHC alerts are evaluated on a ~15 SECOND POLL of the RHC price table, not a live price loop — effective latency is that interval plus the token's own price-update cadence. They are NOT sub-second like the Solana price alerts, and a strategy sized on that assumption will be wrong. Alerts expire 30 days after creation, and the quota is PER CHAIN. `token_address`, `drop_pct` and `recovery_pct` are immutable — delete and recreate to change a threshold. Lists by default; deletes or toggles only when the message names an explicit numeric alert id. Creating an alert needs a webhook URL and returns a one-time secret, so use the typed client's createPriceAlert for that. PRO+.",
  similes: [
    "robinhood chain price alerts",
    "rhc price alerts",
    "list my rhc price alerts",
    "pause my robinhood chain price alert",
    "delete rhc price alert",
  ],

  validate: async (_runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
    const text = (message.content?.text || "").toLowerCase();
    return (
      /\b(rhc|robinhood)\b/.test(text) &&
      /\bprice alerts?\b/.test(text) &&
      !/\b(events?|fired|fire history)\b/.test(text)
    );
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    _options?: unknown,
    callback?: HandlerCallback,
  ) => {
    const client = getClient(runtime);
    const text = message.content?.text || "";
    const id = Number(text.match(ID_RE)?.[1]);
    const hasId = Number.isInteger(id) && id > 0;

    const wantsDelete = /\b(delete|remove|drop)\b/i.test(text);
    const wantsPause = /\b(pause|disable|deactivate|stop|mute)\b/i.test(text);
    const wantsResume = /\b(resume|enable|reactivate|re-?activate|activate|unmute)\b/i.test(text);

    if ((wantsDelete || wantsPause || wantsResume) && !hasId) {
      callback?.({
        text: "Which alert? Name an explicit numeric alert id (for example \"delete RHC price alert 7\"). Ask me to list your alerts first if you don't know it.",
      });
      return undefined;
    }

    if (hasId && wantsDelete) {
      const del = await client.deletePriceAlert(id);
      if (del.error) {
        callback?.({ text: del.status === 401 ? AUTH_HINT : `Error: ${del.error}` });
        return undefined;
      }
      callback?.({ text: `Deleted Robinhood Chain price alert ${id}.`, content: toContent(del.data!) });
      return undefined;
    }

    if (hasId && (wantsPause || wantsResume)) {
      const patched = await client.updatePriceAlert(id, { is_active: !wantsPause });
      if (patched.error) {
        callback?.({ text: patched.status === 401 ? AUTH_HINT : `Error: ${patched.error}` });
        return undefined;
      }
      const a = patched.data!.alert;
      callback?.({
        text: `Robinhood Chain price alert ${a.id} is now ${a.is_active ? "active" : "paused"}.`,
        content: toContent(patched.data!),
      });
      return undefined;
    }

    if (hasId) {
      const one = await client.getPriceAlert(id);
      if (one.error) {
        callback?.({ text: one.status === 401 ? AUTH_HINT : `Error: ${one.error}` });
        return undefined;
      }
      const a = one.data!.alert;
      callback?.({
        text: `RHC price alert ${a.id} (${a.name || "unnamed"}) on ${a.token_symbol || a.token_address.slice(0, 10)} — ${a.drop_pct}% drop from a $${a.baseline_mc_usd} baseline${a.recovery_pct ? `, ${a.recovery_pct}% recovery leg` : ""}, status ${a.status}, ${a.is_active ? "active" : "paused"}, expires ${a.expires_at}.`,
        content: toContent(one.data!),
      });
      return undefined;
    }

    const result = await client.getPriceAlerts();
    if (result.error) {
      callback?.({ text: result.status === 401 ? AUTH_HINT : `Error: ${result.error}` });
      return undefined;
    }

    const data = result.data!;
    const lines = (data.alerts || []).map(
      (a) =>
        `#${a.id} ${a.name || "unnamed"} — ${a.token_symbol || a.token_address.slice(0, 10)}, -${a.drop_pct}% from $${a.baseline_mc_usd} MC${a.recovery_pct ? ` (+${a.recovery_pct}% recovery)` : ""}, status ${a.status}, ${a.is_active ? "active" : "paused"}`,
    );

    callback?.({
      text: `Robinhood Chain price alerts (${lines.length}) — evaluated on a ~15s poll, not sub-second:\n${lines.join("\n") || "None yet — create one with the typed client's createPriceAlert()."}`,
      content: toContent(data),
    });
    return undefined;
  },

  examples: [
    [
      { name: "user1", content: { text: "List my Robinhood Chain price alerts." } },
      { name: "assistant", content: { text: "Here are your RHC price alerts..." } },
    ],
    [
      { name: "user1", content: { text: "Delete RHC price alert 7." } },
      { name: "assistant", content: { text: "Deleted Robinhood Chain price alert 7." } },
    ],
  ] as Action["examples"],
};
