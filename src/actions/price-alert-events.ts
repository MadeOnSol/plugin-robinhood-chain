import type { Action, IAgentRuntime, Memory, State, HandlerCallback } from "@elizaos/core";
import { RobinhoodChainClient } from "../client.js";
import { RHC_CLIENT_KEY } from "../index.js";
import { toContent } from "../content.js";

function getClient(runtime: IAgentRuntime): RobinhoodChainClient {
  return ((runtime as unknown as Record<string, unknown>)[RHC_CLIENT_KEY] as RobinhoodChainClient) ?? new RobinhoodChainClient();
}

const AUTH_HINT = "Authentication required. Set ROBINHOOD_CHAIN_API_KEY (or MADEONSOL_API_KEY) — get a free `msk_` key at https://madeonsol.com/pricing.";
const ALERT_ID_RE = /(?:alert|id|#)\s*#?\s*(\d{1,12})\b/i;

export const rhcPriceAlertEventsAction: Action = {
  name: "GET_RHC_PRICE_ALERT_EVENTS",
  description:
    "Get the dip and recovery fire history of your Robinhood Chain price alerts, newest first — each event carries the baseline MC, the market cap at fire time, the actual drop or recovery percentage, the dip low, and whether delivery succeeded. This is the CATCH-UP path for a missed webhook or a dropped WebSocket connection, not a live stream. Retained 30 days. Filter to dips only, recoveries only, or a single alert by naming its numeric id. PRO+.",
  similes: [
    "robinhood chain price alert events",
    "rhc price alert fire history",
    "which rhc price alerts fired",
    "missed rhc price alert webhooks",
  ],

  validate: async (_runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
    const text = (message.content?.text || "").toLowerCase();
    return (
      /\b(rhc|robinhood)\b/.test(text) &&
      /\bprice alerts?\b/.test(text) &&
      /\b(events?|fired|fire history|dip|dips|recovery|recoveries|missed)\b/.test(text)
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
    const alertId = Number(text.match(ALERT_ID_RE)?.[1]);
    const wantsDip = /\bdips?\b/i.test(text);
    const wantsRecovery = /\brecover(y|ies|ed)\b/i.test(text);

    const result = await client.getPriceAlertEvents({
      limit: 50,
      ...(Number.isInteger(alertId) && alertId > 0 ? { alert_id: alertId } : {}),
      ...(wantsDip && !wantsRecovery ? { event_type: "dip" as const } : {}),
      ...(wantsRecovery && !wantsDip ? { event_type: "recovery" as const } : {}),
    });

    if (result.error) {
      callback?.({ text: result.status === 401 ? AUTH_HINT : `Error: ${result.error}` });
      return undefined;
    }

    const data = result.data!;
    const lines = (data.events || [])
      .slice(0, 15)
      .map(
        (e) =>
          `${e.event_type.toUpperCase()} on ${e.token_address.slice(0, 10)}… — baseline $${e.baseline_mc_usd} MC, now $${e.current_mc_usd}${e.drop_pct_actual != null ? `, -${e.drop_pct_actual}%` : ""}${e.recovery_pct_actual != null ? `, +${e.recovery_pct_actual}% off the low` : ""} (alert #${e.alert_id}, ${e.delivered ? "delivered" : "NOT delivered"})`,
      );

    callback?.({
      text: `Robinhood Chain price alert events (${data.count}):\n${lines.join("\n") || "None in the retained 30-day window."}`,
      content: toContent(data),
    });
    return undefined;
  },

  examples: [
    [
      { name: "user1", content: { text: "Which of my Robinhood Chain price alerts fired this week?" } },
      { name: "assistant", content: { text: "Here are your recent RHC price alert events..." } },
    ],
  ] as Action["examples"],
};
