import type { Action, IAgentRuntime, Memory, State, HandlerCallback } from "@elizaos/core";
import { RobinhoodChainClient } from "../client.js";
import { RHC_CLIENT_KEY } from "../index.js";
import { toContent } from "../content.js";

function getClient(runtime: IAgentRuntime): RobinhoodChainClient {
  return ((runtime as unknown as Record<string, unknown>)[RHC_CLIENT_KEY] as RobinhoodChainClient) ?? new RobinhoodChainClient();
}

const AUTH_HINT = "Authentication required. Set ROBINHOOD_CHAIN_API_KEY (or MADEONSOL_API_KEY) — get a free `msk_` key at https://madeonsol.com/developer.";
const EVM_RE = /\b(0x[0-9a-fA-F]{40})\b/;

export const rhcKolConsensusAction: Action = {
  name: "GET_RHC_KOL_CONSENSUS",
  description:
    "Get how the tracked-KOL cohort is positioned on a Robinhood Chain token: distinct KOL buyers vs sellers, exit rate (bought AND sold), net_flow_eth, median entry MC, and first-touch wallet/time. ULTRA additionally returns the buyers and exited wallet lists. PRO+.",
  similes: [
    "robinhood chain kol consensus",
    "rhc kol positioning",
    "are kols accumulating on robinhood chain",
    "kol net flow eth",
  ],

  validate: async (_runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
    const text = message.content?.text || "";
    return /\b(consensus|kol)\b/i.test(text) && EVM_RE.test(text);
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    _options?: unknown,
    callback?: HandlerCallback,
  ) => {
    const client = getClient(runtime);
    const address = (message.content?.text || "").match(EVM_RE)?.[1];
    if (!address) {
      callback?.({ text: "Please include a token address (0x, 40 hex)." });
      return undefined;
    }

    const result = await client.getTokenKolConsensus(address);

    if (result.error) {
      callback?.({ text: result.status === 401 ? AUTH_HINT : result.status === 403 ? "This endpoint requires the PRO tier or higher. See https://madeonsol.com/pricing." : `Error: ${result.error}` });
      return undefined;
    }

    const data = result.data!;
    const c = data.consensus;
    if (!c) {
      callback?.({ text: `No tracked KOL has traded ${address.slice(0, 10)}… on Robinhood Chain.`, content: toContent(data) });
      return undefined;
    }
    const summary = [
      `Robinhood Chain KOL consensus for ${address.slice(0, 10)}…`,
      `• ${c.total_kol_buyers} buyers / ${c.total_kol_sellers} sellers, exit rate ${(c.kol_exit_rate * 100).toFixed(0)}%`,
      `• Net flow ${Number(c.net_flow_eth).toFixed(3)} ETH (buy ${Number(c.total_buy_eth).toFixed(3)} / sell ${Number(c.total_sell_eth).toFixed(3)})`,
      c.median_entry_mc_usd != null ? `• Median entry MC $${Number(c.median_entry_mc_usd).toFixed(0)} (${c.entry_mc_samples} samples)` : "",
    ].filter(Boolean).join("\n");

    callback?.({ text: summary, content: toContent(data) });
    return undefined;
  },

  examples: [
    [
      { name: "user1", content: { text: "What's the KOL consensus on Robinhood Chain token 0x1234567890abcdef1234567890abcdef12345678?" } },
      { name: "assistant", content: { text: "Here's the RHC KOL consensus..." } },
    ],
  ] as Action["examples"],
};
