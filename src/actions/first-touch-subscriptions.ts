import type { Action, IAgentRuntime, Memory, State, HandlerCallback } from "@elizaos/core";
import { RobinhoodChainClient } from "../client.js";
import { RHC_CLIENT_KEY } from "../index.js";
import { toContent } from "../content.js";

function getClient(runtime: IAgentRuntime): RobinhoodChainClient {
  return ((runtime as unknown as Record<string, unknown>)[RHC_CLIENT_KEY] as RobinhoodChainClient) ?? new RobinhoodChainClient();
}

const AUTH_HINT = "Authentication required. Set ROBINHOOD_CHAIN_API_KEY (or MADEONSOL_API_KEY) — get a free `msk_` key at https://madeonsol.com/pricing.";
/** Subscription ids on this route are UUIDs, not integers. */
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

export const rhcFirstTouchSubscriptionsAction: Action = {
  name: "MANAGE_RHC_FIRST_TOUCH_SUBSCRIPTIONS",
  description:
    "List, pause, resume or delete your Robinhood Chain KOL first-touch subscriptions — a push when an RHC token gets its FIRST buy from any tracked KOL, the earliest discovery signal on the chain. The filter set is RHC-specific and deliberately narrower than Solana's: `min_kol_winrate` and `strategy` are the quality gates because RHC has a KOL win rate but no scout score, so Solana's `min_scout_tier` / `min_n_touches` are NOT offered rather than shipped as filters that silently match nothing. You can also filter by a single `kol` address, `min_first_buy_eth` and a market-cap band. Unknown filter keys are rejected, not ignored, and `filters` is a whole-object replace on update. The quota is PER CHAIN and subscription ids are UUIDs. Lists by default; deletes or toggles only when the message names an explicit UUID. Creating a subscription may need a webhook URL and returns a one-time secret, so use the typed client's createFirstTouchSubscription for that. ULTRA+.",
  similes: [
    "robinhood chain first touch subscriptions",
    "rhc first touch alerts",
    "list my rhc first touch subscriptions",
    "pause my robinhood chain first touch subscription",
    "delete rhc first touch subscription",
  ],

  validate: async (_runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
    const text = (message.content?.text || "").toLowerCase();
    return (
      /\b(rhc|robinhood)\b/.test(text) &&
      /\bfirst[- ]touch(es)?\b/.test(text) &&
      /\b(subscription|subscriptions|alert|alerts|rule|rules|subscribe|subscribed)\b/.test(text)
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

    const wantsDelete = /\b(delete|remove|drop|unsubscribe)\b/i.test(text);
    const wantsPause = /\b(pause|disable|deactivate|stop|mute)\b/i.test(text);
    const wantsResume = /\b(resume|enable|reactivate|re-?activate|activate|unmute)\b/i.test(text);

    if ((wantsDelete || wantsPause || wantsResume) && !id) {
      callback?.({
        text: "Which subscription? RHC first-touch subscription ids are UUIDs — name the full id. Ask me to list your subscriptions first if you don't have it.",
      });
      return undefined;
    }

    if (id && wantsDelete) {
      const del = await client.deleteFirstTouchSubscription(id);
      if (del.error) {
        callback?.({ text: del.status === 401 ? AUTH_HINT : `Error: ${del.error}` });
        return undefined;
      }
      callback?.({ text: `Deleted Robinhood Chain first-touch subscription ${id}.`, content: toContent(del.data!) });
      return undefined;
    }

    if (id && (wantsPause || wantsResume)) {
      const patched = await client.updateFirstTouchSubscription(id, { is_active: !wantsPause });
      if (patched.error) {
        callback?.({ text: patched.status === 401 ? AUTH_HINT : `Error: ${patched.error}` });
        return undefined;
      }
      const s = patched.data!.subscription;
      callback?.({
        text: `Robinhood Chain first-touch subscription ${s.id} is now ${s.is_active ? "active" : "paused"}.`,
        content: toContent(patched.data!),
      });
      return undefined;
    }

    if (id) {
      const one = await client.getFirstTouchSubscription(id);
      if (one.error) {
        callback?.({ text: one.status === 401 ? AUTH_HINT : `Error: ${one.error}` });
        return undefined;
      }
      const s = one.data!.subscription;
      callback?.({
        text: `RHC first-touch subscription ${s.id} (${s.name || "unnamed"}) — filters ${JSON.stringify(s.filters ?? {})}, via ${s.delivery_mode}, ${s.is_active ? "active" : "paused"}.`,
        content: toContent(one.data!),
      });
      return undefined;
    }

    const result = await client.getFirstTouchSubscriptions();
    if (result.error) {
      callback?.({ text: result.status === 401 ? AUTH_HINT : `Error: ${result.error}` });
      return undefined;
    }

    const data = result.data!;
    const lines = (data.subscriptions || []).map(
      (s) =>
        `${s.id} ${s.name || "unnamed"} — filters ${JSON.stringify(s.filters ?? {})}, via ${s.delivery_mode}, ${s.is_active ? "active" : "paused"}`,
    );

    callback?.({
      text: `Robinhood Chain first-touch subscriptions (${lines.length}):\n${lines.join("\n") || "None yet — create one with the typed client's createFirstTouchSubscription()."}`,
      content: toContent(data),
    });
    return undefined;
  },

  examples: [
    [
      { name: "user1", content: { text: "List my Robinhood Chain first-touch subscriptions." } },
      { name: "assistant", content: { text: "Here are your RHC first-touch subscriptions..." } },
    ],
  ] as Action["examples"],
};
