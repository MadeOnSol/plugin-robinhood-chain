import type { Action, IAgentRuntime, Memory, State, HandlerCallback } from "@elizaos/core";
import { RobinhoodChainClient } from "../client.js";
import { RHC_CLIENT_KEY } from "../index.js";
import { toContent } from "../content.js";

function getClient(runtime: IAgentRuntime): RobinhoodChainClient {
  return ((runtime as unknown as Record<string, unknown>)[RHC_CLIENT_KEY] as RobinhoodChainClient) ?? new RobinhoodChainClient();
}

const AUTH_HINT = "Authentication required. Set ROBINHOOD_CHAIN_API_KEY (or MADEONSOL_API_KEY) — get a free `msk_` key at https://madeonsol.com/pricing.";
const EVM_RE = /\b(0x[0-9a-fA-F]{40})\b/;

type ActivityEvent = {
  type: "launch" | "dev_buy" | "dev_sell";
  at: string;
  token_address: string;
  token_symbol: string | null;
  eth_amount?: number | null;
};

export const rhcDeployerActivityAction: Action = {
  name: "GET_RHC_DEPLOYER_ACTIVITY",
  description:
    "Get a Robinhood Chain developer's launches and own-token buys/sells (launch, dev_buy, dev_sell) as one timeline, newest first, keyset paged. Window since defaults to 30 days, at most 90. The trade scan is bounded: coverage.scan_truncated plus next_cursor say where it stopped. Transfers and linked wallets are not included. event_id equals the rhc:dev_activity WS id. PRO+.",
  similes: [
    "rhc dev activity",
    "robinhood chain developer timeline",
    "did the dev sell on robinhood chain",
    "rhc deployer buys and sells",
  ],

  validate: async (_runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
    const text = message.content?.text || "";
    return /\b(dev|developer|deployer)\b/i.test(text) && /\b(activity|timeline|sell|sold|sells|buys?|bought|dump)/i.test(text) && EVM_RE.test(text);
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
      callback?.({ text: "Please include a developer address (0x, 40 hex)." });
      return undefined;
    }

    const result = await client.getDeployerActivity(address, { limit: 20 });
    if (result.error) {
      callback?.({ text: result.status === 401 ? AUTH_HINT : `Error: ${result.error}` });
      return undefined;
    }

    const data = result.data as { events?: ActivityEvent[]; summary?: { launches?: number; dev_buys?: number; dev_sells?: number }; coverage?: { scan_truncated?: boolean } } | undefined;
    const events = data?.events ?? [];
    if (events.length === 0) {
      callback?.({ text: `No launches or dev trades for ${address.slice(0, 10)}… in the window on Robinhood Chain.`, content: toContent(data) });
      return undefined;
    }
    const s = data?.summary;
    const lines = events.slice(0, 20).map((e) =>
      `• ${e.at} ${e.type} ${e.token_symbol ?? e.token_address.slice(0, 10) + "…"}${e.eth_amount != null ? ` ${e.eth_amount.toFixed(4)} ETH` : ""}`,
    );
    callback?.({
      text: `Robinhood Chain developer ${address.slice(0, 10)}…: ${s?.launches ?? 0} launches, ${s?.dev_buys ?? 0} dev buys, ${s?.dev_sells ?? 0} dev sells${data?.coverage?.scan_truncated ? " (scan truncated, more via next_cursor)" : ""}\n${lines.join("\n")}`,
      content: toContent(data),
    });
    return undefined;
  },

  examples: [
    [
      { name: "user1", content: { text: "Show the dev activity timeline for Robinhood Chain deployer 0x1234567890abcdef1234567890abcdef12345678" } },
      { name: "assistant", content: { text: "Here is that developer's launch and dev-trade timeline..." } },
    ],
  ] as Action["examples"],
};
