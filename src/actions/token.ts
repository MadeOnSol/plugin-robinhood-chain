import type { Action, IAgentRuntime, Memory, State, HandlerCallback } from "@elizaos/core";
import { RobinhoodChainClient } from "../client.js";
import { RHC_CLIENT_KEY } from "../index.js";
import { toContent } from "../content.js";

function getClient(runtime: IAgentRuntime): RobinhoodChainClient {
  return ((runtime as unknown as Record<string, unknown>)[RHC_CLIENT_KEY] as RobinhoodChainClient) ?? new RobinhoodChainClient();
}

const AUTH_HINT = "Authentication required. Set ROBINHOOD_CHAIN_API_KEY (or MADEONSOL_API_KEY) — get a free `msk_` key at https://madeonsol.com/pricing.";
const EVM_RE = /\b(0x[0-9a-fA-F]{40})\b/;

export const rhcTokenAction: Action = {
  name: "GET_RHC_TOKEN",
  description:
    "Get the full snapshot for one Robinhood Chain token by 0x address: metadata, live price/MC/FDV, peak MC + drawdown, graduation status, deployer reputation block (+ other tokens by the same deployer), KOL activity summary, and pool inventory. BASIC+.",
  similes: [
    "robinhood chain token info",
    "rhc token snapshot",
    "token details on robinhood chain",
    "look up robinhood chain token",
  ],

  validate: async (_runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
    const text = message.content?.text || "";
    return /\b(token|coin|mint|address)\b/i.test(text) && EVM_RE.test(text);
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

    const result = await client.getToken(address);

    if (result.error) {
      if (result.status === 404) {
        callback?.({ text: `Token ${address.slice(0, 10)}… not found on Robinhood Chain.` });
        return undefined;
      }
      callback?.({ text: result.status === 401 ? AUTH_HINT : `Error: ${result.error}` });
      return undefined;
    }

    const data = result.data!;
    const fmtUsd = (v?: number | null) => (v == null ? "?" : v >= 1e6 ? `$${(v / 1e6).toFixed(2)}M` : v >= 1e3 ? `$${(v / 1e3).toFixed(1)}K` : `$${v.toFixed(0)}`);
    const summary = [
      `${data.symbol || "?"} (${data.name || "unknown"}) on Robinhood Chain`,
      `• MC ${fmtUsd(data.market_cap_usd)}, liq ${fmtUsd(data.liquidity_usd)}, peak ${fmtUsd(data.peak_mc_usd)}${data.drawdown_from_peak_pct != null ? ` (−${data.drawdown_from_peak_pct}% from peak)` : ""}`,
      `• Launchpad ${data.launchpad || "?"}${data.deployer?.tier ? `, deployer ${data.deployer.tier}` : ""}`,
      `• KOLs: ${data.kol_activity?.distinct_kols ?? 0} distinct, net ${Number(data.kol_activity?.net_eth ?? 0).toFixed(3)} ETH`,
    ].join("\n");

    callback?.({ text: summary, content: toContent(data) });
    return undefined;
  },

  examples: [
    [
      { name: "user1", content: { text: "Give me the snapshot for Robinhood Chain token 0x1234567890abcdef1234567890abcdef12345678" } },
      { name: "assistant", content: { text: "Here's the RHC token snapshot..." } },
    ],
  ] as Action["examples"],
};
