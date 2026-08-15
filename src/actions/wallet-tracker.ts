import type { Action, IAgentRuntime, Memory, State, HandlerCallback } from "@elizaos/core";
import { RobinhoodChainClient } from "../client.js";
import { RHC_CLIENT_KEY } from "../index.js";
import { toContent } from "../content.js";

function getClient(runtime: IAgentRuntime): RobinhoodChainClient {
  return ((runtime as unknown as Record<string, unknown>)[RHC_CLIENT_KEY] as RobinhoodChainClient) ?? new RobinhoodChainClient();
}

const AUTH_HINT = "Authentication required. Set ROBINHOOD_CHAIN_API_KEY (or MADEONSOL_API_KEY) — get a free `msk_` key at https://madeonsol.com/pricing.";
const TIER_HINT = "The Robinhood Chain wallet tracker requires the PRO tier or higher. See https://madeonsol.com/pricing.";

function extractAddress(text: string): string | undefined {
  return text.match(/0x[a-fA-F0-9]{40}/)?.[0]?.toLowerCase();
}

/** `label "my whale"` / `label: my whale` — the quoted form wins. */
function extractLabel(text: string): string | undefined {
  return text.match(/label\s*[:=]?\s*"([^"]{1,64})"/i)?.[1]
    ?? text.match(/\blabel(?:led|ed)?\s+(?:as\s+)?([\w .-]{1,64})/i)?.[1]?.trim()
    ?? undefined;
}

export const rhcWalletTrackerAction: Action = {
  name: "MANAGE_RHC_WALLET_TRACKER",
  description:
    "List, add, remove or relabel wallets on your Robinhood Chain watchlist. Quotas are PER CHAIN — PRO 50 / ULTRA 100 / BUSINESS 500 RHC wallets, independent of the Solana watchlist. Adding and removing WRITE to your account. PRO+.",
  similes: [
    "robinhood chain watchlist",
    "track this rhc wallet",
    "rhc wallet tracker",
    "stop tracking rhc wallet",
    "my tracked robinhood chain wallets",
  ],

  validate: async (_runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
    const text = (message.content?.text || "").toLowerCase();
    return /\b(rhc|robinhood)\b/.test(text) && /\b(watchlist|track|tracking|tracked|untrack|follow)\b/.test(text);
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
    const address = extractAddress(text);

    const fail = (status?: number, error?: string) => {
      callback?.({
        text: status === 401 ? AUTH_HINT
          : status === 403 ? TIER_HINT
          : status === 404 ? "That wallet is not on your Robinhood Chain watchlist."
          : status === 409 ? "That wallet is already on your Robinhood Chain watchlist."
          : `Error: ${error}`,
      });
    };

    // Remove
    if (address && /\b(untrack|remove|stop tracking|delete|unfollow)\b/.test(text)) {
      const res = await client.removeTrackedWallet(address);
      if (res.error) return fail(res.status, res.error), undefined;
      callback?.({ text: `Removed ${res.data!.removed.slice(0, 10)}… from your Robinhood Chain watchlist.`, content: toContent(res.data!) });
      return undefined;
    }

    // Relabel — only when the wallet is already tracked and a label is given.
    if (address && /\b(relabel|rename|change the label|set the label)\b/.test(text)) {
      const label = extractLabel(message.content?.text || "") ?? null;
      const res = await client.relabelTrackedWallet(address, label);
      if (res.error) return fail(res.status, res.error), undefined;
      callback?.({
        text: label
          ? `Relabelled ${address.slice(0, 10)}… to "${label}".`
          : `Cleared the label on ${address.slice(0, 10)}….`,
        content: toContent(res.data!),
      });
      return undefined;
    }

    // Add
    if (address && /\b(track|add|watch|follow)\b/.test(text)) {
      const label = extractLabel(message.content?.text || "");
      const res = await client.addTrackedWallet({ wallet_address: address, ...(label ? { label } : {}) });
      if (res.error) return fail(res.status, res.error), undefined;
      callback?.({
        text: `Now tracking ${address.slice(0, 10)}… on Robinhood Chain${label ? ` as "${label}"` : ""}.`,
        content: toContent(res.data!),
      });
      return undefined;
    }

    // Default: list
    const res = await client.getWalletTrackerList();
    if (res.error) return fail(res.status, res.error), undefined;

    const d = res.data!;
    if (!d.wallets?.length) {
      callback?.({ text: `Your Robinhood Chain watchlist is empty (${d.limit} slots available).`, content: toContent(d) });
      return undefined;
    }
    const rows = d.wallets.slice(0, 25).map((w) => `  ${w.wallet_address.slice(0, 12)}…${w.label ? ` — ${w.label}` : ""}`);
    callback?.({
      text: [`Robinhood Chain watchlist (${d.count}/${d.limit}, ${d.remaining} slots left):`, ...rows].join("\n"),
      content: toContent(d),
    });
    return undefined;
  },

  examples: [
    [
      { name: "user1", content: { text: "Track 0x1234567890abcdef1234567890abcdef12345678 on Robinhood Chain, label \"whale one\"." } },
      { name: "assistant", content: { text: "Now tracking that wallet on Robinhood Chain." } },
    ],
    [
      { name: "user1", content: { text: "Show my Robinhood Chain watchlist." } },
      { name: "assistant", content: { text: "Here are your tracked RHC wallets..." } },
    ],
  ] as Action["examples"],
};
