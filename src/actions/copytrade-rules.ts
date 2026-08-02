import type { Action, IAgentRuntime, Memory, State, HandlerCallback } from "@elizaos/core";
import { RobinhoodChainClient } from "../client.js";
import { RHC_CLIENT_KEY } from "../index.js";
import { toContent } from "../content.js";

function getClient(runtime: IAgentRuntime): RobinhoodChainClient {
  return ((runtime as unknown as Record<string, unknown>)[RHC_CLIENT_KEY] as RobinhoodChainClient) ?? new RobinhoodChainClient();
}

const AUTH_HINT = "Authentication required. Set ROBINHOOD_CHAIN_API_KEY (or MADEONSOL_API_KEY) — get a free `msk_` key at https://madeonsol.com/pricing.";
/** Numeric rule id, optionally written as `#12` or `rule 12`. */
const ID_RE = /(?:rule|id|#)\s*#?\s*(\d{1,12})\b/i;

export const rhcCopytradeRulesAction: Action = {
  name: "MANAGE_RHC_COPYTRADE_RULES",
  description:
    "List, pause, resume or delete your Robinhood Chain copy-trade rules. A rule watches up to 250 source EVM wallets and pushes a signal (webhook and/or WebSocket) when one of them trades — it is DATA, never execution: the delivered `suggested_eth_amount` is a sizing suggestion, no order is ever placed. Amounts are ETH (`min_trade_eth`, `sizing_amount`), and unlike the Solana copy-trade engine there is NO market-cap band on RHC — the producer's event carries no market cap. Rule and wallet quotas are PER CHAIN, so Solana rules do not consume RHC capacity. Says listing by default; deletes or toggles only when the message names an explicit numeric rule id. Creating a rule needs a webhook URL and returns a one-time secret, so use the typed client's createCopytradeSubscription for that. PRO+.",
  similes: [
    "robinhood chain copy trade rules",
    "rhc copytrade subscriptions",
    "list my rhc copy trade rules",
    "pause my robinhood chain copy trade rule",
    "delete rhc copytrade rule",
  ],

  validate: async (_runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
    const text = (message.content?.text || "").toLowerCase();
    return /\b(rhc|robinhood)\b/.test(text) && /\b(copy[- ]?trade|copytrade)\b/.test(text) && !/\bsignals?\b/.test(text);
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
    const wantsPause = /\b(pause|disable|deactivate|stop)\b/i.test(text);
    const wantsResume = /\b(resume|enable|reactivate|re-?activate|activate|restart)\b/i.test(text);

    if ((wantsDelete || wantsPause || wantsResume) && !hasId) {
      callback?.({
        text: "Which rule? Name an explicit numeric rule id (for example \"delete RHC copy-trade rule 12\"). Ask me to list your rules first if you don't know it.",
      });
      return undefined;
    }

    if (hasId && wantsDelete) {
      const del = await client.deleteCopytradeSubscription(id);
      if (del.error) {
        callback?.({ text: del.status === 401 ? AUTH_HINT : `Error: ${del.error}` });
        return undefined;
      }
      callback?.({ text: `Deleted Robinhood Chain copy-trade rule ${id}.`, content: toContent(del.data!) });
      return undefined;
    }

    if (hasId && (wantsPause || wantsResume)) {
      const patched = await client.updateCopytradeSubscription(id, { is_active: !wantsPause });
      if (patched.error) {
        callback?.({ text: patched.status === 401 ? AUTH_HINT : `Error: ${patched.error}` });
        return undefined;
      }
      const s = patched.data!.subscription;
      callback?.({
        text: `Robinhood Chain copy-trade rule ${s.id} is now ${s.is_active ? "active" : "paused"}.`,
        content: toContent(patched.data!),
      });
      return undefined;
    }

    if (hasId) {
      const one = await client.getCopytradeSubscription(id);
      if (one.error) {
        callback?.({ text: one.status === 401 ? AUTH_HINT : `Error: ${one.error}` });
        return undefined;
      }
      const s = one.data!.subscription;
      callback?.({
        text: `RHC copy-trade rule ${s.id} (${s.name || "unnamed"}) — ${s.source_wallets.length} source wallet(s), ${s.only_action} only, min ${s.min_trade_eth} ETH, sizing ${s.sizing_mode} ${s.sizing_amount}, delivery ${s.delivery_mode}, ${s.is_active ? "active" : "paused"}.`,
        content: toContent(one.data!),
      });
      return undefined;
    }

    const result = await client.getCopytradeSubscriptions();
    if (result.error) {
      callback?.({ text: result.status === 401 ? AUTH_HINT : `Error: ${result.error}` });
      return undefined;
    }

    const data = result.data!;
    const lines = (data.subscriptions || []).map(
      (s) =>
        `#${s.id} ${s.name || "unnamed"} — ${s.source_wallets.length} wallet(s), ${s.only_action}, min ${s.min_trade_eth} ETH, sizing ${s.sizing_mode} ${s.sizing_amount}, via ${s.delivery_mode}, ${s.is_active ? "active" : "paused"}`,
    );

    callback?.({
      text: `Robinhood Chain copy-trade rules (${lines.length}):\n${lines.join("\n") || "None yet — create one with the typed client's createCopytradeSubscription()."}`,
      content: toContent(data),
    });
    return undefined;
  },

  examples: [
    [
      { name: "user1", content: { text: "List my Robinhood Chain copy-trade rules." } },
      { name: "assistant", content: { text: "Here are your RHC copy-trade rules..." } },
    ],
    [
      { name: "user1", content: { text: "Pause RHC copy-trade rule 12." } },
      { name: "assistant", content: { text: "Robinhood Chain copy-trade rule 12 is now paused." } },
    ],
  ] as Action["examples"],
};
