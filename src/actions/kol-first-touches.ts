import type { Action, IAgentRuntime, Memory, State, HandlerCallback } from "@elizaos/core";
import { RobinhoodChainClient } from "../client.js";
import { RHC_CLIENT_KEY } from "../index.js";
import { toContent } from "../content.js";

function getClient(runtime: IAgentRuntime): RobinhoodChainClient {
  return ((runtime as unknown as Record<string, unknown>)[RHC_CLIENT_KEY] as RobinhoodChainClient) ?? new RobinhoodChainClient();
}

const AUTH_HINT = "Authentication required. Set ROBINHOOD_CHAIN_API_KEY (or MADEONSOL_API_KEY) — get a free `msk_` key at https://madeonsol.com/pricing.";

export const rhcKolFirstTouchesAction: Action = {
  name: "GET_RHC_KOL_FIRST_TOUCHES",
  description:
    "Get KOL first touches on Robinhood Chain — the GLOBALLY earliest buy by ANY tracked KOL per token (the discovery / early-entry signal), newest first. Each event carries eth_amount, tx_hash, token_age_minutes at the touch, MC and price at the first buy, current and peak MC, and the first_kol block. Filter by min_eth, token_age_max_min, launchpad and an MC band; cursor back with next_before. BASIC+ — limit is clamped to 20 below PRO, and first_kol.evm_address is returned only on ULTRA/BUSINESS (name and twitter_url always).",
  similes: [
    "robinhood chain kol first touches",
    "rhc first kol buy",
    "who discovered this rhc token first",
    "earliest kol entries robinhood chain",
  ],

  validate: async (_runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
    const text = (message.content?.text || "").toLowerCase();
    return /\b(rhc|robinhood)\b/.test(text) && /\b(first touch|first buy|first kol|discover|earliest)/.test(text);
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
    const launchpad = ["pons", "flap", "clanker", "hood.fun", "noxa", "virtuals"].find((l) => text.includes(l));

    const result = await client.getKolFirstTouches({ limit: 20, ...(launchpad ? { launchpad } : {}) });

    if (result.error) {
      callback?.({ text: result.status === 401 ? AUTH_HINT : `Error: ${result.error}` });
      return undefined;
    }

    const data = result.data!;
    const fmtUsd = (v?: number | null) => (v == null ? "?" : v >= 1e6 ? `$${(v / 1e6).toFixed(2)}M` : v >= 1e3 ? `$${(v / 1e3).toFixed(1)}K` : `$${v.toFixed(0)}`);
    const lines = (data.events || []).slice(0, 12).map(
      (e) => `${e.token_symbol || e.token_address.slice(0, 10)} — first touched by ${e.first_kol.name || "unnamed KOL"} at ${fmtUsd(e.market_cap_usd_at_first_buy)} MC (now ${fmtUsd(e.current_mc_usd)}, peak ${fmtUsd(e.peak_mc_usd)}), token was ${e.token_age_minutes ?? "?"}m old`,
    );

    callback?.({
      text: `Robinhood Chain KOL first touches (${data.count}):\n${lines.join("\n") || "None."}`,
      content: toContent(data),
    });
    return undefined;
  },

  examples: [
    [
      { name: "user1", content: { text: "Show the earliest KOL first touches on Robinhood Chain." } },
      { name: "assistant", content: { text: "Here are the latest RHC KOL first touches..." } },
    ],
  ] as Action["examples"],
};
