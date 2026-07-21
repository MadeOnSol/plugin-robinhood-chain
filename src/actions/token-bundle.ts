import type { Action, IAgentRuntime, Memory, State, HandlerCallback } from "@elizaos/core";
import { RobinhoodChainClient } from "../client.js";
import { RHC_CLIENT_KEY } from "../index.js";
import { toContent } from "../content.js";

function getClient(runtime: IAgentRuntime): RobinhoodChainClient {
  return ((runtime as unknown as Record<string, unknown>)[RHC_CLIENT_KEY] as RobinhoodChainClient) ?? new RobinhoodChainClient();
}

const AUTH_HINT = "Authentication required. Set ROBINHOOD_CHAIN_API_KEY (or MADEONSOL_API_KEY) — get a free `msk_` key at https://madeonsol.com/developer.";
const EVM_RE = /\b(0x[0-9a-fA-F]{40})\b/;

export const rhcTokenBundleAction: Action = {
  name: "GET_RHC_TOKEN_BUNDLE",
  description:
    "Detect a coordinated launch bundle in a Robinhood Chain token's earliest-buyer cohort and measure how much it still holds. Robinhood Chain is an Arbitrum Orbit L2 with no atomic multi-signer tx, so bundle_kind is `same_block` (3+ first buys in one block) or `none`. Returns held_ratio, held_pct_of_supply, fully_exited. BASIC=scalar signal; PRO=top-10 wallets; ULTRA=full cohort + identity.",
  similes: [
    "robinhood chain bundle",
    "rhc launch bundle",
    "same block buyers on robinhood chain",
    "rhc bundle held percent",
    "insider cohort robinhood chain",
  ],

  validate: async (_runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
    const text = message.content?.text || "";
    return /\b(bundle|bundler|bundled|same.?block|insider)\b/i.test(text) && EVM_RE.test(text);
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

    const result = await client.getTokenBundle(address);

    if (result.error) {
      callback?.({ text: result.status === 401 ? AUTH_HINT : `Error: ${result.error}` });
      return undefined;
    }

    const data = result.data!;
    const b = data.bundle;
    if (b.bundle_kind === "none" || b.wallet_count === 0) {
      callback?.({ text: `No same-block launch bundle detected for ${address.slice(0, 10)}… on Robinhood Chain.`, content: toContent(data) });
      return undefined;
    }
    const pct = b.held_pct_of_supply != null ? `${(b.held_pct_of_supply * 100).toFixed(2)}% of supply` : b.held_ratio != null ? `${(b.held_ratio * 100).toFixed(1)}% of what they bought` : "n/a";
    const summary = `Robinhood Chain bundle for ${address.slice(0, 10)}… (${b.bundle_kind}): ${b.wallet_count} wallets still hold ${pct}${b.fully_exited ? " — fully exited" : ""}.`;

    callback?.({ text: summary, content: toContent(data) });
    return undefined;
  },

  examples: [
    [
      { name: "user1", content: { text: "Is there a launch bundle on Robinhood Chain token 0x1234567890abcdef1234567890abcdef12345678?" } },
      { name: "assistant", content: { text: "Here's the RHC bundle detection..." } },
    ],
  ] as Action["examples"],
};
