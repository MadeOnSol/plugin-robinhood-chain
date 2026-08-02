import type { Plugin, IAgentRuntime } from "@elizaos/core";
import { rhcKolFeedAction } from "./actions/kol-feed.js";
import { rhcKolLeaderboardAction } from "./actions/kol-leaderboard.js";
import { rhcKolHotTokensAction } from "./actions/kol-hot-tokens.js";
import { rhcKolProfileAction } from "./actions/kol-profile.js";
import { rhcKolCoordinationAction } from "./actions/kol-coordination.js";
import { rhcKolFirstTouchesAction } from "./actions/kol-first-touches.js";
import { rhcTradesAction } from "./actions/trades.js";
import { rhcTokensAction } from "./actions/tokens.js";
import { rhcTokenAction } from "./actions/token.js";
import { rhcTokenBatchAction } from "./actions/token-batch.js";
import { rhcTokenCandlesAction } from "./actions/token-candles.js";
import { rhcKolConsensusAction } from "./actions/token-kol-consensus.js";
import { rhcBuyerQualityAction } from "./actions/token-buyer-quality.js";
import { rhcTokenBatchBuyerQualityAction } from "./actions/token-batch-buyer-quality.js";
import { rhcTokenBundleAction } from "./actions/token-bundle.js";
import { rhcDeployerLeaderboardAction } from "./actions/deployer-leaderboard.js";
import { rhcDeployerProfileAction } from "./actions/deployer-profile.js";
import { rhcDeployerTrajectoryAction } from "./actions/deployer-trajectory.js";
import { rhcDeployerTokensAction } from "./actions/deployer-tokens.js";
import { rhcDeployerHistoryAction } from "./actions/deployer-history.js";
import { rhcDeployerBestTokensAction } from "./actions/deployer-best-tokens.js";
import { rhcDeployerStatsAction } from "./actions/deployer-stats.js";
import { rhcDeployerAlertsAction } from "./actions/deployer-alerts.js";
import { rhcRecentBondsAction } from "./actions/deployer-recent-bonds.js";
import { rhcAlphaWalletsAction } from "./actions/alpha-wallets.js";
import { rhcCopytradeRulesAction } from "./actions/copytrade-rules.js";
import { rhcCopytradeSignalsAction } from "./actions/copytrade-signals.js";
import { rhcPriceAlertsAction } from "./actions/price-alerts.js";
import { rhcPriceAlertEventsAction } from "./actions/price-alert-events.js";
import { rhcCoordinationAlertsAction } from "./actions/coordination-alerts.js";
import { rhcFirstTouchSubscriptionsAction } from "./actions/first-touch-subscriptions.js";
import { RobinhoodChainClient } from "./client.js";

/** Key used to store the initialized client on the runtime. */
export const RHC_CLIENT_KEY = "robinhood-chain:client";

export const robinhoodChainPlugin: Plugin = {
  name: "robinhood-chain",
  description:
    "Query Robinhood Chain (chain id 4663) trading intelligence from MadeOnSol: EVM-native KOL trades, KOL coordination and first touches, token discovery and batch lookups, launch-bundle detection, buyer quality, deployer reputation with trajectory/history/alerts, the DEX trade tape, and smart-money wallet rankings — from a self-hosted RHC node. Also manages the RHC rule engine: copy-trade rules, market-cap price alerts (~15s polled, not sub-second), KOL coordination alerts and first-touch subscriptions, all with per-chain quotas. Data only — rules deliver signals, they never execute a trade.",
  actions: [
    rhcKolFeedAction,
    rhcKolLeaderboardAction,
    rhcKolHotTokensAction,
    rhcKolProfileAction,
    rhcKolCoordinationAction,
    rhcKolFirstTouchesAction,
    rhcTradesAction,
    rhcTokensAction,
    rhcTokenAction,
    rhcTokenBatchAction,
    rhcTokenCandlesAction,
    rhcKolConsensusAction,
    rhcBuyerQualityAction,
    rhcTokenBatchBuyerQualityAction,
    rhcTokenBundleAction,
    rhcDeployerLeaderboardAction,
    rhcDeployerProfileAction,
    rhcDeployerTrajectoryAction,
    rhcDeployerTokensAction,
    rhcDeployerHistoryAction,
    rhcDeployerBestTokensAction,
    rhcDeployerStatsAction,
    rhcDeployerAlertsAction,
    rhcRecentBondsAction,
    rhcAlphaWalletsAction,
    rhcCopytradeRulesAction,
    rhcCopytradeSignalsAction,
    rhcPriceAlertsAction,
    rhcPriceAlertEventsAction,
    rhcCoordinationAlertsAction,
    rhcFirstTouchSubscriptionsAction,
  ],

  /**
   * Initialize the Robinhood Chain client.
   * Auth: ROBINHOOD_CHAIN_API_KEY (falls back to MADEONSOL_API_KEY) — the same
   * `msk_` key covers Robinhood Chain at no extra cost. Get a free key at
   * https://madeonsol.com/pricing. Robinhood Chain is key-mode only; the x402
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
          "  → Get a free `msk_` key (covers Robinhood Chain at no extra cost) at https://madeonsol.com/pricing\n" +
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
  RhcCoordinationToken,
  RhcKolCoordinationResponse,
  RhcFirstTouch,
  RhcKolFirstTouchesResponse,
  RhcTrade,
  RhcTradesResponse,
  RhcTokenSummary,
  RhcTokensResponse,
  RhcTokenResponse,
  RhcBatchToken,
  RhcTokenBatchResponse,
  RhcCandlesResponse,
  RhcKolConsensusResponse,
  RhcBuyerQualityResponse,
  RhcBatchBuyerQuality,
  RhcBatchBuyerQualityResponse,
  RhcBundleResponse,
  RhcDeployerLeaderboardResponse,
  RhcDeployerProfileResponse,
  RhcDeployerSummary,
  RhcDeployerTrajectoryResponse,
  RhcDeployerToken,
  RhcDeployerTokensResponse,
  RhcDeployerHistoryResponse,
  RhcBestToken,
  RhcBestTokensResponse,
  RhcDeployerStatsResponse,
  RhcDeployerAlert,
  RhcDeployerAlertsResponse,
  RhcRecentBondsResponse,
  RhcAlphaWalletsResponse,
  RhcDeletedResponse,
  RhcCopytradeSubscription,
  RhcCopytradeSubscriptionsResponse,
  RhcCopytradeSubscriptionResponse,
  RhcCopytradeSubscriptionCreatedResponse,
  RhcCopytradeSignal,
  RhcCopytradeSignalsResponse,
  RhcPriceAlert,
  RhcPriceAlertsResponse,
  RhcPriceAlertResponse,
  RhcPriceAlertCreatedResponse,
  RhcPriceAlertEvent,
  RhcPriceAlertEventsResponse,
  RhcCoordinationAlertRule,
  RhcCoordinationAlertRulesResponse,
  RhcCoordinationAlertRuleResponse,
  RhcCoordinationAlertRuleCreatedResponse,
  RhcFirstTouchFilters,
  RhcFirstTouchSubscription,
  RhcFirstTouchSubscriptionsResponse,
  RhcFirstTouchSubscriptionResponse,
  RhcFirstTouchSubscriptionCreatedResponse,
} from "./client.js";
export {
  rhcKolFeedAction,
  rhcKolLeaderboardAction,
  rhcKolHotTokensAction,
  rhcKolProfileAction,
  rhcKolCoordinationAction,
  rhcKolFirstTouchesAction,
  rhcTradesAction,
  rhcTokensAction,
  rhcTokenAction,
  rhcTokenBatchAction,
  rhcTokenCandlesAction,
  rhcKolConsensusAction,
  rhcBuyerQualityAction,
  rhcTokenBatchBuyerQualityAction,
  rhcTokenBundleAction,
  rhcDeployerLeaderboardAction,
  rhcDeployerProfileAction,
  rhcDeployerTrajectoryAction,
  rhcDeployerTokensAction,
  rhcDeployerHistoryAction,
  rhcDeployerBestTokensAction,
  rhcDeployerStatsAction,
  rhcDeployerAlertsAction,
  rhcRecentBondsAction,
  rhcAlphaWalletsAction,
  rhcCopytradeRulesAction,
  rhcCopytradeSignalsAction,
  rhcPriceAlertsAction,
  rhcPriceAlertEventsAction,
  rhcCoordinationAlertsAction,
  rhcFirstTouchSubscriptionsAction,
};
