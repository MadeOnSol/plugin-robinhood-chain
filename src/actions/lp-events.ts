import type { Action, IAgentRuntime, Memory, State, HandlerCallback } from "@elizaos/core";
import { RobinhoodChainClient } from "../client.js";
import { RHC_CLIENT_KEY } from "../index.js";
import { toContent } from "../content.js";

function getClient(runtime: IAgentRuntime): RobinhoodChainClient {
  return ((runtime as unknown as Record<string, unknown>)[RHC_CLIENT_KEY] as RobinhoodChainClient) ?? new RobinhoodChainClient();
}

const AUTH_HINT = "Authentication required. Set ROBINHOOD_CHAIN_API_KEY (or MADEONSOL_API_KEY) — get a free `msk_` key at https://madeonsol.com/pricing.";
const EVM_RE = /\b(0x[0-9a-fA-F]{40})\b/;

export const rhcLpEventsAction: Action = {
  name: "GET_RHC_LP_EVENTS",
  description:
    "Get the Robinhood Chain liquidity REMOVALS feed — the rug signal. Every Uniswap v2/v3 Burn and v4 ModifyLiquidity with a negative delta on tracked pools, decoded from our own node. Removals ONLY: liquidity adds are not persisted, so an empty page means 'no removals seen', never 'no liquidity activity'. Amounts are raw uint256 strings; v4 rows carry liquidity only. provider_is_token_deployer=true is the classic rug shape. Filter by token / pool / provider / dex, cursor via next_before. Data since 2026-08-05. PRO+.",
  similes: [
    "robinhood chain liquidity removals",
    "rhc lp events",
    "rhc rug pulls",
    "liquidity pulled on robinhood chain",
    "who removed liquidity on rhc",
    "robinhood chain lp burns",
  ],

  validate: async (_runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
    const text = (message.content?.text || "").toLowerCase();
    return /\b(rhc|robinhood)\b/.test(text) && /\b(liquidity (remov|pull|burn)|lp (event|remov|burn|pull)|rug(s|ged| pull)?|removed liquidity|pulled liquidity)\b/.test(text);
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
    const lower = text.toLowerCase();
    const address = text.match(EVM_RE)?.[1];
    // "provider 0x…" / "wallet 0x…" / "by 0x…" pins the address to the provider filter; otherwise it is the token.
    const isProvider = !!address && new RegExp(`\\b(provider|wallet|by|lp)\\s+${address}`, "i").test(text);
    const dex = /\bv4\b|uniswap-v4/.test(lower) ? "uniswap-v4" : /\bv3\b|uniswap-v3/.test(lower) ? "uniswap-v3" : /\bv2\b|uniswap-v2/.test(lower) ? "uniswap-v2" : undefined;

    const result = await client.getLpEvents({
      limit: 15,
      ...(address ? (isProvider ? { provider: address } : { token: address }) : {}),
      ...(dex ? { dex: dex as "uniswap-v2" | "uniswap-v3" | "uniswap-v4" } : {}),
    });

    if (result.error) {
      callback?.({ text: result.status === 401 ? AUTH_HINT : result.status === 403 ? "This endpoint requires the PRO tier or higher. See https://madeonsol.com/pricing." : `Error: ${result.error}` });
      return undefined;
    }

    const data = result.data!;
    const lines = (data.events || []).slice(0, 12).map((e) => {
      const who = e.provider ? `${e.provider.slice(0, 10)}…` : "?";
      const flags = [
        e.provider_is_token_deployer ? "DEPLOYER" : null,
        e.provider_kol_name ? `KOL ${e.provider_kol_name}` : null,
        e.provider_deployer_tier ? e.provider_deployer_tier : null,
      ]
        .filter(Boolean)
        .join(", ");
      const amt = e.token_amount_raw != null ? `${e.token_amount_raw} raw token units` : e.liquidity != null ? `${e.liquidity} raw liquidity` : "?";
      return `${e.block_time} ${e.token_symbol || e.token_address.slice(0, 10)} — ${who} removed ${amt} on ${e.dex}${flags ? ` [${flags}]` : ""}`;
    });

    callback?.({
      text: `Robinhood Chain liquidity REMOVALS (${data.count} rows${data.has_more ? ", more available" : ""}; removals only — adds are not persisted):\n${lines.join("\n")}`,
      content: toContent(data),
    });
    return undefined;
  },

  examples: [
    [
      { name: "user1", content: { text: "Show recent liquidity removals on Robinhood Chain for 0x1234567890abcdef1234567890abcdef12345678" } },
      { name: "assistant", content: { text: "Here are the RHC liquidity removals for that token..." } },
    ],
    [
      { name: "user1", content: { text: "Any rug pulls on Robinhood Chain right now?" } },
      { name: "assistant", content: { text: "Latest RHC liquidity removals — provider_is_token_deployer flags the classic rug shape..." } },
    ],
  ] as Action["examples"],
};
