import type { Action, IAgentRuntime, Memory, State, HandlerCallback } from "@elizaos/core";
import { RobinhoodChainClient } from "../client.js";
import { RHC_CLIENT_KEY } from "../index.js";
import { toContent } from "../content.js";

function getClient(runtime: IAgentRuntime): RobinhoodChainClient {
  return ((runtime as unknown as Record<string, unknown>)[RHC_CLIENT_KEY] as RobinhoodChainClient) ?? new RobinhoodChainClient();
}

const AUTH_HINT = "Authentication required. Set ROBINHOOD_CHAIN_API_KEY (or MADEONSOL_API_KEY) — get a free `msk_` key at https://madeonsol.com/pricing.";
const EVM_ALL_RE = /0x[0-9a-fA-F]{40}/g;
const MAX_ADDRESSES = 50;

export const rhcTokenBatchAction: Action = {
  name: "GET_RHC_TOKEN_BATCH",
  description:
    "Look up up to 50 Robinhood Chain tokens in ONE request — symbol/name/decimals, launchpad, graduation status, live price, market cap, FDV, liquidity, peak MC + peak time, primary DEX, last trade time, and the deployer's reputation block. Set-based server-side (three queries total regardless of batch size), not a fan-out. Every REQUESTED address is echoed back, unknown ones as found:false, so the array stays positional. Counts as one request against your rate limit. Deliberately excludes buyer-quality — that is a separate batch endpoint. BASIC+.",
  similes: [
    "robinhood chain token batch",
    "look up several rhc tokens at once",
    "rhc bulk token lookup",
    "batch price these robinhood chain tokens",
  ],

  validate: async (_runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
    const text = message.content?.text || "";
    const matches = text.match(EVM_ALL_RE) || [];
    return matches.length >= 2 && !/\b(buyer quality|buyer score|early buyer)\b/i.test(text);
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    _state?: State,
    _options?: unknown,
    callback?: HandlerCallback,
  ) => {
    const client = getClient(runtime);
    const addresses = [...new Set(message.content?.text?.match(EVM_ALL_RE) ?? [])].slice(0, MAX_ADDRESSES);
    if (addresses.length === 0) {
      callback?.({ text: `Please include 1-${MAX_ADDRESSES} Robinhood Chain token addresses (0x, 40 hex).` });
      return undefined;
    }

    const result = await client.getTokenBatch(addresses);

    if (result.error) {
      callback?.({ text: result.status === 401 ? AUTH_HINT : `Error: ${result.error}` });
      return undefined;
    }

    const data = result.data!;
    const fmtUsd = (v?: number | null) => (v == null ? "?" : v >= 1e6 ? `$${(v / 1e6).toFixed(2)}M` : v >= 1e3 ? `$${(v / 1e3).toFixed(1)}K` : `$${v.toFixed(0)}`);
    const lines = (data.tokens || []).map((t) =>
      t.found
        ? `${t.symbol || t.address.slice(0, 10)} — MC ${fmtUsd(t.market_cap_usd)}, peak ${fmtUsd(t.peak_mc_usd)}, liq ${fmtUsd(t.liquidity_usd)}`
        : `${t.address.slice(0, 10)}… — not indexed on Robinhood Chain`,
    );

    callback?.({
      text: `Robinhood Chain token batch (${data.found}/${data.requested} found):\n${lines.join("\n")}`,
      content: toContent(data),
    });
    return undefined;
  },

  examples: [
    [
      { name: "user1", content: { text: "Price these Robinhood Chain tokens: 0x1234567890abcdef1234567890abcdef12345678 and 0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" } },
      { name: "assistant", content: { text: "Here's the RHC token batch..." } },
    ],
  ] as Action["examples"],
};
