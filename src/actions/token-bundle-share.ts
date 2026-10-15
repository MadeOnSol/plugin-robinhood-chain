import type { Action, IAgentRuntime, Memory, State, HandlerCallback } from "@elizaos/core";
import { RobinhoodChainClient } from "../client.js";
import { RHC_CLIENT_KEY } from "../index.js";
import { toContent } from "../content.js";

function getClient(runtime: IAgentRuntime): RobinhoodChainClient {
  return ((runtime as unknown as Record<string, unknown>)[RHC_CLIENT_KEY] as RobinhoodChainClient) ?? new RobinhoodChainClient();
}

const AUTH_HINT = "Authentication required. Set ROBINHOOD_CHAIN_API_KEY (or MADEONSOL_API_KEY) — get a free `msk_` key at https://madeonsol.com/pricing.";
const EVM_RE = /\b(0x[0-9a-fA-F]{40})\b/;
const WINDOW_RE = /\b(1h|6h|24h)\b/i;

export const rhcTokenBundleShareAction: Action = {
  name: "GET_RHC_TOKEN_BUNDLE_SHARE",
  description:
    "Get one figure for a Robinhood Chain token: bundled_pct_of_supply_now, the share of supply held right now by every bundle wallet (launch bundle plus the window's buy clusters, each wallet once), balanceOf from our node. Null with a reason (held_now.incomplete_reason) unless every wallet was read. Cached 30 s per token. PRO+.",
  similes: [
    "rhc bundle share",
    "robinhood chain bundled supply now",
    "how much supply do bundles hold now on robinhood chain",
  ],

  validate: async (_runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
    const text = message.content?.text || "";
    return /\b(bundle.?share|bundled.{0,20}(supply|percent|pct|share)|bundle.{0,30}\bnow\b)/i.test(text) && EVM_RE.test(text);
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
    const address = text.match(EVM_RE)?.[1];
    if (!address) {
      callback?.({ text: "Please include a token address (0x, 40 hex)." });
      return undefined;
    }
    const window = text.match(WINDOW_RE)?.[1]?.toLowerCase() as "1h" | "6h" | "24h" | undefined;

    const result = await client.getTokenBundleShare(address, { window });
    if (result.error) {
      callback?.({ text: result.status === 401 ? AUTH_HINT : `Error: ${result.error}` });
      return undefined;
    }

    const data = result.data as {
      window?: string;
      bundled_pct_of_supply_now: number | null;
      scope?: string;
      wallets?: { total?: number; verified?: number; holding?: number };
      held_now?: { incomplete_reason?: string | null };
    };
    const w = data.wallets;
    if (data.bundled_pct_of_supply_now == null) {
      const reason = data.held_now?.incomplete_reason ?? "not every wallet could be read";
      callback?.({ text: `Bundle share for ${address.slice(0, 10)}… is unavailable: ${reason}${w ? ` (${w.verified ?? 0}/${w.total ?? 0} wallets read)` : ""}.`, content: toContent(data) });
      return undefined;
    }
    const pct = (data.bundled_pct_of_supply_now * 100).toFixed(2);
    callback?.({
      text: `Bundle wallets hold ${pct}% of ${address.slice(0, 10)}… supply now on Robinhood Chain (${w?.holding ?? "?"} of ${w?.total ?? "?"} wallets still holding, window ${data.window ?? "24h"}${data.scope === "launch_cohort_only" ? ", launch bundle only" : ""}).`,
      content: toContent(data),
    });
    return undefined;
  },

  examples: [
    [
      { name: "user1", content: { text: "What is the bundle share of supply now on Robinhood Chain token 0x1234567890abcdef1234567890abcdef12345678?" } },
      { name: "assistant", content: { text: "Bundle wallets hold 9.80% of that token's supply now..." } },
    ],
  ] as Action["examples"],
};
