import type { Action, IAgentRuntime, Memory, State, HandlerCallback } from "@elizaos/core";
import { RobinhoodChainClient } from "../client.js";
import { RHC_CLIENT_KEY } from "../index.js";
import { toContent } from "../content.js";

function getClient(runtime: IAgentRuntime): RobinhoodChainClient {
  return ((runtime as unknown as Record<string, unknown>)[RHC_CLIENT_KEY] as RobinhoodChainClient) ?? new RobinhoodChainClient();
}

const AUTH_HINT = "Authentication required. Set ROBINHOOD_CHAIN_API_KEY (or MADEONSOL_API_KEY) — get a free `msk_` key at https://madeonsol.com/pricing.";
const EVM_RE = /\b(0x[0-9a-fA-F]{40})\b/;

export const rhcDeployerTokensAction: Action = {
  name: "GET_RHC_DEPLOYER_TOKENS",
  description:
    "List every token one Robinhood Chain deployer has launched — the paginated launch history (limit 1-100, offset), enriched with live MC, peak MC + peak time, and liquidity. Distinct from the deployer profile, which caps recent tokens at 50. sort=first_seen_at (default) orders globally in Postgres; sort=peak_mc_usd re-orders the FETCHED PAGE only and echoes sort_scope:\"page\" — it is not a global top-tokens ranking. Unknown wallets return is_deployer:false. BASIC+.",
  similes: [
    "robinhood chain deployer tokens",
    "all tokens by this rhc deployer",
    "rhc deployer launch history list",
    "what has this robinhood chain deployer launched",
  ],

  validate: async (_runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
    const text = (message.content?.text || "").toLowerCase();
    return /\bdeployer\b/.test(text) && /\b(tokens|launched|launches|list)\b/.test(text) && EVM_RE.test(text);
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
    const address = (message.content?.text || "").match(EVM_RE)?.[1];
    if (!address) {
      callback?.({ text: "Please include a deployer EVM wallet address (0x, 40 hex)." });
      return undefined;
    }
    const sort = /\b(peak|biggest|best)\b/.test(text) ? "peak_mc_usd" : "first_seen_at";

    const result = await client.getDeployerTokens(address, { limit: 25, sort });

    if (result.error) {
      callback?.({ text: result.status === 401 ? AUTH_HINT : `Error: ${result.error}` });
      return undefined;
    }

    const data = result.data!;
    if (!data.is_deployer) {
      callback?.({ text: `${address.slice(0, 10)}… has never deployed a tracked token on Robinhood Chain.`, content: toContent(data) });
      return undefined;
    }
    const fmtUsd = (v?: number | null) => (v == null ? "?" : v >= 1e6 ? `$${(v / 1e6).toFixed(2)}M` : v >= 1e3 ? `$${(v / 1e3).toFixed(1)}K` : `$${v.toFixed(0)}`);
    const lines = (data.tokens || []).slice(0, 12).map(
      (t) => `${t.symbol || t.address.slice(0, 10)} — MC ${fmtUsd(t.market_cap_usd)}, peak ${fmtUsd(t.peak_mc_usd)}${t.is_graduated ? " ✔ graduated" : ""}${t.launchpad ? ` (${t.launchpad})` : ""}`,
    );

    callback?.({
      text: `Robinhood Chain deployer ${address.slice(0, 10)}… launched ${data.total} tokens (showing ${data.tokens.length}, sort=${data.sort}${data.sort_scope === "page" ? ", page-scoped" : ""}):\n${lines.join("\n") || "None."}`,
      content: toContent(data),
    });
    return undefined;
  },

  examples: [
    [
      { name: "user1", content: { text: "List all tokens launched by Robinhood Chain deployer 0x1234567890abcdef1234567890abcdef12345678" } },
      { name: "assistant", content: { text: "Here's that RHC deployer's launch history..." } },
    ],
  ] as Action["examples"],
};
