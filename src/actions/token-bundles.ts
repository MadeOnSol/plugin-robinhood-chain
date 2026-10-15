import type { Action, IAgentRuntime, Memory, State, HandlerCallback } from "@elizaos/core";
import { RobinhoodChainClient } from "../client.js";
import { RHC_CLIENT_KEY } from "../index.js";
import { toContent } from "../content.js";

function getClient(runtime: IAgentRuntime): RobinhoodChainClient {
  return ((runtime as unknown as Record<string, unknown>)[RHC_CLIENT_KEY] as RobinhoodChainClient) ?? new RobinhoodChainClient();
}

const AUTH_HINT = "Authentication required. Set ROBINHOOD_CHAIN_API_KEY (or MADEONSOL_API_KEY) — get a free `msk_` key at https://madeonsol.com/pricing.";
const EVM_RE = /\b(0x[0-9a-fA-F]{40})\b/;
const WINDOW_RE = /\b(1h|6h|24h)\b/i;

type Cluster = {
  block_number: number;
  at: string;
  phase: "launch" | "later" | "unknown";
  wallet_count: number;
  new_wallets: number;
  same_tx_groups: number;
  eth_volume: number | null;
};

export const rhcTokenBundlesAction: Action = {
  name: "GET_RHC_TOKEN_BUNDLES",
  description:
    "List every coordinated buy cluster on a Robinhood Chain token: blocks in a 1h/6h/24h window where at least min_wallets (default 3) distinct effective trading accounts (ERC-4337 senders resolved) bought, the launch bundle and clusters that enter later. Per cluster: block, time, phase, wallet_count, new_wallets, same_tx_groups, ETH volume. summary.baseline shows buys per active block, so a cluster is evidence, not a verdict. PRO+.",
  similes: [
    "robinhood chain bundle clusters",
    "rhc coordinated buys",
    "rhc later bundles",
    "rhc buy clusters",
  ],

  validate: async (_runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
    const text = message.content?.text || "";
    return /\b(bundles|clusters?|coordinated buy)/i.test(text) && EVM_RE.test(text);
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
    const window = text.match(WINDOW_RE)?.[1]?.toLowerCase() as "1h" | "6h" | "24h" | undefined;

    const result = await client.getTokenBundles(address, { window, limit: 10 });
    if (result.error) {
      callback?.({ text: result.status === 401 ? AUTH_HINT : `Error: ${result.error}` });
      return undefined;
    }

    const data = result.data as { window?: string; clusters?: Cluster[]; summary?: { cluster_count?: number; launch_clusters?: number; later_clusters?: number } } | undefined;
    const clusters = data?.clusters ?? [];
    if (clusters.length === 0) {
      callback?.({ text: `No coordinated buy clusters on ${address.slice(0, 10)}… in the last ${data?.window ?? "24h"} on Robinhood Chain.`, content: toContent(data) });
      return undefined;
    }
    const s = data?.summary;
    const lines = clusters.slice(0, 10).map((c) =>
      `• block ${c.block_number} ${c.at} (${c.phase}): ${c.wallet_count} wallets, ${c.new_wallets} new, ${c.same_tx_groups} same-tx groups${c.eth_volume != null ? `, ${c.eth_volume.toFixed(4)} ETH` : ""}`,
    );
    callback?.({
      text: `Robinhood Chain buy clusters on ${address.slice(0, 10)}… (${data?.window ?? "24h"}): ${s?.cluster_count ?? clusters.length} total, ${s?.launch_clusters ?? 0} at launch, ${s?.later_clusters ?? 0} later\n${lines.join("\n")}`,
      content: toContent(data),
    });
    return undefined;
  },

  examples: [
    [
      { name: "user1", content: { text: "Any coordinated buy clusters on Robinhood Chain token 0x1234567890abcdef1234567890abcdef12345678 in the last 6h?" } },
      { name: "assistant", content: { text: "Here are the buy clusters on that token..." } },
    ],
  ] as Action["examples"],
};
