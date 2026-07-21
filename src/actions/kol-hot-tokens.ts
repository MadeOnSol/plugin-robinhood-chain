import type { Action, IAgentRuntime, Memory, State, HandlerCallback } from "@elizaos/core";
import { RobinhoodChainClient } from "../client.js";
import { RHC_CLIENT_KEY } from "../index.js";
import { toContent } from "../content.js";

function getClient(runtime: IAgentRuntime): RobinhoodChainClient {
  return ((runtime as unknown as Record<string, unknown>)[RHC_CLIENT_KEY] as RobinhoodChainClient) ?? new RobinhoodChainClient();
}

const AUTH_HINT = "Authentication required. Set ROBINHOOD_CHAIN_API_KEY (or MADEONSOL_API_KEY) — get a free `msk_` key at https://madeonsol.com/developer.";

const WINDOWS = ["5m", "15m", "1h", "6h", "24h"] as const;

export const rhcKolHotTokensAction: Action = {
  name: "GET_RHC_KOL_HOT_TOKENS",
  description:
    "Get consensus tokens on Robinhood Chain — tokens bought by 2+ distinct tracked KOLs inside a rolling window (5m/15m/1h/6h/24h), ranked by KOL-buyer count then buy volume, enriched with launchpad, deployer tier, graduation and MC. BASIC+.",
  similes: [
    "robinhood chain hot tokens",
    "rhc consensus tokens",
    "what tokens are kols buying on robinhood chain",
    "rhc multi kol tokens",
  ],

  validate: async (_runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
    const text = (message.content?.text || "").toLowerCase();
    return /\b(rhc|robinhood)\b/.test(text) && /\b(hot token|consensus|trending|multiple kol|kols buying)/.test(text);
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
    const window = WINDOWS.find((w) => text.includes(w)) ?? "1h";

    const result = await client.getKolHotTokens({ window });

    if (result.error) {
      callback?.({ text: result.status === 401 ? AUTH_HINT : `Error: ${result.error}` });
      return undefined;
    }

    const data = result.data!;
    const lines = (data.tokens || []).slice(0, 10).map(
      (t) => `${t.token_symbol || t.token_address.slice(0, 10)} — ${t.kols_buying} KOLs buying, ${Number(t.buy_eth).toFixed(3)} ETH${t.launchpad ? ` (${t.launchpad})` : ""}`,
    );

    callback?.({ text: `Robinhood Chain consensus tokens (${data.window}):\n${lines.join("\n") || "None in window."}`, content: toContent(data) });
    return undefined;
  },

  examples: [
    [
      { name: "user1", content: { text: "What tokens are multiple KOLs buying on Robinhood Chain in the last hour?" } },
      { name: "assistant", content: { text: "Here are the RHC consensus tokens..." } },
    ],
  ] as Action["examples"],
};
