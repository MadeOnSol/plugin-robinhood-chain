import type { Action, IAgentRuntime, Memory, State, HandlerCallback } from "@elizaos/core";
import { RobinhoodChainClient } from "../client.js";
import { RHC_CLIENT_KEY } from "../index.js";
import { toContent } from "../content.js";

function getClient(runtime: IAgentRuntime): RobinhoodChainClient {
  return ((runtime as unknown as Record<string, unknown>)[RHC_CLIENT_KEY] as RobinhoodChainClient) ?? new RobinhoodChainClient();
}

const AUTH_HINT = "Authentication required. Set ROBINHOOD_CHAIN_API_KEY (or MADEONSOL_API_KEY) — get a free `msk_` key at https://madeonsol.com/pricing.";
const TIER_HINT = "The Robinhood Chain wallet tracker requires the PRO tier or higher. See https://madeonsol.com/pricing.";

const eth = (n: number | null | undefined, dp = 3) => (n == null ? "?" : `${Number(n).toFixed(dp)} ETH`);

/** Pull a period like `24h`, `7d`, `30d` out of the message. */
function extractPeriod(text: string): string | undefined {
  return text.match(/\b(\d{1,3}\s*(?:h|hr|hours?|d|days?))\b/i)?.[1]?.replace(/\s+/g, "").replace(/hours?|hr/i, "h").replace(/days?/i, "d");
}

export const rhcWalletTrackerFeedAction: Action = {
  name: "GET_RHC_WALLET_TRACKER_FEED",
  description:
    "Merged activity across every wallet on your Robinhood Chain watchlist — either the raw trade feed (each row tagged with its watchlist label) or a per-wallet buy/sell/volume rollup. Sourced from the chain tape directly, so a newly tracked wallet has full history immediately. PRO+.",
  similes: [
    "what are my tracked robinhood chain wallets doing",
    "rhc watchlist activity",
    "robinhood chain tracked wallet trades",
    "rhc watchlist summary",
    "my tracked rhc wallets performance",
  ],

  validate: async (_runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
    const text = (message.content?.text || "").toLowerCase();
    return /\b(rhc|robinhood)\b/.test(text)
      && /\b(tracked|watchlist|watching)\b/.test(text)
      && /\b(trades?|activity|doing|summary|rollup|volume|performance)\b/.test(text);
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

    const fail = (status?: number, error?: string) => {
      callback?.({
        text: status === 401 ? AUTH_HINT : status === 403 ? TIER_HINT : `Error: ${error}`,
      });
    };

    // Summary when the user asks for a rollup; the raw tape otherwise.
    const wantsSummary = /\b(summary|rollup|volume|performance|how (are|have) (they|my))\b/.test(text);

    if (wantsSummary) {
      const period = extractPeriod(text) ?? "7d";
      const res = await client.getWalletTrackerSummary({ period });
      if (res.error) return fail(res.status, res.error), undefined;

      const d = res.data!;
      if (!d.wallets?.length) {
        callback?.({ text: "Your Robinhood Chain watchlist is empty — add a wallet first.", content: toContent(d) });
        return undefined;
      }
      const rows = d.wallets
        .slice(0, 20)
        .map((w) => `  ${w.label || w.wallet_address.slice(0, 12) + "…"}: ${w.stats.trades} trades, net ${eth(w.stats.net_eth)} (${w.stats.tokens_traded} tokens)`);

      const lines = [`Robinhood Chain watchlist summary — last ${d.period}:`, ...rows];
      if (d.stats_unavailable) {
        lines.push("Note: the rollup query timed out, so these stats are zeroed rather than missing — retry shortly.");
      }
      callback?.({ text: lines.join("\n"), content: toContent(d) });
      return undefined;
    }

    const res = await client.getWalletTrackerTrades({ limit: 25 });
    if (res.error) return fail(res.status, res.error), undefined;

    const d = res.data!;
    if (!d.trades?.length) {
      callback?.({ text: "No trades from your tracked Robinhood Chain wallets in the window.", content: toContent(d) });
      return undefined;
    }
    const rows = d.trades.slice(0, 15).map((t) => {
      const who = t.label || t.trader_eoa?.slice(0, 10) + "…" || "?";
      const token = t.token_symbol || t.token_address?.slice(0, 10) || "?";
      return `  ${who} ${(t.action || "?").toUpperCase()} ${token} — ${t.eth_amount != null ? Number(t.eth_amount).toFixed(4) + " ETH" : "?"} · ${t.block_time}`;
    });

    const lines = [`Tracked Robinhood Chain wallet trades (${d.count}):`, ...rows];
    if (d.has_more) lines.push(`More available — page with before=${d.next_before}`);
    callback?.({ text: lines.join("\n"), content: toContent(d) });
    return undefined;
  },

  examples: [
    [
      { name: "user1", content: { text: "What have my tracked Robinhood Chain wallets been trading?" } },
      { name: "assistant", content: { text: "Here is the merged RHC watchlist trade feed..." } },
    ],
    [
      { name: "user1", content: { text: "Give me a 30d summary of my tracked RHC wallets." } },
      { name: "assistant", content: { text: "Here is the 30d watchlist rollup..." } },
    ],
  ] as Action["examples"],
};
