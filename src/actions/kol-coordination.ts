import type { Action, IAgentRuntime, Memory, State, HandlerCallback } from "@elizaos/core";
import { RobinhoodChainClient } from "../client.js";
import { RHC_CLIENT_KEY } from "../index.js";
import { toContent } from "../content.js";

function getClient(runtime: IAgentRuntime): RobinhoodChainClient {
  return ((runtime as unknown as Record<string, unknown>)[RHC_CLIENT_KEY] as RobinhoodChainClient) ?? new RobinhoodChainClient();
}

const AUTH_HINT = "Authentication required. Set ROBINHOOD_CHAIN_API_KEY (or MADEONSOL_API_KEY) — get a free `msk_` key at https://madeonsol.com/pricing.";

const PERIODS = ["1h", "6h", "24h", "7d"] as const;

export const rhcKolCoordinationAction: Action = {
  name: "GET_RHC_KOL_COORDINATION",
  description:
    "Get KOL coordination / clustering on Robinhood Chain — tokens bought by min_kols+ DISTINCT tracked KOLs inside a 1h/6h/24h/7d window, ranked by KOL count then buy ETH. Per token: buy/sell/net ETH, signal (accumulating when net_eth >= 0, else distributing), exited_count vs holders_count, time_to_consensus_sec from first to last KOL buy, MC at the first KOL buy, current/peak MC, liquidity, deployer tier, token age, and the per-KOL breakdown (evm_address, name, twitter_url, buy_eth, sell_eth, exited). Computed read-time from the RHC KOL tape; RHC has no KOL winrate/strategy scores, so those Solana fields are absent. BASIC+.",
  similes: [
    "robinhood chain kol coordination",
    "rhc multiple kols buying same token",
    "rhc kol clustering",
    "coordinated kol buys on robinhood chain",
  ],

  validate: async (_runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
    const text = (message.content?.text || "").toLowerCase();
    return /\b(rhc|robinhood)\b/.test(text) && /\b(coordinat|cluster|converg|co-?buy|multiple kols|several kols)/.test(text);
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
    const period = PERIODS.find((p) => text.includes(p)) ?? "24h";
    const minKols = Number((text.match(/(\d+)\+?\s*kols?/) || [])[1]) || 2;

    const result = await client.getKolCoordination({ period, min_kols: Math.min(Math.max(minKols, 2), 50), limit: 15 });

    if (result.error) {
      callback?.({ text: result.status === 401 ? AUTH_HINT : `Error: ${result.error}` });
      return undefined;
    }

    const data = result.data!;
    const lines = (data.coordination || []).slice(0, 10).map(
      (c) => `${c.token_symbol || c.token_address.slice(0, 10)} — ${c.kol_count} KOLs, ${c.buy_eth.toFixed(3)} ETH bought, net ${c.net_eth.toFixed(3)} ETH (${c.signal}), ${c.holders_count} holding / ${c.exited_count} exited`,
    );

    callback?.({
      text: `Robinhood Chain KOL coordination (${data.period}, min ${data.min_kols} KOLs):\n${lines.join("\n") || "No coordinated tokens in window."}`,
      content: toContent(data),
    });
    return undefined;
  },

  examples: [
    [
      { name: "user1", content: { text: "Which Robinhood Chain tokens have 3+ KOLs coordinating in the last 6h?" } },
      { name: "assistant", content: { text: "Here are the coordinated RHC tokens..." } },
    ],
  ] as Action["examples"],
};
