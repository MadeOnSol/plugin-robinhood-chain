import type { Action, IAgentRuntime, Memory, State, HandlerCallback } from "@elizaos/core";
import { RobinhoodChainClient } from "../client.js";
import { RHC_CLIENT_KEY } from "../index.js";
import { toContent } from "../content.js";

function getClient(runtime: IAgentRuntime): RobinhoodChainClient {
  return ((runtime as unknown as Record<string, unknown>)[RHC_CLIENT_KEY] as RobinhoodChainClient) ?? new RobinhoodChainClient();
}

const AUTH_HINT = "Authentication required. Set ROBINHOOD_CHAIN_API_KEY (or MADEONSOL_API_KEY) — get a free `msk_` key at https://madeonsol.com/developer.";
const EVM_RE = /\b(0x[0-9a-fA-F]{40})\b/;

export const rhcKolProfileAction: Action = {
  name: "GET_RHC_KOL_PROFILE",
  description:
    "Get a single KOL's profile on Robinhood Chain by their EVM wallet (0x, 40 hex): aggregate stats over their last 200 RHC trades (trades, buys, sells, buy/sell/net ETH, tokens traded) plus their 50 most recent trades. BASIC+.",
  similes: [
    "robinhood chain kol profile",
    "rhc kol stats",
    "single kol on robinhood chain",
    "kol wallet stats rhc",
  ],

  validate: async (_runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
    const text = message.content?.text || "";
    return /\b(kol|wallet|trader)\b/i.test(text) && EVM_RE.test(text);
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    _options?: unknown,
    callback?: HandlerCallback,
  ) => {
    const client = getClient(runtime);
    const wallet = (message.content?.text || "").match(EVM_RE)?.[1];
    if (!wallet) {
      callback?.({ text: "Please include a KOL EVM wallet address (0x, 40 hex)." });
      return undefined;
    }

    const result = await client.getKol(wallet);

    if (result.error) {
      if (result.status === 404) {
        callback?.({ text: `No Robinhood Chain activity found for ${wallet.slice(0, 10)}….` });
        return undefined;
      }
      callback?.({ text: result.status === 401 ? AUTH_HINT : `Error: ${result.error}` });
      return undefined;
    }

    const data = result.data!;
    const s = data.stats;
    const summary = [
      `${data.kol_name || "Unnamed KOL"} on Robinhood Chain (${data.evm_address.slice(0, 10)}…)`,
      `• ${s.trades} trades (${s.buys} buys / ${s.sells} sells) over ${s.window}`,
      `• Net ${Number(s.net_eth).toFixed(3)} ETH across ${s.tokens_traded} tokens`,
    ].join("\n");

    callback?.({ text: summary, content: toContent(data) });
    return undefined;
  },

  examples: [
    [
      { name: "user1", content: { text: "Show the RHC profile for 0x1234567890abcdef1234567890abcdef12345678" } },
      { name: "assistant", content: { text: "Here's the Robinhood Chain KOL profile..." } },
    ],
  ] as Action["examples"],
};
