import type { Action, IAgentRuntime, Memory, State, HandlerCallback } from "@elizaos/core";
import { RobinhoodChainClient } from "../client.js";
import { RHC_CLIENT_KEY } from "../index.js";
import { toContent } from "../content.js";

function getClient(runtime: IAgentRuntime): RobinhoodChainClient {
  return ((runtime as unknown as Record<string, unknown>)[RHC_CLIENT_KEY] as RobinhoodChainClient) ?? new RobinhoodChainClient();
}

const AUTH_HINT = "Authentication required. Set ROBINHOOD_CHAIN_API_KEY (or MADEONSOL_API_KEY) — get a free `msk_` key at https://madeonsol.com/pricing.";
/** Rule ids on this route are UUIDs, not integers. */
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

export const rhcCoordinationAlertsAction: Action = {
  name: "MANAGE_RHC_COORDINATION_ALERTS",
  description:
    "List, pause, resume or delete your Robinhood Chain KOL coordination alert rules. A rule fires when `min_kols`+ distinct tracked KOLs buy the same RHC token inside a rolling window, with a minimum score, a cooldown, an optional market-cap band, and a `score_jump_break` that lets a materially stronger signal re-fire inside the cooldown. Scoring is the shared v1 scorer so the number is comparable to Solana, but be precise about what is measured: on RHC the `quality` component is real (KOL 7-day win rate) while `earliness` is DEFAULTED — RHC has no early-entry equivalent — and every fired signal records which components were real in `score_inputs`. The rule quota is PER CHAIN. Rule ids are UUIDs. Lists by default; deletes or toggles only when the message names an explicit rule UUID. Creating a rule may need a webhook URL and returns a one-time secret, so use the typed client's createCoordinationAlert for that. PRO+.",
  similes: [
    "robinhood chain coordination alerts",
    "rhc kol coordination alert rules",
    "list my rhc coordination alerts",
    "pause my robinhood chain coordination alert",
    "delete rhc coordination alert rule",
  ],

  validate: async (_runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
    const text = (message.content?.text || "").toLowerCase();
    return (
      /\b(rhc|robinhood)\b/.test(text) &&
      /\bcoordination\b/.test(text) &&
      /\b(alert|alerts|rule|rules|subscription|subscriptions)\b/.test(text)
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
    const id = text.match(UUID_RE)?.[0];

    const wantsDelete = /\b(delete|remove|drop)\b/i.test(text);
    const wantsPause = /\b(pause|disable|deactivate|stop|mute)\b/i.test(text);
    const wantsResume = /\b(resume|enable|reactivate|re-?activate|activate|unmute)\b/i.test(text);

    if ((wantsDelete || wantsPause || wantsResume) && !id) {
      callback?.({
        text: "Which rule? RHC coordination alert rule ids are UUIDs — name the full id. Ask me to list your rules first if you don't have it.",
      });
      return undefined;
    }

    if (id && wantsDelete) {
      const del = await client.deleteCoordinationAlert(id);
      if (del.error) {
        callback?.({ text: del.status === 401 ? AUTH_HINT : `Error: ${del.error}` });
        return undefined;
      }
      callback?.({ text: `Deleted Robinhood Chain coordination alert rule ${id}.`, content: toContent(del.data!) });
      return undefined;
    }

    if (id && (wantsPause || wantsResume)) {
      const patched = await client.updateCoordinationAlert(id, { is_active: !wantsPause });
      if (patched.error) {
        callback?.({ text: patched.status === 401 ? AUTH_HINT : `Error: ${patched.error}` });
        return undefined;
      }
      const r = patched.data!.rule;
      callback?.({
        text: `Robinhood Chain coordination alert rule ${r.id} is now ${r.is_active ? "active" : "paused"}.`,
        content: toContent(patched.data!),
      });
      return undefined;
    }

    if (id) {
      const one = await client.getCoordinationAlert(id);
      if (one.error) {
        callback?.({ text: one.status === 401 ? AUTH_HINT : `Error: ${one.error}` });
        return undefined;
      }
      const r = one.data!.rule;
      callback?.({
        text: `RHC coordination rule ${r.id} (${r.name || "unnamed"}) — ${r.min_kols}+ KOLs in ${r.window_minutes}m, min score ${r.min_score}, cooldown ${r.cooldown_min}m, via ${r.delivery_mode}, ${r.is_active ? "active" : "paused"}.`,
        content: toContent(one.data!),
      });
      return undefined;
    }

    const result = await client.getCoordinationAlerts();
    if (result.error) {
      callback?.({ text: result.status === 401 ? AUTH_HINT : `Error: ${result.error}` });
      return undefined;
    }

    const data = result.data!;
    const lines = (data.rules || []).map(
      (r) =>
        `${r.id} ${r.name || "unnamed"} — ${r.min_kols}+ KOLs in ${r.window_minutes}m, min score ${r.min_score}, cooldown ${r.cooldown_min}m, via ${r.delivery_mode}, ${r.is_active ? "active" : "paused"}`,
    );

    callback?.({
      text: `Robinhood Chain coordination alert rules (${lines.length}):\n${lines.join("\n") || "None yet — create one with the typed client's createCoordinationAlert()."}`,
      content: toContent(data),
    });
    return undefined;
  },

  examples: [
    [
      { name: "user1", content: { text: "List my Robinhood Chain KOL coordination alert rules." } },
      { name: "assistant", content: { text: "Here are your RHC coordination alert rules..." } },
    ],
  ] as Action["examples"],
};
