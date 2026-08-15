import type { Action, IAgentRuntime, Memory, State, HandlerCallback } from "@elizaos/core";
import { RobinhoodChainClient } from "../client.js";
import { RHC_CLIENT_KEY } from "../index.js";
import { toContent } from "../content.js";

function getClient(runtime: IAgentRuntime): RobinhoodChainClient {
  return ((runtime as unknown as Record<string, unknown>)[RHC_CLIENT_KEY] as RobinhoodChainClient) ?? new RobinhoodChainClient();
}

const AUTH_HINT = "Authentication required. Set ROBINHOOD_CHAIN_API_KEY (or MADEONSOL_API_KEY) — get a free `msk_` key at https://madeonsol.com/pricing.";
const TIER_HINT = "This endpoint requires the PRO tier or higher. See https://madeonsol.com/pricing.";

/** First 0x-prefixed 40-hex address in the message, lowercased. */
function extractAddress(text: string): string | undefined {
  return text.match(/0x[a-fA-F0-9]{40}/)?.[0]?.toLowerCase();
}

const eth = (n: number | null | undefined, dp = 3) => (n == null ? "?" : `${Number(n).toFixed(dp)} ETH`);
const pct = (n: number | null | undefined) => (n == null ? "?" : `${(n * 100).toFixed(0)}%`);

export const rhcWalletAction: Action = {
  name: "GET_RHC_WALLET",
  description:
    "Get any Robinhood Chain wallet's 90-day trading profile — ETH-denominated FIFO cost-basis PnL, per-token breakdown, and a reputation block (tracked KOL, known deployer + tier, alpha-ranked, dump-cluster member, early-buyer count). PRO+.",
  similes: [
    "robinhood chain wallet profile",
    "rhc wallet",
    "look up wallet on robinhood chain",
    "who is this rhc wallet",
    "rhc wallet stats",
  ],

  validate: async (_runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
    const text = (message.content?.text || "").toLowerCase();
    return /\b(rhc|robinhood)\b/.test(text) && /\bwallet\b/.test(text) && !!extractAddress(text)
      && !/\b(pnl|p&l|profit|positions?|holdings?|trades?|tape|watchlist|track)\b/.test(text);
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    _options?: unknown,
    callback?: HandlerCallback,
  ) => {
    const address = extractAddress(message.content?.text || "");
    if (!address) {
      callback?.({ text: "I need a wallet address (0x + 40 hex) to look up on Robinhood Chain." });
      return undefined;
    }

    const result = await getClient(runtime).getWallet(address);
    if (result.error) {
      callback?.({
        text: result.status === 401 ? AUTH_HINT
          : result.status === 403 ? TIER_HINT
          : result.status === 404 ? `No Robinhood Chain trades found for ${address} in the 90-day window.`
          : `Error: ${result.error}`,
      });
      return undefined;
    }

    const d = result.data!;
    const s = d.stats;
    const f = d.flags;

    const tags: string[] = [];
    if (f.is_kol) tags.push(`KOL${f.kol_name ? ` (${f.kol_name})` : ""}`);
    if (f.is_deployer) tags.push(`deployer${f.deployer_tier ? ` [${f.deployer_tier}]` : ""}`);
    if (f.is_alpha_tracked) tags.push("alpha-ranked");
    if (f.likely_bot) tags.push("likely bot");
    if (f.is_dumper) tags.push("dump cluster");

    const lines = [
      `Robinhood Chain wallet ${address.slice(0, 10)}…${tags.length ? ` — ${tags.join(", ")}` : ""}`,
      `Total PnL ${eth(s.total_pnl_eth)} (realized ${eth(s.realized_pnl_eth)}, unrealized ${eth(s.unrealized_pnl_eth)})`,
      `${s.total_trades} trades over ${s.window_days}d · ${s.unique_tokens} tokens · ${s.open_positions} open · win rate ${pct(d.derived.win_rate)}`,
    ];
    // Disclose the attribution gap rather than letting a low count read as inactivity.
    if (s.unattributed_trades > 0) {
      lines.push(`Note: ${s.unattributed_trades} of ${s.total_trades} trades predate wallet attribution and are excluded from PnL.`);
    }
    if (s.partial) lines.push("Note: hit the per-wallet trade cap — figures cover part of the window only.");
    if (d.stats_unavailable) lines.push("Note: the PnL snapshot timed out; only the reputation flags are reliable here.");

    callback?.({ text: lines.join("\n"), content: toContent(d) });
    return undefined;
  },

  examples: [
    [
      { name: "user1", content: { text: "Look up this wallet on Robinhood Chain: 0x1234567890abcdef1234567890abcdef12345678" } },
      { name: "assistant", content: { text: "Here is the RHC wallet profile..." } },
    ],
  ] as Action["examples"],
};
