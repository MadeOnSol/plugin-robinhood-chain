import type { Action, IAgentRuntime, Memory, State, HandlerCallback } from "@elizaos/core";
import { RobinhoodChainClient } from "../client.js";
import { RHC_CLIENT_KEY } from "../index.js";
import { toContent } from "../content.js";

function getClient(runtime: IAgentRuntime): RobinhoodChainClient {
  return ((runtime as unknown as Record<string, unknown>)[RHC_CLIENT_KEY] as RobinhoodChainClient) ?? new RobinhoodChainClient();
}

const AUTH_HINT = "Authentication required. Set ROBINHOOD_CHAIN_API_KEY (or MADEONSOL_API_KEY) — get a free `msk_` key at https://madeonsol.com/pricing.";
const TIER_HINT = "This endpoint requires the PRO tier or higher. See https://madeonsol.com/pricing.";

function extractAddress(text: string): string | undefined {
  return text.match(/0x[a-fA-F0-9]{40}/)?.[0]?.toLowerCase();
}

const eth = (n: number | null | undefined, dp = 3) => (n == null ? "?" : `${Number(n).toFixed(dp)} ETH`);

export const rhcWalletPnlAction: Action = {
  name: "GET_RHC_WALLET_PNL",
  description:
    "Full FIFO cost-basis PnL for one Robinhood Chain wallet over 90 days — realized vs unrealized, a daily curve, every closed position with ROI and hold time, and open positions marked to market. Amounts are ETH. Same FIFO implementation as the Solana PnL endpoint, so the two chains compare directly. PRO+.",
  similes: [
    "robinhood chain wallet pnl",
    "rhc wallet profit and loss",
    "how much has this rhc wallet made",
    "rhc pnl breakdown",
    "robinhood chain wallet performance",
  ],

  validate: async (_runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
    const text = (message.content?.text || "").toLowerCase();
    return /\b(rhc|robinhood)\b/.test(text) && /\b(pnl|p&l|profit|loss|performance|made|lost)\b/.test(text) && !!extractAddress(text);
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
      callback?.({ text: "I need a wallet address (0x + 40 hex) to compute Robinhood Chain PnL for." });
      return undefined;
    }

    const result = await getClient(runtime).getWalletPnl(address);
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
    const s = d.summary;

    const top = [...(d.closed_positions || [])]
      .sort((a, b) => b.pnl_eth - a.pnl_eth)
      .slice(0, 5)
      .map((p) => `  ${p.token_symbol || p.token_address.slice(0, 10)}: ${eth(p.pnl_eth)}${p.roi_pct != null ? ` (${p.roi_pct > 0 ? "+" : ""}${p.roi_pct.toFixed(0)}%)` : ""}`);

    const lines = [
      `Robinhood Chain PnL for ${address.slice(0, 10)}… over ${d.window_days}d`,
      `Total ${eth(s.total_pnl_eth)} — realized ${eth(s.realized_eth)}, unrealized ${eth(s.unrealized_eth)}`,
      `${s.wins}W / ${s.losses}L across ${s.total_tokens_traded} tokens · ${s.closed_positions_count} closed, ${s.open_positions_count} open`,
      `Max drawdown ${eth(s.max_drawdown_eth)}${s.median_hold_minutes != null ? ` · median hold ${s.median_hold_minutes}m` : ""}`,
    ];
    if (top.length) lines.push("Best closed positions:", ...top);
    // The FIFO window is the single most misread thing on this endpoint.
    lines.push(`Cost basis observable from ${d.notes.cost_basis_observable_from} — buys before that date are invisible, so an old position can read as a sell with no matching buy.`);
    if (d.notes.partial) lines.push(`Note: partial data — ${d.notes.partial_reason}`);

    callback?.({ text: lines.join("\n"), content: toContent(d) });
    return undefined;
  },

  examples: [
    [
      { name: "user1", content: { text: "What's the PnL for 0x1234567890abcdef1234567890abcdef12345678 on Robinhood Chain?" } },
      { name: "assistant", content: { text: "Here is the RHC wallet PnL breakdown..." } },
    ],
  ] as Action["examples"],
};
