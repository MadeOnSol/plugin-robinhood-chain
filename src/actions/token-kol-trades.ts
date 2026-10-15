import type { Action, IAgentRuntime, Memory, State, HandlerCallback } from "@elizaos/core";
import { RobinhoodChainClient } from "../client.js";
import { RHC_CLIENT_KEY } from "../index.js";
import { toContent } from "../content.js";

function getClient(runtime: IAgentRuntime): RobinhoodChainClient {
  return ((runtime as unknown as Record<string, unknown>)[RHC_CLIENT_KEY] as RobinhoodChainClient) ?? new RobinhoodChainClient();
}

const AUTH_HINT = "Authentication required. Set ROBINHOOD_CHAIN_API_KEY (or MADEONSOL_API_KEY) — get a free `msk_` key at https://madeonsol.com/pricing.";
const EVM_RE = /\b(0x[0-9a-fA-F]{40})\b/;

type KolTrade = {
  kol_name: string | null;
  evm_address: string;
  action: "buy" | "sell";
  eth_amount: number | null;
  market_cap_usd_at_trade: number | null;
  traded_at: string;
};

export const rhcTokenKolTradesAction: Action = {
  name: "GET_RHC_TOKEN_KOL_TRADES",
  description:
    "List every stored KOL trade on one Robinhood Chain token, newest first: KOL name, EVM address, side, ETH and token amounts, price and market cap at the trade, DEX, tx hash, block, time. Keyset paged with next_cursor. BASIC gets a 5-minute delay and 20 rows. include_balances (PRO+) adds each KOL address's current balanceOf from our node; a failed read is unverified, never 0.",
  similes: [
    "rhc kol trades on token",
    "which kols traded this robinhood chain token",
    "robinhood chain kol buys and sells on token",
  ],

  validate: async (_runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
    const text = message.content?.text || "";
    return /\bkols?\b/i.test(text) && /\b(trades?|traded|trading|buys?|sells?|sold|bought)\b/i.test(text) && EVM_RE.test(text);
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
    const sells = /\bsells?\b|\bsold\b/i.test(text);
    const buys = /\bbuys?\b|\bbought\b/i.test(text);
    const action = sells && !buys ? "sell" : buys && !sells ? "buy" : undefined;

    const result = await client.getTokenKolTrades(address, { limit: 20, action });
    if (result.error) {
      callback?.({ text: result.status === 401 ? AUTH_HINT : `Error: ${result.error}` });
      return undefined;
    }

    const data = result.data as { trades?: KolTrade[]; has_more?: boolean } | undefined;
    const trades = data?.trades ?? [];
    if (trades.length === 0) {
      callback?.({ text: `No stored KOL trades on ${address.slice(0, 10)}… on Robinhood Chain.`, content: toContent(data) });
      return undefined;
    }
    const lines = trades.slice(0, 20).map((t) => {
      const who = t.kol_name ?? `${t.evm_address.slice(0, 10)}…`;
      const eth = t.eth_amount != null ? ` ${t.eth_amount.toFixed(4)} ETH` : "";
      const mc = t.market_cap_usd_at_trade != null ? ` @ $${Math.round(t.market_cap_usd_at_trade).toLocaleString()} MC` : "";
      return `• ${t.traded_at} ${who} ${t.action}${eth}${mc}`;
    });
    callback?.({
      text: `KOL trades on Robinhood Chain token ${address.slice(0, 10)}…\n${lines.join("\n")}${data?.has_more ? "\n(more available via next_cursor)" : ""}`,
      content: toContent(data),
    });
    return undefined;
  },

  examples: [
    [
      { name: "user1", content: { text: "Show the KOL trades on Robinhood Chain token 0x1234567890abcdef1234567890abcdef12345678" } },
      { name: "assistant", content: { text: "Here are the KOL trades on that token, newest first..." } },
    ],
  ] as Action["examples"],
};
