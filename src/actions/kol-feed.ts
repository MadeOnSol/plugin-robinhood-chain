import type { Action, IAgentRuntime, Memory, State, HandlerCallback } from "@elizaos/core";
import { RobinhoodChainClient } from "../client.js";
import { RHC_CLIENT_KEY } from "../index.js";
import { toContent } from "../content.js";

function getClient(runtime: IAgentRuntime): RobinhoodChainClient {
  return ((runtime as unknown as Record<string, unknown>)[RHC_CLIENT_KEY] as RobinhoodChainClient) ?? new RobinhoodChainClient();
}

const AUTH_HINT = "Authentication required. Set ROBINHOOD_CHAIN_API_KEY (or MADEONSOL_API_KEY) — get a free `msk_` key at https://madeonsol.com/pricing.";

export const rhcKolFeedAction: Action = {
  name: "GET_RHC_KOL_FEED",
  description:
    "Get the real-time KOL trade feed on Robinhood Chain (chain id 4663). Every buy/sell from tracked KOLs' verified EVM wallets — enriched with launchpad, deployer tier, current MC, and mc_multiple_since_trade. EVM-native (token_address, eth_amount, tx_hash). BASIC+.",
  similes: [
    "robinhood chain kol trades",
    "rhc kol feed",
    "what are kols buying on robinhood chain",
    "robinhood kol activity",
    "rhc smart money trades",
  ],

  validate: async (_runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
    const text = (message.content?.text || "").toLowerCase();
    return /\b(rhc|robinhood)\b/.test(text) && /\b(kol|smart money|feed|trade|buy|sell|activit)/.test(text);
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
    const action = text.includes("buy") ? "buy" : text.includes("sell") ? "sell" : undefined;

    const result = await client.getKolFeed({ limit: 10, ...(action ? { action: action as "buy" | "sell" } : {}) });

    if (result.error) {
      callback?.({ text: result.status === 401 ? AUTH_HINT : `Error: ${result.error}` });
      return undefined;
    }

    const data = result.data!;
    const fmtEth = (v?: number | null) => (v == null ? "?" : Number(v).toFixed(4));
    const lines = (data.trades || []).slice(0, 10).map(
      (t) => `${t.kol_name || "Unknown"} ${t.action === "buy" ? "bought" : "sold"} ${t.token_symbol || t.token_address.slice(0, 10)} for ${fmtEth(t.eth_amount)} ETH${t.launchpad ? ` (${t.launchpad})` : ""}`,
    );

    callback?.({ text: `Latest Robinhood Chain KOL trades:\n${lines.join("\n")}`, content: toContent(data) });
    return undefined;
  },

  examples: [
    [
      { name: "user1", content: { text: "What are KOLs buying on Robinhood Chain right now?" } },
      { name: "assistant", content: { text: "Here are the latest Robinhood Chain KOL trades..." } },
    ],
  ] as Action["examples"],
};
