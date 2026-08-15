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

export const rhcWalletPositionsAction: Action = {
  name: "GET_RHC_WALLET_POSITIONS",
  description:
    "What a Robinhood Chain wallet is holding right now — open FIFO positions marked to the current price, with cost basis, unrealized PnL and liquidity context. PRO+.",
  similes: [
    "robinhood chain wallet positions",
    "rhc holdings",
    "what is this rhc wallet holding",
    "rhc open positions",
    "robinhood chain bags",
  ],

  validate: async (_runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
    const text = (message.content?.text || "").toLowerCase();
    return /\b(rhc|robinhood)\b/.test(text) && /\b(positions?|holdings?|holding|bags?)\b/.test(text) && !!extractAddress(text);
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
      callback?.({ text: "I need a wallet address (0x + 40 hex) to list Robinhood Chain positions for." });
      return undefined;
    }

    const result = await getClient(runtime).getWalletPositions(address);
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

    const rows = (d.positions || [])
      .slice(0, 12)
      .map((p) => {
        const label = p.token_symbol || p.token_address.slice(0, 10);
        const unreal = p.unrealized_eth != null
          ? `${p.unrealized_eth >= 0 ? "+" : ""}${p.unrealized_eth.toFixed(3)} ETH${p.unrealized_pct != null ? ` (${p.unrealized_pct >= 0 ? "+" : ""}${p.unrealized_pct.toFixed(0)}%)` : ""}`
          : "unpriced";
        // Flag the virtual-ceiling case inline — it changes how the number should be read.
        const liq = p.liquidity_basis === "v4_virtual_ceiling" ? " [liq = curve ceiling, not TVL]" : "";
        return `  ${label}: cost ${eth(p.cost_basis_eth)} → ${unreal}${liq}`;
      });

    const lines = [
      `Robinhood Chain open positions for ${address.slice(0, 10)}… (${s.open_positions})`,
      `Cost basis ${eth(s.total_cost_basis_eth)} · value ${eth(s.total_current_value_eth)} · unrealized ${eth(s.total_unrealized_eth)}`,
    ];
    if (rows.length) lines.push(...rows);
    if (s.unpriced_positions > 0) {
      lines.push(`Note: ${s.unpriced_positions} position(s) have no current price and are excluded from the value and unrealized totals.`);
    }

    callback?.({ text: lines.join("\n"), content: toContent(d) });
    return undefined;
  },

  examples: [
    [
      { name: "user1", content: { text: "What is 0x1234567890abcdef1234567890abcdef12345678 holding on Robinhood Chain?" } },
      { name: "assistant", content: { text: "Here are the RHC open positions..." } },
    ],
  ] as Action["examples"],
};
