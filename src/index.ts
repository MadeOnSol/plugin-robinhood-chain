import type { Plugin, IAgentRuntime } from "@elizaos/core";
import { rhcKolFeedAction } from "./actions/kol-feed.js";
import { rhcKolLeaderboardAction } from "./actions/kol-leaderboard.js";
import { rhcKolHotTokensAction } from "./actions/kol-hot-tokens.js";
import { rhcKolProfileAction } from "./actions/kol-profile.js";
import { rhcTradesAction } from "./actions/trades.js";
import { rhcTokensAction } from "./actions/tokens.js";
import { rhcTokenAction } from "./actions/token.js";
import { rhcTokenCandlesAction } from "./actions/token-candles.js";
import { rhcKolConsensusAction } from "./actions/token-kol-consensus.js";
import { rhcBuyerQualityAction } from "./actions/token-buyer-quality.js";
import { rhcTokenBundleAction } from "./actions/token-bundle.js";
import { rhcDeployerLeaderboardAction } from "./actions/deployer-leaderboard.js";
import { rhcDeployerProfileAction } from "./actions/deployer-profile.js";
import { rhcAlphaWalletsAction } from "./actions/alpha-wallets.js";
import { RobinhoodChainClient } from "./client.js";

/** Key used to store the initialized client on the runtime. */
export const RHC_CLIENT_KEY = "robinhood-chain:client";

export const robinhoodChainPlugin: Plugin = {
  name: "robinhood-chain",
  description:
    "Query Robinhood Chain (chain id 4663) trading intelligence from MadeOnSol: EVM-native KOL trades, token discovery, launch-bundle detection, buyer quality, deployer reputation, the DEX trade tape, and smart-money wallet rankings — from a self-hosted RHC node.",
  actions: [
    rhcKolFeedAction,
    rhcKolLeaderboardAction,
    rhcKolHotTokensAction,
    rhcKolProfileAction,
    rhcTradesAction,
    rhcTokensAction,
    rhcTokenAction,
    rhcTokenCandlesAction,
    rhcKolConsensusAction,
    rhcBuyerQualityAction,
    rhcTokenBundleAction,
    rhcDeployerLeaderboardAction,
    rhcDeployerProfileAction,
    rhcAlphaWalletsAction,
  ],

  /**
   * Initialize the Robinhood Chain client.
   * Auth: ROBINHOOD_CHAIN_API_KEY (falls back to MADEONSOL_API_KEY) — the same
   * `msk_` key covers Robinhood Chain at no extra cost. Get a free key at
   * https://madeonsol.com/developer. Robinhood Chain is key-mode only; the x402
   * pay-per-call rail is Solana-native and is not available here.
   */
  init: async (_config: Record<string, string>, runtime: IAgentRuntime) => {
    const baseUrl = String(runtime.getSetting?.("ROBINHOOD_CHAIN_API_URL") || "https://madeonsol.com");
    const apiKey =
      (runtime.getSetting?.("ROBINHOOD_CHAIN_API_KEY") as string | undefined) ||
      (runtime.getSetting?.("MADEONSOL_API_KEY") as string | undefined);

    if (apiKey) {
      console.log("[robinhood-chain] Using MadeOnSol API key (Bearer auth)");
    } else {
      console.warn(
        "[robinhood-chain] No API key configured — every Robinhood Chain call will fail.\n" +
          "  → Get a free `msk_` key (covers Robinhood Chain at no extra cost) at https://madeonsol.com/developer\n" +
          "  → Set ROBINHOOD_CHAIN_API_KEY (or MADEONSOL_API_KEY).",
      );
    }

    const client = new RobinhoodChainClient({ baseUrl, apiKey });
    (runtime as unknown as Record<string, unknown>)[RHC_CLIENT_KEY] = client;
  },
};

export default robinhoodChainPlugin;
export { RobinhoodChainClient } from "./client.js";
export type {
  RobinhoodChainClientOptions,
  RateLimitInfo,
  ApiResult,
  RhcKolTrade,
  RhcKolFeedResponse,
  RhcKolLeaderboardResponse,
  RhcHotTokensResponse,
  RhcKolProfileResponse,
  RhcTrade,
  RhcTradesResponse,
  RhcTokenSummary,
  RhcTokensResponse,
  RhcTokenResponse,
  RhcCandlesResponse,
  RhcKolConsensusResponse,
  RhcBuyerQualityResponse,
  RhcBundleResponse,
  RhcDeployerLeaderboardResponse,
  RhcDeployerProfileResponse,
  RhcAlphaWalletsResponse,
} from "./client.js";
export {
  rhcKolFeedAction,
  rhcKolLeaderboardAction,
  rhcKolHotTokensAction,
  rhcKolProfileAction,
  rhcTradesAction,
  rhcTokensAction,
  rhcTokenAction,
  rhcTokenCandlesAction,
  rhcKolConsensusAction,
  rhcBuyerQualityAction,
  rhcTokenBundleAction,
  rhcDeployerLeaderboardAction,
  rhcDeployerProfileAction,
  rhcAlphaWalletsAction,
};
