/**
 * Robinhood Chain API client (chain id 4663).
 *
 * Talks to MadeOnSol's Robinhood Chain endpoints in the /api/v1/rhc namespace,
 * served from a self-hosted RHC node. Auth is a single mode: a MadeOnSol API key
 * (`msk_`, Bearer) — the SAME key that covers the Solana API, bundled into every
 * tier at no extra cost. Get a free key at https://madeonsol.com/pricing.
 *
 * Everything here is EVM-native: `token_address`/`0x` addresses (lowercase),
 * `eth_amount`, `tx_hash`, `block_number`, `net_flow_eth`. There are no Solana
 * field names. The x402 pay-per-call rail is live on Robinhood Chain too (6 keyless endpoints), but its signing path is NOT available
 * on Robinhood Chain — key auth only.
 */

import { VERSION } from "./version.js";

const DEFAULT_BASE = "https://madeonsol.com";

export interface RobinhoodChainClientOptions {
  /** MadeOnSol API base URL. Default https://madeonsol.com */
  baseUrl?: string;
  /** MadeOnSol API key (`msk_...`). Get one free at https://madeonsol.com/pricing. */
  apiKey?: string;
  /** Optional fetch override (tests / custom transports). */
  fetchFn?: typeof fetch;
}

export interface RateLimitInfo {
  limit?: string;
  remaining?: string;
  reset?: string;
  requestId?: string;
}

export interface ApiResult<T = unknown> {
  data?: T;
  error?: string;
  status: number;
}

// ── Response shapes (EVM-native, from the RHC OpenAPI contract) ──

/** One row of the live RHC KOL trade feed. */
export interface RhcKolTrade {
  evm_address: string;
  kol_name: string | null;
  kol_twitter: string | null;
  token_address: string;
  token_symbol: string | null;
  token_name: string | null;
  launchpad: string | null;
  is_graduated: boolean | null;
  deployer_tier: "elite" | "good" | "neutral" | "spammer" | null;
  token_age_minutes: number | null;
  action: "buy" | "sell";
  eth_amount: number | null;
  token_amount: number | null;
  price_usd_at_trade: number | null;
  market_cap_usd_at_trade: number | null;
  current_mc_usd: number | null;
  peak_mc_usd: number | null;
  liquidity_usd: number | null;
  mc_multiple_since_trade: number | null;
  dex: string;
  pool: string | null;
  tx_hash: string;
  block_number: number;
  traded_at: string;
}

export interface RhcKolFeedResponse {
  chain: "robinhood";
  trades: RhcKolTrade[];
  count: number;
  data_age_seconds: number | null;
  next_before: string | null;
}

export interface RhcKolLeaderboardRow {
  kol_name: string | null;
  kol_twitter: string | null;
  trades: number;
  buys: number;
  sells: number;
  buy_eth: number;
  sell_eth: number;
  net_eth: number;
  tokens_traded: number;
  last_trade_at: string;
}

export interface RhcKolLeaderboardResponse {
  chain: "robinhood";
  period: "24h" | "7d" | "30d";
  leaderboard: RhcKolLeaderboardRow[];
  count: number;
}

export interface RhcHotToken {
  token_address: string;
  token_symbol: string | null;
  token_name: string | null;
  launchpad: string | null;
  is_graduated: boolean | null;
  deployer_tier: string | null;
  kols_buying: number;
  buys: number;
  sells: number;
  buy_eth: number;
  net_eth: number;
  market_cap_usd: number | null;
  last_trade_at: string;
}

export interface RhcHotTokensResponse {
  chain: "robinhood";
  window: "5m" | "15m" | "1h" | "6h" | "24h";
  tokens: RhcHotToken[];
  count: number;
}

export interface RhcKolProfileResponse {
  chain: "robinhood";
  evm_address: string;
  kol_name: string | null;
  kol_twitter: string | null;
  stats: {
    trades: number;
    buys: number;
    sells: number;
    buy_eth: number;
    sell_eth: number;
    net_eth: number;
    tokens_traded: number;
    window: string;
  };
  trades: Array<Record<string, unknown>>;
}

/** One coordinated token — bought by `kol_count` distinct KOLs inside the window. */
export interface RhcCoordinationToken {
  token_address: string;
  token_symbol: string | null;
  token_name: string | null;
  launchpad: string | null;
  is_graduated: boolean | null;
  deployer_tier: "elite" | "good" | "neutral" | "spammer" | null;
  token_age_minutes: number | null;
  kol_count: number;
  total_buys: number;
  buy_eth: number;
  sell_eth: number;
  net_eth: number;
  /** `accumulating` when net_eth >= 0, else `distributing`. */
  signal: "accumulating" | "distributing";
  exited_count: number;
  holders_count: number;
  first_buy_at: string;
  last_buy_at: string;
  time_to_consensus_sec: number;
  market_cap_usd_at_first_buy: number | null;
  current_mc_usd: number | null;
  peak_mc_usd: number | null;
  liquidity_usd: number | null;
  kols: Array<{
    evm_address: string;
    name: string | null;
    twitter_url: string | null;
    buy_eth: number;
    sell_eth: number;
    exited: boolean;
  }>;
}

export interface RhcKolCoordinationResponse {
  chain: "robinhood";
  coordination: RhcCoordinationToken[];
  count: number;
  period: "1h" | "6h" | "24h" | "7d";
  min_kols: number;
}

/** The globally earliest KOL buy on a token — the discovery signal. */
export interface RhcFirstTouch {
  token_address: string;
  token_symbol: string | null;
  token_name: string | null;
  launchpad: string | null;
  is_graduated: boolean | null;
  first_buy_at: string;
  eth_amount: number | null;
  token_amount: number | null;
  tx_hash: string;
  token_age_minutes: number | null;
  market_cap_usd_at_first_buy: number | null;
  price_usd_at_first_buy: number | null;
  current_mc_usd: number | null;
  peak_mc_usd: number | null;
  first_kol: {
    /** ULTRA/BUSINESS only — name + twitter_url are always returned. */
    evm_address?: string;
    name: string | null;
    twitter_url: string | null;
  };
}

export interface RhcKolFirstTouchesResponse {
  chain: "robinhood";
  events: RhcFirstTouch[];
  count: number;
  next_before: string | null;
  data_age_seconds: number | null;
}

/** One row of the RHC DEX trade tape. `trader_eoa` is the effective trading account — `tx.from`, or the ERC-4337 userOp sender when bundled. */
export interface RhcTrade {
  block_number: number;
  block_time: string;
  tx_hash: string;
  log_index: number;
  dex: string;
  pool: string;
  trader: string | null;
  trader_eoa: string | null;
  router: string | null;
  token_address: string | null;
  action: "buy" | "sell" | null;
  eth_amount: number | null;
  price_native: number | null;
  price_usd: number | null;
  mc_usd_at_trade: number | null;
  gas_price: number | null;
  tx_index: number | null;
  method_selector: string | null;
  liquidity: number | null;
  launchpad: string | null;
  is_kol: boolean;
  kol_name: string | null;
  deployer_tier: "elite" | "good" | "neutral" | "spammer" | null;
}

export interface RhcTradesResponse {
  chain: "robinhood";
  trades: RhcTrade[];
  count: number;
  next_before: string | null;
}

export interface RhcTokenSummary {
  token_address: string;
  symbol: string | null;
  name: string | null;
  launchpad: string | null;
  is_graduated: boolean | null;
  deployer_address: string | null;
  deployer_tier: "elite" | "good" | "neutral" | "spammer" | null;
  price_usd: number | null;
  market_cap_usd: number | null;
  fdv_usd: number | null;
  peak_mc_usd: number | null;
  peak_mc_at: string | null;
  drawdown_from_peak_pct: number | null;
  liquidity_usd: number | null;
  primary_dex: string | null;
  primary_pool: string | null;
  last_trade_time: string | null;
}

export interface RhcTokensResponse {
  chain: "robinhood";
  tokens: RhcTokenSummary[];
  count: number;
  sort: string;
}

export interface RhcTokenResponse {
  chain: "robinhood";
  token_address: string;
  symbol: string | null;
  name: string | null;
  decimals: number | null;
  launchpad: string | null;
  is_graduated: boolean | null;
  deployer_address: string | null;
  price_usd: number | null;
  market_cap_usd: number | null;
  fdv_usd: number | null;
  peak_mc_usd: number | null;
  drawdown_from_peak_pct: number | null;
  liquidity_usd: number | null;
  deployer: {
    address: string;
    tier: "elite" | "good" | "neutral" | "spammer";
    tokens_deployed: number;
    graduation_rate: number | null;
    runner_rate: number | null;
    runners: number;
    best_peak_mc_usd: number | null;
    launchpads: string[];
  } | null;
  deployer_other_tokens: string[];
  kol_activity: {
    distinct_kols: number;
    names: string[];
    buys: number;
    sells: number;
    net_eth: number;
  };
  pools: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

export interface RhcCandle {
  bucket_start: string;
  open_price_usd: number;
  high_price_usd: number;
  low_price_usd: number;
  close_price_usd: number;
  open_mc_usd: number | null;
  high_mc_usd: number | null;
  low_mc_usd: number | null;
  close_mc_usd: number | null;
  close_liquidity_usd: number | null;
  volume_usd: number;
  volume_buy_usd: number | null;
  volume_sell_usd: number | null;
  trades: number;
  buy_count: number | null;
  sell_count: number | null;
  dex: string | null;
  pool_address: string | null;
}

export interface RhcCandlesResponse {
  chain: "robinhood";
  token_address: string;
  timeframe: string;
  candles: RhcCandle[];
  count: number;
}

export interface RhcKolConsensus {
  total_kol_buyers: number;
  total_kol_sellers: number;
  kol_exit_rate: number;
  net_flow_eth: number;
  total_buy_eth: number;
  total_sell_eth: number;
  first_kol_buy_at: string | null;
  last_kol_buy_at: string | null;
  first_touch_wallet: string | null;
  first_touch_at: string | null;
  median_entry_mc_usd: number | null;
  entry_mc_samples: number;
  total_trades: number;
  /** ULTRA only. */
  buyers?: string[];
  /** ULTRA only. */
  exited?: string[];
}

export interface RhcKolConsensusResponse {
  chain: "robinhood";
  token_address: string;
  current_mc_usd: number | null;
  current_price_usd: number | null;
  consensus: RhcKolConsensus | null;
}

export interface RhcBuyerQualityResponse {
  chain: "robinhood";
  token_address: string;
  current_mc_usd: number | null;
  quality: {
    score: number;
    confidence: "low" | "medium" | "high";
    signal: "positive" | "neutral" | "negative";
    breakdown: {
      early_buyers_analyzed: number;
      alpha_wallet_count: number;
      kol_count: number;
      bundle_buyer_count: number;
      dump_cluster_count: number;
      recycled_early_buyer_count: number;
      avg_historical_win_rate: number | null;
      bot_dominated: boolean;
    };
  };
  coverage?: {
    bundle_detection: "available";
    dump_cluster_signal: "available";
    note?: string;
  };
  note?: string;
}

/** One entry of a POST /rhc/token/batch response. Unknown addresses come back as `found:false`. */
export type RhcBatchToken =
  | { address: string; found: false }
  | {
      address: string;
      found: true;
      symbol: string | null;
      name: string | null;
      decimals: number | null;
      launchpad: string | null;
      is_graduated: boolean | null;
      graduated_at: string | null;
      first_seen_at: string | null;
      price_usd: number | null;
      market_cap_usd: number | null;
      fdv_usd: number | null;
      liquidity_usd: number | null;
      peak_mc_usd: number | null;
      peak_mc_at: string | null;
      primary_dex: string | null;
      last_trade_time: string | null;
      deployer:
        | ({ address: string; source: string | null } & Partial<{
            tier: "elite" | "good" | "neutral" | "spammer";
            tokens_deployed: number;
            graduated: number;
            graduation_rate: number;
            runners: number;
            runner_rate: number;
          }>)
        | null;
    };

export interface RhcTokenBatchResponse {
  chain: "robinhood";
  tokens: RhcBatchToken[];
  /** Count AFTER de-duplication of the requested addresses. */
  requested: number;
  found: number;
}

/** One entry of a POST /rhc/tokens/batch/buyer-quality response — a score or a per-token error. */
export type RhcBatchBuyerQuality =
  | RhcBuyerQualityResponse
  | { chain: "robinhood"; token_address: string; error: string };

export interface RhcBatchBuyerQualityResponse {
  chain: "robinhood";
  tokens: RhcBatchBuyerQuality[];
  requested: number;
  scored: number;
  /** Hard cap of 20 — lower than the Solana batch cap of 50 (per-token cohort computation). */
  max_addresses: number;
  coverage?: Record<string, unknown>;
}

/** One wallet in an RHC bundle cohort. ULTRA adds `win_rate`, `likely_bot`, `tokens_held`. */
export interface RhcBundleWallet {
  rank: number;
  wallet: string;
  held_ratio: number | null;
  has_sold: boolean;
  is_kol: boolean;
  win_rate?: number | null;
  likely_bot?: boolean;
  tokens_held?: number;
}

export interface RhcBundleResponse {
  chain: "robinhood";
  token_address: string;
  bundle: {
    wallet_count: number;
    /** No atomic multi-signer tx on this Arbitrum Orbit L2 — `same_block` or `none`. */
    bundle_kind: "same_block" | "none";
    held_ratio: number | null;
    held_pct_of_supply: number | null;
    fully_exited: boolean;
    buy_volume: number;
    tokens_held: number;
  };
  /** Empty for BASIC; top-10 for PRO; full cohort for ULTRA. */
  wallets: RhcBundleWallet[];
}

export interface RhcDeployerRow {
  deployer_address: string;
  tokens_deployed: number;
  graduated: number;
  graduation_rate: number;
  runners: number;
  runner_rate: number;
  best_peak_mc_usd: number | null;
  launchpads: string[];
  first_deploy_at: string | null;
  last_deploy_at: string | null;
  tier: "elite" | "good" | "neutral" | "spammer";
}

export interface RhcDeployerLeaderboardResponse {
  chain: "robinhood";
  deployers: RhcDeployerRow[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

export interface RhcDeployerProfileResponse {
  chain: "robinhood";
  is_deployer: boolean;
  address: string;
  deployer: {
    deployer_address: string;
    tokens_deployed: number;
    curve_tokens: number;
    graduated: number;
    bonding_rate: number | null;
    runners: number;
    runner_rate: number;
    best_peak_mc_usd: number | null;
    launchpads: string[];
    first_deploy_at: string | null;
    last_deploy_at: string | null;
    tier: "elite" | "good" | "neutral" | "spammer";
  } | null;
  recent_tokens: Array<Record<string, unknown>>;
  recent_tokens_count: number;
}

/**
 * Compact reputation row echoed by the trajectory / tokens deployer routes.
 * `tier` rides `runner_rate` (the $100K bar) since migration 267 — `graduation_rate`
 * is still the $40K bar and is still returned, but it no longer sets the tier.
 */
export interface RhcDeployerSummary {
  deployer_address: string;
  tokens_deployed: number;
  graduated: number;
  graduation_rate: number;
  runners: number;
  runner_rate: number;
  tier: "elite" | "good" | "neutral" | "spammer";
}

export interface RhcDeployerTrajectoryResponse {
  chain: "robinhood";
  is_deployer: boolean;
  address: string;
  deployer: RhcDeployerSummary | null;
  /** States what the "bond" wording actually counted — `graduated ($40K+ peak market cap)`. */
  success_metric?: string;
  trajectory: {
    current_streak: { type: "bond" | "fail" | "none"; count: number };
    longest_bond_streak: number;
    longest_fail_streak: number;
    rolling_bond_rates: Array<{ window_end: number; bond_rate: number }>;
    trend: "improving" | "declining" | "stable";
    avg_days_between_deploys: number | null;
    avg_recovery_tokens: number | null;
    best_stretch: { start_index: number; end_index: number; bond_rate: number } | null;
    worst_stretch: { start_index: number; end_index: number; bond_rate: number } | null;
    total_tokens_analyzed: number;
  } | null;
  /** true when the 500-token analysis cap was hit — the curve is partial. */
  truncated?: boolean;
}

export interface RhcDeployerToken {
  address: string;
  symbol: string | null;
  name: string | null;
  launchpad: string | null;
  deployer_source: string | null;
  is_graduated: boolean | null;
  graduated_at: string | null;
  first_seen_at: string | null;
  market_cap_usd: number | null;
  peak_mc_usd: number | null;
  peak_mc_at: string | null;
  liquidity_usd: number | null;
}

export interface RhcDeployerTokensResponse {
  chain: "robinhood";
  is_deployer: boolean;
  address: string;
  deployer: RhcDeployerSummary | null;
  tokens: RhcDeployerToken[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
  sort?: "first_seen_at" | "peak_mc_usd";
  /** `page` when sort=peak_mc_usd — that ordering is applied to the fetched page only. */
  sort_scope?: "page";
}

export interface RhcBestToken {
  address: string;
  symbol: string | null;
  name: string | null;
  launchpad: string | null;
  first_seen_at: string | null;
  is_graduated: boolean | null;
  market_cap_usd: number | null;
  peak_mc_usd: number | null;
  peak_mc_at: string | null;
  liquidity_usd: number | null;
  deployer: {
    address: string;
    tier: "elite" | "good";
    graduation_rate: number;
    runner_rate: number;
    tokens_deployed: number;
  } | null;
}

export interface RhcBestTokensResponse {
  chain: "robinhood";
  tokens: RhcBestToken[];
  period: "24h" | "7d" | "30d" | "all";
  limit: number;
  reputable_deployers: number;
  candidates_scanned?: number;
  /** true when the 1000-candidate scan cap was hit — the top-N is drawn from the most RECENT launches. */
  truncated?: boolean;
}

export interface RhcDeployerStatsResponse {
  chain: "robinhood";
  total_deployers: number;
  total_tokens: number;
  reputable_deployers: number;
  by_tier: Record<string, { deployers: number; tokens: number }>;
  spam_token_share: number | null;
  alerts_24h: number;
  alerts_7d: number;
  /** The thresholds actually in force — elite/good ride runner_rate, spammer keys off graduation_rate. */
  tier_rules: Record<string, string>;
  graduation_definition: string;
  runner_definition: string;
}

/** One deployer alert. `tier` is resolved at READ time; `tier_at_alert` is the snapshot. */
export interface RhcDeployerAlert {
  id: string;
  deployer_address: string;
  token_address: string;
  token_symbol: string | null;
  token_name: string | null;
  alert_type: "new_deploy" | "graduated";
  title: string | null;
  message: string | null;
  launchpad: string | null;
  tier: "elite" | "good" | "neutral" | "spammer" | null;
  tier_at_alert: "elite" | "good" | "neutral" | "spammer" | null;
  /** true when the deployer's tier changed since the alert fired. */
  tier_is_stale: boolean;
  mc_at_alert: number | null;
  current_mc_usd: number | null;
  liquidity_usd: number | null;
  priority: "high" | "medium";
  is_active: boolean;
  created_at: string;
  event_at: string | null;
}

export interface RhcDeployerAlertsResponse {
  chain: "robinhood";
  alerts: RhcDeployerAlert[];
  limit: number;
  offset: number;
  /** Echoes whether the default liquidity gate ran, e.g. `liquidity_usd >= $100`. */
  tradability_filter: string;
  next_event_at: string | null;
  next_before: string | null;
  data_age_seconds: number | null;
}

export interface RhcDeployerHistoryResponse {
  chain: "robinhood";
  is_deployer: boolean;
  address: string;
  deployer: RhcDeployerRow | null;
  tokens: Array<{
    address: string;
    symbol: string | null;
    name: string | null;
    launchpad: string | null;
    is_graduated: boolean | null;
    graduated_at: string | null;
    graduated_pool: string | null;
    first_seen_at: string | null;
    market_cap_usd: number | null;
    peak_mc_usd: number | null;
    peak_mc_at: string | null;
  }>;
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

export interface RhcRecentBondsResponse {
  chain: "robinhood";
  /** The milestone that defines a graduation on this chain — 40000 USD peak MC. */
  graduation_mc: number;
  tokens: Array<{
    address: string;
    symbol: string | null;
    name: string | null;
    launchpad: string | null;
    is_graduated: boolean | null;
    deployer_address: string | null;
    deployer_tier: "elite" | "good" | "neutral" | "spammer" | null;
    first_seen_at: string | null;
    market_cap_usd: number | null;
    peak_mc_usd: number | null;
    peak_mc_at: string | null;
  }>;
  limit: number;
  next_peak_mc_at: string | null;
}

export interface RhcAlphaWallet {
  wallet: string;
  classification: "bot" | "smart_money" | "trader";
  is_known_kol: boolean;
  trades: number;
  tokens: number;
  buy_eth: number;
  sell_eth: number;
  net_eth: number;
  win_rate: number | null;
  memecoin_share: number | null;
  avg_trade_mc_usd: number | null;
  last_trade_at: string | null;
}

export interface RhcAlphaWalletsResponse {
  chain: "robinhood";
  wallets: RhcAlphaWallet[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

// ── Wallet intelligence ──
//
// Every figure is ETH-denominated. Cost basis is FIFO over a rolling 90-day
// window, so "open" means FIFO-unmatched buys INSIDE that window: a position
// opened earlier reads as a sell with no matching buy. `partial` and
// `cost_basis_observable_from` disclose exactly that.

export interface RhcWalletProfileResponse {
  chain: "robinhood";
  address: string;
  stats: {
    first_seen: string | null;
    last_seen: string | null;
    total_trades: number;
    /** Denominator for every PnL figure below. */
    analyzed_trades: number;
    /** Pre-2026-07-18 rows with a NULL trader_eoa — unattributable by design. */
    unattributed_trades: number;
    unsized_trades: number;
    buys: number;
    sells: number;
    bought_eth: number;
    sold_eth: number;
    realized_pnl_eth: number;
    unrealized_pnl_eth: number;
    total_pnl_eth: number;
    held_value_eth: number;
    unique_tokens: number;
    open_positions: number;
    window_days: number;
    partial: boolean;
  };
  flags: {
    is_kol: boolean;
    kol_name: string | null;
    is_deployer: boolean;
    deployer_tier: string | null;
    deployer_tokens: number | null;
    deployer_runner_rate: number | null;
    is_alpha_tracked: boolean;
    alpha_win_rate: number | null;
    alpha_net_eth: number | null;
    alpha_tokens_traded: number | null;
    likely_bot: boolean | null;
    is_dumper: boolean;
    early_buyer_tokens: number;
  };
  top_tokens: Record<string, unknown>[];
  recent_trades: Record<string, unknown>[];
  derived: {
    win_rate: number | null;
    wins: number;
    losses: number;
    avg_trade_size_eth: number | null;
    is_active: boolean;
  };
  /** `true` when the snapshot timed out — `flags` still resolve. */
  stats_unavailable: boolean;
  cache_hit: boolean;
}

export interface RhcOpenPosition {
  token_address: string;
  token_symbol: string | null;
  token_name: string | null;
  launchpad: string | null;
  is_graduated: boolean | null;
  token_amount: number;
  cost_basis_eth: number;
  avg_entry_price_eth: number;
  current_price_eth: number | null;
  current_value_eth: number | null;
  unrealized_eth: number | null;
  unrealized_pct: number | null;
  current_mc_usd: number | null;
  liquidity_usd: number | null;
  /** `v4_virtual_ceiling` = bonding-curve ceiling, NOT withdrawable TVL. */
  liquidity_basis: "v4_virtual_ceiling" | "measured";
  buys_in_position: number;
  realized_so_far_eth: number;
  first_buy_at: string | null;
  last_buy_at: string | null;
}

export interface RhcWalletPnlResponse {
  chain: "robinhood";
  address: string;
  window_days: number;
  summary: {
    realized_eth: number;
    unrealized_eth: number;
    total_pnl_eth: number;
    total_bought_eth: number;
    total_sold_eth: number;
    wins: number;
    losses: number;
    win_rate: number | null;
    profit_factor: number | null;
    avg_hold_minutes: number | null;
    median_hold_minutes: number | null;
    max_drawdown_eth: number;
    open_positions_count: number;
    closed_positions_count: number;
    total_tokens_traded: number;
  };
  pnl_curve: { date: string; day_pnl: number; cumulative_pnl: number; trades: number }[];
  closed_positions: {
    token_address: string;
    token_symbol: string | null;
    bought_eth: number;
    sold_eth: number;
    pnl_eth: number;
    roi_pct: number | null;
    hold_minutes: number | null;
    result: "win" | "loss" | "breakeven";
  }[];
  open_positions: RhcOpenPosition[];
  notes: {
    denomination: "ETH";
    /** Buys before this date are invisible to cost basis. */
    cost_basis_observable_from: string;
    partial: boolean;
    partial_reason: string;
  };
  cache_hit: boolean;
}

export interface RhcWalletPositionsResponse {
  chain: "robinhood";
  address: string;
  window_days: number;
  summary: {
    open_positions: number;
    total_cost_basis_eth: number;
    total_current_value_eth: number;
    total_unrealized_eth: number;
    /** Excluded from the value/unrealized totals. */
    unpriced_positions: number;
  };
  positions: RhcOpenPosition[];
}

export interface RhcWalletTrade {
  token_address: string | null;
  token_symbol: string | null;
  launchpad: string | null;
  action: "buy" | "sell" | null;
  eth_amount: number | null;
  token_amount: number | null;
  price_usd: number | null;
  mc_usd_at_trade: number | null;
  dex: string | null;
  tx_hash: string;
  block_number: number;
  block_time: string;
}

export interface RhcWalletTradesResponse {
  chain: "robinhood";
  address: string;
  trades: RhcWalletTrade[];
  count: number;
  has_more: boolean;
  /** Opaque keyset cursor — `null` when the tape is exhausted. */
  next_before: string | null;
}

// ── Wallet tracker (watchlist) ──
//
// Quotas are PER CHAIN: PRO 50 / ULTRA 100 / BUSINESS 500 RHC wallets,
// independent of the Solana watchlist. Addresses are lowercased on write to
// match `rhc_trades.trader_eoa`.

export interface RhcTrackedWallet {
  wallet_address: string;
  label: string | null;
  added_at: string;
}

export interface RhcWalletTrackerListResponse {
  chain: "robinhood";
  wallets: RhcTrackedWallet[];
  count: number;
  limit: number;
  remaining: number;
}

export interface RhcWalletTrackerWalletResponse {
  chain: "robinhood";
  wallet: RhcTrackedWallet;
}

export interface RhcWalletTrackerRemovedResponse {
  chain: "robinhood";
  removed: string;
}

export interface RhcWalletTrackerTradesResponse {
  chain: "robinhood";
  trades: (RhcWalletTrade & { trader_eoa: string | null; label: string | null })[];
  count: number;
  has_more: boolean;
  next_before: string | null;
}

export interface RhcWalletTrackerSummaryResponse {
  chain: "robinhood";
  period: string;
  interval: string;
  /** `true` when the rollup timed out — stats are zeroed, not absent. */
  stats_unavailable: boolean;
  wallets: (RhcTrackedWallet & {
    stats: {
      trades: number;
      buys: number;
      sells: number;
      buy_eth: number;
      sell_eth: number;
      net_eth: number;
      tokens_traded: number;
      last_trade_at: string | null;
    };
  })[];
}

// ── Rule engine (copy-trade, price alerts, coordination, first touches) ──
//
// These are the only WRITE surfaces on Robinhood Chain — they create server-side
// rules, they do not execute anything on-chain. Every quota below is PER CHAIN:
// a full set of Solana rules does not consume RHC capacity, and vice versa.

/** `{ chain, deleted: true }` — the shape every rule DELETE returns. */
export interface RhcDeletedResponse {
  chain: "robinhood";
  deleted: true;
}

/**
 * One RHC copy-trade rule. Amounts are ETH (`min_trade_eth` / `sizing_amount`),
 * not SOL. There is deliberately NO market-cap band on RHC copy-trade — the
 * producer's notify payload carries no market cap, so a band could only be a
 * per-event lookup in the hot path of a ~3.3M trades/day chain.
 */
export interface RhcCopytradeSubscription {
  id: number;
  name: string | null;
  /** Lowercased on write — the evaluator matches lowercased event addresses. */
  source_wallets: string[];
  min_trade_eth: number;
  only_action: "buy" | "sell" | "both";
  sizing_mode: "fixed" | "proportional" | "percent_source";
  sizing_amount: number;
  delivery_mode: "webhook" | "websocket" | "both";
  webhook_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RhcCopytradeSubscriptionsResponse {
  chain: "robinhood";
  subscriptions: RhcCopytradeSubscription[];
}

export interface RhcCopytradeSubscriptionResponse {
  chain: "robinhood";
  subscription: RhcCopytradeSubscription;
}

/** Create response — `webhook_secret` is returned ONCE and never again. */
export interface RhcCopytradeSubscriptionCreatedResponse extends RhcCopytradeSubscriptionResponse {
  /** null when delivery_mode is `websocket`. Store it — it is not retrievable later. */
  webhook_secret: string | null;
  note: string;
}

/** One fired copy-trade signal. `suggested_eth_amount` is sizing output, not an order. */
export interface RhcCopytradeSignal {
  id: number;
  subscription_id: number;
  fired_at: string;
  source_wallet: string;
  action: "buy" | "sell";
  token_address: string;
  token_symbol: string | null;
  token_name: string | null;
  source_eth_amount: number | null;
  suggested_eth_amount: number | null;
  price_usd: number | null;
  dex: string | null;
  tx_hash: string;
  delivered: boolean;
  delivered_at: string | null;
}

export interface RhcCopytradeSignalsResponse {
  chain: "robinhood";
  signals: RhcCopytradeSignal[];
  count: number;
}

/** One RHC price alert. Market-cap denominated — `baseline_mc_usd` is captured at create time. */
export interface RhcPriceAlert {
  id: number;
  name: string | null;
  token_address: string;
  token_symbol: string | null;
  baseline_mc_usd: number;
  drop_pct: number;
  recovery_pct: number | null;
  status: "watching" | "dipped" | "recovered" | "expired";
  dip_low_mc_usd: number | null;
  dip_fired_at: string | null;
  delivery_mode: "webhook" | "websocket" | "both";
  webhook_url: string | null;
  is_active: boolean;
  /** Alerts expire 30 days after creation. */
  expires_at: string;
  created_at: string;
  updated_at: string;
}

export interface RhcPriceAlertsResponse {
  chain: "robinhood";
  alerts: RhcPriceAlert[];
}

export interface RhcPriceAlertResponse {
  chain: "robinhood";
  alert: RhcPriceAlert;
}

export interface RhcPriceAlertCreatedResponse extends RhcPriceAlertResponse {
  /** null when delivery_mode is `websocket`. Shown once. */
  webhook_secret: string | null;
  /** RHC alerts are POLLED (~15s), NOT sub-second like the Solana alerts. */
  evaluation: { mode: "polled"; interval_seconds: number; note: string };
  note: string;
}

export interface RhcPriceAlertEvent {
  id: number;
  alert_id: number;
  event_type: "dip" | "recovery";
  fired_at: string;
  token_address: string;
  baseline_mc_usd: number;
  current_mc_usd: number;
  drop_pct_actual: number | null;
  dip_low_mc_usd: number | null;
  recovery_pct_actual: number | null;
  delivered: boolean;
  delivered_at: string | null;
}

export interface RhcPriceAlertEventsResponse {
  chain: "robinhood";
  events: RhcPriceAlertEvent[];
  count: number;
}

/** One RHC coordination alert rule — fires when N+ tracked KOLs buy the same token in a window. */
export interface RhcCoordinationAlertRule {
  /** UUID. */
  id: string;
  name: string | null;
  min_kols: number;
  window_minutes: number;
  min_score: number;
  cooldown_min: number;
  score_jump_break: number;
  min_mc_usd: number | null;
  max_mc_usd: number | null;
  delivery_mode: "websocket" | "webhook" | "both";
  webhook_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RhcCoordinationAlertRulesResponse {
  chain: "robinhood";
  rules: RhcCoordinationAlertRule[];
}

export interface RhcCoordinationAlertRuleResponse {
  chain: "robinhood";
  rule: RhcCoordinationAlertRule;
}

export interface RhcCoordinationAlertRuleCreatedResponse extends RhcCoordinationAlertRuleResponse {
  webhook_secret: string | null;
  /** States which score components are real on RHC — `earliness` is defaulted. */
  scoring: { score_version: string; quality: string; earliness: string; note: string };
  note: string;
}

/**
 * First-touch subscription filters. RHC deliberately omits Solana's
 * `min_scout_tier` / `min_n_touches` (no mv_kol_scout_score on this chain) and
 * offers KOL win-rate + strategy instead. Unknown keys are REJECTED, not ignored.
 */
export interface RhcFirstTouchFilters {
  /** Single KOL EVM address — lowercased on write. */
  kol?: string;
  min_first_buy_eth?: number;
  /** 0–1, from mv_rhc_kol_scores. */
  min_kol_winrate?: number;
  strategy?: "scalper" | "day_trader" | "swing" | "inactive" | "unscored";
  min_mc_usd?: number;
  max_mc_usd?: number;
}

export interface RhcFirstTouchSubscription {
  /** UUID. */
  id: string;
  name: string | null;
  filters: RhcFirstTouchFilters;
  delivery_mode: "websocket" | "webhook" | "both";
  webhook_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RhcFirstTouchSubscriptionsResponse {
  chain: "robinhood";
  subscriptions: RhcFirstTouchSubscription[];
}

export interface RhcFirstTouchSubscriptionResponse {
  chain: "robinhood";
  subscription: RhcFirstTouchSubscription;
}

export interface RhcFirstTouchSubscriptionCreatedResponse extends RhcFirstTouchSubscriptionResponse {
  webhook_secret: string | null;
  note: string;
}

/**
 * Robinhood Chain client. All 52 RHC endpoints, EVM-native, Bearer `msk_` auth.
 */
export class RobinhoodChainClient {
  private baseUrl: string;
  private apiKey?: string;
  private fetchFn: typeof fetch;

  /** Most recent rate-limit headers, populated by every request. */
  lastRateLimit: RateLimitInfo = {};

  constructor(options: RobinhoodChainClientOptions = {}) {
    this.baseUrl = options.baseUrl || DEFAULT_BASE;
    this.apiKey = options.apiKey;
    this.fetchFn = options.fetchFn || globalThis.fetch;

    if (!this.apiKey) {
      console.warn(
        "\n[robinhood-chain] RobinhoodChainClient constructed without an apiKey — every request will fail.\n" +
          "  → Get a free `msk_` key (covers Robinhood Chain at no extra cost) at https://madeonsol.com/pricing\n" +
          "  → Then: new RobinhoodChainClient({ apiKey: process.env.ROBINHOOD_CHAIN_API_KEY })\n",
      );
    }
  }

  private captureRateLimit(res: Response) {
    this.lastRateLimit = {
      limit: res.headers.get("X-RateLimit-Limit") ?? undefined,
      remaining: res.headers.get("X-RateLimit-Remaining") ?? undefined,
      reset: res.headers.get("X-RateLimit-Reset") ?? undefined,
      requestId: res.headers.get("X-Request-Id") ?? undefined,
    };
  }

  /**
   * Low-level request against `/api/v1{path}`. `path` starts with `/rhc/...`.
   * `params` become the query string; `body` (batch POSTs only) is sent as JSON.
   */
  private async restRequest<T = unknown>(
    method: string,
    path: string,
    params?: Record<string, string | number | boolean | undefined>,
    body?: unknown,
  ): Promise<ApiResult<T>> {
    if (!this.apiKey) {
      return {
        error:
          "MadeOnSol API key required. Get a free `msk_` key at https://madeonsol.com/pricing",
        status: 401,
      };
    }
    const url = new URL(`/api/v1${path}`, this.baseUrl);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined) url.searchParams.set(k, String(v));
      }
    }
    const res = await this.fetchFn(url.toString(), {
      method,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "User-Agent": `plugin-robinhood-chain/${VERSION}`,
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    this.captureRateLimit(res);
    if (!res.ok) {
      const text = await res.text().catch(() => "Unknown error");
      return { error: text, status: res.status };
    }
    return { data: (await res.json()) as T, status: res.status };
  }

  // ── KOL ──

  /** Live RHC KOL trade feed (BASIC+). GET /rhc/kol/feed */
  getKolFeed(params?: {
    limit?: number;
    before?: string;
    action?: "buy" | "sell";
    kol?: string;
    min_eth?: number;
  }) {
    return this.restRequest<RhcKolFeedResponse>("GET", "/rhc/kol/feed", params);
  }

  /** RHC KOL activity leaderboard (BASIC+). GET /rhc/kol/leaderboard */
  getKolLeaderboard(params?: { period?: "24h" | "7d" | "30d"; limit?: number }) {
    return this.restRequest<RhcKolLeaderboardResponse>("GET", "/rhc/kol/leaderboard", params);
  }

  /** Consensus tokens bought by 2+ KOLs (BASIC+). GET /rhc/kol/hot-tokens */
  getKolHotTokens(params?: { window?: "5m" | "15m" | "1h" | "6h" | "24h" }) {
    return this.restRequest<RhcHotTokensResponse>("GET", "/rhc/kol/hot-tokens", params);
  }

  /** Single KOL profile on RHC (BASIC+). GET /rhc/kol/{wallet} */
  getKol(wallet: string) {
    return this.restRequest<RhcKolProfileResponse>("GET", `/rhc/kol/${encodeURIComponent(wallet)}`);
  }

  /**
   * Tokens bought by `min_kols`+ DISTINCT KOLs inside the window — the coordination
   * signal, with per-KOL buy/sell breakdown and accumulating/distributing (BASIC+).
   * GET /rhc/kol/coordination
   */
  getKolCoordination(params?: {
    period?: "1h" | "6h" | "24h" | "7d";
    min_kols?: number;
    limit?: number;
    /** MC at the FIRST KOL buy. Tokens with unknown MC are dropped when a band is set. */
    min_mc_usd?: number;
    max_mc_usd?: number;
  }) {
    return this.restRequest<RhcKolCoordinationResponse>("GET", "/rhc/kol/coordination", params);
  }

  /**
   * The globally earliest buy by ANY tracked KOL per token — the discovery signal
   * (BASIC+; limit clamped to 20 below PRO, `first_kol.evm_address` ULTRA-only).
   * GET /rhc/kol/first-touches
   */
  getKolFirstTouches(params?: {
    limit?: number;
    since?: string;
    before?: string;
    min_eth?: number;
    token_age_max_min?: number;
    launchpad?: string;
    min_mc_usd?: number;
    max_mc_usd?: number;
  }) {
    return this.restRequest<RhcKolFirstTouchesResponse>("GET", "/rhc/kol/first-touches", params);
  }

  // ── Trades ──

  /** RHC DEX trade tape with the effective trader EOA + MEV fields (PRO+). GET /rhc/trades */
  getTrades(params?: {
    limit?: number;
    token?: string;
    dex?: "uniswap-v2" | "uniswap-v3" | "uniswap-v4";
    action?: "buy" | "sell";
    min_eth?: number;
    before?: string;
  }) {
    return this.restRequest<RhcTradesResponse>("GET", "/rhc/trades", params);
  }

  // ── Tokens ──

  /** RHC token discovery, sortable/filterable (PRO+). GET /rhc/tokens */
  getTokens(params?: {
    limit?: number;
    sort?: "last_trade" | "market_cap" | "liquidity" | "peak_mc";
    min_mc_usd?: number;
    min_liquidity_usd?: number;
    launchpad?: string;
  }) {
    return this.restRequest<RhcTokensResponse>("GET", "/rhc/tokens", params);
  }

  /** Full snapshot for one RHC token (BASIC+). GET /rhc/tokens/{address} */
  getToken(address: string) {
    return this.restRequest<RhcTokenResponse>("GET", `/rhc/tokens/${encodeURIComponent(address)}`);
  }

  /** 1-minute OHLC candles (PRO+). GET /rhc/tokens/{address}/candles */
  getTokenCandles(address: string, params?: { limit?: number; from?: string; to?: string }) {
    return this.restRequest<RhcCandlesResponse>(
      "GET",
      `/rhc/tokens/${encodeURIComponent(address)}/candles`,
      params,
    );
  }

  /** KOL consensus on a token — net_flow_eth, exit rate, first touch (PRO+). GET /rhc/tokens/{address}/kol-consensus */
  getTokenKolConsensus(address: string) {
    return this.restRequest<RhcKolConsensusResponse>(
      "GET",
      `/rhc/tokens/${encodeURIComponent(address)}/kol-consensus`,
    );
  }

  /** 0–100 early-buyer quality score (BASIC+). GET /rhc/tokens/{address}/buyer-quality */
  getTokenBuyerQuality(address: string) {
    return this.restRequest<RhcBuyerQualityResponse>(
      "GET",
      `/rhc/tokens/${encodeURIComponent(address)}/buyer-quality`,
    );
  }

  /** Launch-bundle detection (same_block cohort held-%) (BASIC+). GET /rhc/tokens/{address}/bundle */
  getTokenBundle(address: string) {
    return this.restRequest<RhcBundleResponse>(
      "GET",
      `/rhc/tokens/${encodeURIComponent(address)}/bundle`,
    );
  }

  /**
   * Top traders of one token, ranked by REALIZED ETH flow (sell − buy), with
   * wallet reputation, dump-cluster membership and early-buyer rank.
   * `net_eth` is NOT PnL — it ignores a trader's remaining bag, so a wallet that
   * bought and still holds ranks last (PRO+). GET /rhc/tokens/{address}/top-traders
   */
  getTokenTopTraders(address: string, params: { limit?: number; offset?: number } = {}) {
    return this.restRequest<unknown>(
      "GET",
      `/rhc/tokens/${encodeURIComponent(address)}/top-traders`,
      params,
    );
  }

  /**
   * Net buy/sell flow by mutually-exclusive trader cohort. `net_eth = sell − buy`,
   * so POSITIVE means the cohort distributed (PRO+). GET /rhc/tokens/{address}/flow
   */
  getTokenFlow(address: string, window?: "1h" | "6h" | "24h" | "7d") {
    return this.restRequest<unknown>(
      "GET",
      `/rhc/tokens/${encodeURIComponent(address)}/flow`,
      { window },
    );
  }

  /**
   * Peak MC, drawdown and high-water curve. Returns BOTH the stored
   * `peak_mc_usd_recorded` (what deployer tiering keys off, sampled from write
   * batches so it can undercount) and `peak_mc_usd_observed` (candle max,
   * trade-level truth, always >= recorded) (PRO+). GET /rhc/tokens/{address}/peak-history
   */
  getTokenPeakHistory(
    address: string,
    params: { window?: "24h" | "7d" | "30d" | "all"; curve?: "true" | "false" } = {},
  ) {
    return this.restRequest<unknown>(
      "GET",
      `/rhc/tokens/${encodeURIComponent(address)}/peak-history`,
      params,
    );
  }

  /**
   * EVM-native risk computed LIVE on-chain. Not the Solana model — EVM has no
   * mint/freeze authority and only ~2% of RHC tokens expose an owner function, so
   * an absent flag is the norm, not a safety signal. The load-bearing field is
   * `sellability.sellable`, simulated at head and never cached (PRO+).
   * GET /rhc/tokens/{address}/risk
   */
  getTokenRisk(address: string) {
    return this.restRequest<unknown>("GET", `/rhc/tokens/${encodeURIComponent(address)}/risk`);
  }

  /**
   * Exact holder set + concentration from ERC-20 Transfer-log replay, reconciled
   * against on-chain totalSupply(). Check `verified` before relying on it.
   * Concentration excludes pools and burns; `balance` is a uint256 decimal string.
   * `holder_growth.{1h,24h,7d}` = entered / entered_still_holding / exited / net
   * (≈ Δ holder_count) per window; a window is null only when the chain had no
   * ingested trades in it (PRO+). GET /rhc/tokens/{address}/holders
   */
  getTokenHolders(address: string, params: { limit?: number; offset?: number } = {}) {
    return this.restRequest<unknown>(
      "GET",
      `/rhc/tokens/${encodeURIComponent(address)}/holders`,
      params,
    );
  }

  /**
   * Up to 50 RHC tokens in ONE call — metadata, price/MC/FDV/liquidity, peak MC, and
   * deployer reputation. Set-based (3 queries total), not a fan-out. Unknown addresses
   * come back as `found:false` so the array stays positional (BASIC+).
   * POST /rhc/token/batch
   */
  getTokenBatch(addresses: string[]) {
    return this.restRequest<RhcTokenBatchResponse>("POST", "/rhc/token/batch", undefined, {
      addresses,
    });
  }

  /**
   * Early-buyer quality for several RHC tokens in one call. **Max 20**, not the
   * Solana batch cap of 50 — each token is a per-token cohort computation. A token
   * that fails to score degrades to an error entry instead of failing the batch (BASIC+).
   * POST /rhc/tokens/batch/buyer-quality
   */
  getTokenBatchBuyerQuality(addresses: string[]) {
    return this.restRequest<RhcBatchBuyerQualityResponse>(
      "POST",
      "/rhc/tokens/batch/buyer-quality",
      undefined,
      { addresses },
    );
  }

  // ── Deployer hunter ──

  /** Deployer reputation leaderboard (BASIC+). GET /rhc/deployer-hunter/leaderboard */
  getDeployerLeaderboard(params?: {
    sort?: "graduation_rate" | "runner_rate" | "tokens_deployed" | "best_peak_mc_usd" | "last_deploy_at";
    tier?: "elite" | "good" | "neutral" | "spammer";
    min_tokens?: number;
    limit?: number;
    offset?: number;
  }) {
    return this.restRequest<RhcDeployerLeaderboardResponse>(
      "GET",
      "/rhc/deployer-hunter/leaderboard",
      params,
    );
  }

  /** Single deployer profile — 200 with is_deployer:false for unknown wallets (BASIC+). GET /rhc/deployer-hunter/{address} */
  getDeployer(address: string) {
    return this.restRequest<RhcDeployerProfileResponse>(
      "GET",
      `/rhc/deployer-hunter/${encodeURIComponent(address)}`,
    );
  }

  /**
   * Is this deployer getting better or worse? Streaks, a 10-token rolling success
   * rate, trend, deploy cadence and recovery speed. The per-token success event is
   * the $40K peak-MC GRADUATION (RHC launchpads are direct-to-DEX, so there is no
   * bonding curve) — `success_metric` says so explicitly (BASIC+).
   * GET /rhc/deployer-hunter/{address}/trajectory
   */
  getDeployerTrajectory(address: string) {
    return this.restRequest<RhcDeployerTrajectoryResponse>(
      "GET",
      `/rhc/deployer-hunter/${encodeURIComponent(address)}/trajectory`,
    );
  }

  /**
   * Paginated launch history for one deployer, enriched with live + peak MC. The
   * profile route caps `recent_tokens` at 50; this is the enumerable list (BASIC+).
   * NOTE: `sort=peak_mc_usd` orders the fetched PAGE only (`sort_scope:"page"`),
   * because peak MC lives in another table — it is not a global top-tokens ranking.
   * GET /rhc/deployer-hunter/{address}/tokens
   */
  getDeployerTokens(
    address: string,
    params?: { limit?: number; offset?: number; sort?: "first_seen_at" | "peak_mc_usd" },
  ) {
    return this.restRequest<RhcDeployerTokensResponse>(
      "GET",
      `/rhc/deployer-hunter/${encodeURIComponent(address)}/tokens`,
      params,
    );
  }

  /**
   * Full token-deploy history for one deployer + their reputation row (PRO+ — the
   * point-in-time profile stays BASIC). RHC has no per-day reputation snapshots, so
   * this is a deploy history, not a daily tier time-series.
   * GET /rhc/deployer-hunter/{address}/history
   */
  getDeployerHistory(address: string, params?: { limit?: number; offset?: number }) {
    return this.restRequest<RhcDeployerHistoryResponse>(
      "GET",
      `/rhc/deployer-hunter/${encodeURIComponent(address)}/history`,
      params,
    );
  }

  /**
   * The highest-peaking tokens launched by REPUTABLE (good/elite) deployers in a
   * window — "what did the deployers worth tracking actually produce" (BASIC+).
   * GET /rhc/deployer-hunter/best-tokens
   */
  getDeployerBestTokens(params?: { period?: "24h" | "7d" | "30d" | "all"; limit?: number }) {
    return this.restRequest<RhcBestTokensResponse>(
      "GET",
      "/rhc/deployer-hunter/best-tokens",
      params,
    );
  }

  /**
   * Chain-wide deployer reputation summary — population per tier, spam token share,
   * alert volume, and the thresholds actually in force. Since migration 267 elite/good
   * are earned on `runner_rate` ($100K peak MC); `spammer` still keys off
   * `graduation_rate` ($40K) (BASIC+). GET /rhc/deployer-hunter/stats
   */
  getDeployerStats() {
    return this.restRequest<RhcDeployerStatsResponse>("GET", "/rhc/deployer-hunter/stats");
  }

  /**
   * Deployer signal feed — new deploys and graduations from tracked deployers (BASIC+;
   * ULTRA gets the full limit, BASIC/PRO share a 50-alert cap).
   *
   * A tradability filter (`liquidity_usd >= $100`) runs BY DEFAULT — a pumped-and-drained
   * token is not a signal. Pass `include_untradeable: true` for the raw tape. `tier` is
   * resolved at read time from the live reputation table, with `tier_at_alert` /
   * `tier_is_stale` exposing drift from the snapshot.
   * GET /rhc/deployer-hunter/alerts
   */
  getDeployerAlerts(params?: {
    deployer_tier?: "elite" | "good" | "neutral" | "spammer";
    priority?: "high" | "medium";
    alert_type?: "new_deploy" | "graduated";
    launchpad?: string;
    min_mc?: number;
    limit?: number;
    offset?: number;
    /** Poll forward: only alerts strictly newer than this ISO timestamp. */
    since?: string;
    /** Page back: only alerts strictly older than this ISO timestamp. */
    before?: string;
    /** Disables the default liquidity gate. */
    include_untradeable?: boolean;
  }) {
    return this.restRequest<RhcDeployerAlertsResponse>(
      "GET",
      "/rhc/deployer-hunter/alerts",
      params,
    );
  }

  /**
   * Recent graduations, newest peak first. On RHC a graduation is the $40K peak-MC
   * milestone (no bonding curve), so the set is defined purely by peak MC (BASIC+).
   * `min_peak` only raises that floor. GET /rhc/deployer-hunter/recent-bonds
   */
  getRecentBonds(params?: {
    deployer_tier?: "elite" | "good" | "neutral" | "spammer";
    min_peak?: number;
    limit?: number;
  }) {
    return this.restRequest<RhcRecentBondsResponse>(
      "GET",
      "/rhc/deployer-hunter/recent-bonds",
      params,
    );
  }

  // ── Alpha wallets ──

  /** Smart-money wallet ranking by realized on-chain performance (PRO+). GET /rhc/alpha-wallets */
  getAlphaWallets(params?: {
    classification?: "all" | "human" | "bot" | "smart_money";
    identity?: "all" | "known_kol" | "unknown";
    min_memecoin_share?: number;
    max_avg_mc_usd?: number;
    min_net_eth?: number;
    min_win_rate?: number;
    max_win_rate?: number;
    min_trades?: number;
    min_tokens?: number;
    min_buy_eth?: number;
    active_hours?: number;
    sort?: "net_eth" | "win_rate" | "trades" | "tokens" | "buy_eth" | "memecoin_share" | "last_trade_at";
    order?: "desc" | "asc";
    limit?: number;
    offset?: number;
  }) {
    return this.restRequest<RhcAlphaWalletsResponse>("GET", "/rhc/alpha-wallets", params);
  }

  // ── Wallet intelligence (PRO+) ──
  //
  // The profile / pnl / positions trio shares ONE 90-day snapshot cache
  // server-side, so calling all three on an address costs roughly one
  // computation — `cache_hit` says which call paid for it.

  /**
   * Any RHC wallet's 90-day profile — ETH-denominated FIFO PnL, per-token
   * breakdown, recent trades, plus reputation flags (KOL, deployer + tier,
   * alpha-ranked, dump cluster, early-buyer count). PRO+.
   * GET /rhc/wallet/{address}
   */
  getWallet(address: string) {
    return this.restRequest<RhcWalletProfileResponse>("GET", `/rhc/wallet/${encodeURIComponent(address)}`);
  }

  /**
   * Full FIFO cost-basis PnL over 90 days — realized/unrealized split, daily
   * curve, closed positions with ROI and hold time, open positions marked to
   * market. Same FIFO implementation as Solana's, so the chains compare
   * directly. PRO+. GET /rhc/wallet/{address}/pnl
   */
  getWalletPnl(address: string) {
    return this.restRequest<RhcWalletPnlResponse>("GET", `/rhc/wallet/${encodeURIComponent(address)}/pnl`);
  }

  /**
   * Only what the wallet still holds, marked to the current price. Check
   * `liquidity_basis` before sizing an exit — `v4_virtual_ceiling` is a
   * bonding-curve ceiling, not withdrawable TVL. PRO+.
   * GET /rhc/wallet/{address}/positions
   */
  getWalletPositions(address: string) {
    return this.restRequest<RhcWalletPositionsResponse>("GET", `/rhc/wallet/${encodeURIComponent(address)}/positions`);
  }

  /**
   * One wallet's swaps, newest first, keyset-paginated. Filters by WALLET —
   * `getTrades({ token })` filters the global tape by TOKEN instead. PRO+.
   * GET /rhc/wallet/{address}/trades
   */
  getWalletTrades(
    address: string,
    params?: { limit?: number; before?: string; since?: string; action?: "buy" | "sell"; token?: string },
  ) {
    return this.restRequest<RhcWalletTradesResponse>("GET", `/rhc/wallet/${encodeURIComponent(address)}/trades`, params);
  }

  // ── Wallet tracker / watchlist (PRO+) ──
  //
  // Quotas are PER CHAIN — PRO 50 / ULTRA 100 / BUSINESS 500 RHC wallets,
  // independent of the Solana watchlist.

  /** Your RHC watchlist, with count/limit/remaining. PRO+. GET /rhc/wallet-tracker/watchlist */
  getWalletTrackerList() {
    return this.restRequest<RhcWalletTrackerListResponse>("GET", "/rhc/wallet-tracker/watchlist");
  }

  /**
   * Track an RHC wallet. Stored lowercase to match `rhc_trades.trader_eoa` —
   * a checksummed address would join to nothing. 409 if already tracked.
   * PRO+. POST /rhc/wallet-tracker/watchlist
   */
  addTrackedWallet(input: { wallet_address: string; label?: string }) {
    return this.restRequest<RhcWalletTrackerWalletResponse>(
      "POST",
      "/rhc/wallet-tracker/watchlist",
      undefined,
      input.label === undefined ? { wallet_address: input.wallet_address } : input,
    );
  }

  /** Untrack an RHC wallet, freeing a quota slot. PRO+. DELETE /rhc/wallet-tracker/watchlist/{address} */
  removeTrackedWallet(address: string) {
    return this.restRequest<RhcWalletTrackerRemovedResponse>(
      "DELETE",
      `/rhc/wallet-tracker/watchlist/${encodeURIComponent(address)}`,
    );
  }

  /**
   * Relabel a tracked wallet. `null` clears the label (accepted here, unlike
   * on add). PRO+. PATCH /rhc/wallet-tracker/watchlist/{address}
   */
  relabelTrackedWallet(address: string, label: string | null) {
    return this.restRequest<RhcWalletTrackerWalletResponse>(
      "PATCH",
      `/rhc/wallet-tracker/watchlist/${encodeURIComponent(address)}`,
      undefined,
      { label },
    );
  }

  /**
   * Merged trade feed across your tracked wallets, each row label-tagged.
   * Cursor is an opaque keyset, not the Solana tracker's integer epoch.
   * PRO+. GET /rhc/wallet-tracker/trades
   */
  getWalletTrackerTrades(params?: {
    limit?: number;
    before?: string;
    wallet?: string;
    action?: "buy" | "sell";
    token?: string;
  }) {
    return this.restRequest<RhcWalletTrackerTradesResponse>("GET", "/rhc/wallet-tracker/trades", params);
  }

  /**
   * Per-wallet buy/sell/volume rollup. Sourced from `rhc_trades` directly, not
   * a per-subscriber capture log — so a newly tracked wallet has full history
   * immediately, which the Solana tracker cannot do. PRO+.
   * GET /rhc/wallet-tracker/summary
   */
  getWalletTrackerSummary(params?: { period?: string; wallet?: string }) {
    return this.restRequest<RhcWalletTrackerSummaryResponse>("GET", "/rhc/wallet-tracker/summary", params);
  }

  // ── Copy-trade rules (PRO+) ──
  //
  // Rules are DATA, not execution: a fired rule delivers a suggested size, it
  // never places an order. Quotas (rules and source wallets per rule) are
  // per-chain — Solana copy-trade rules do not consume RHC capacity.

  /** List your RHC copy-trade rules (PRO+). GET /rhc/copytrade/subscriptions */
  getCopytradeSubscriptions() {
    return this.restRequest<RhcCopytradeSubscriptionsResponse>("GET", "/rhc/copytrade/subscriptions");
  }

  /**
   * Create an RHC copy-trade rule (PRO+). `sizing_amount` and `min_trade_eth` are
   * ETH. No market-cap band exists on RHC copy-trade. `webhook_url` is required
   * unless `delivery_mode` is `websocket`, and the returned `webhook_secret` is
   * shown ONCE. POST /rhc/copytrade/subscriptions
   */
  createCopytradeSubscription(input: {
    name?: string;
    /** 1–250 EVM addresses; the per-tier cap is enforced server-side. */
    source_wallets: string[];
    min_trade_eth?: number;
    only_action?: "buy" | "sell" | "both";
    sizing_mode?: "fixed" | "proportional" | "percent_source";
    sizing_amount: number;
    delivery_mode?: "webhook" | "websocket" | "both";
    webhook_url?: string;
  }) {
    return this.restRequest<RhcCopytradeSubscriptionCreatedResponse>(
      "POST",
      "/rhc/copytrade/subscriptions",
      undefined,
      input,
    );
  }

  /** One copy-trade rule by numeric id (PRO+). GET /rhc/copytrade/subscriptions/{id} */
  getCopytradeSubscription(id: number) {
    return this.restRequest<RhcCopytradeSubscriptionResponse>(
      "GET",
      `/rhc/copytrade/subscriptions/${id}`,
    );
  }

  /**
   * Update a copy-trade rule (PRO+). Partial — send only what changes. The wallet
   * cap is re-checked, so a rule cannot be PATCHed past its tier.
   * PATCH /rhc/copytrade/subscriptions/{id}
   */
  updateCopytradeSubscription(
    id: number,
    updates: {
      name?: string | null;
      source_wallets?: string[];
      min_trade_eth?: number;
      only_action?: "buy" | "sell" | "both";
      sizing_mode?: "fixed" | "proportional" | "percent_source";
      sizing_amount?: number;
      delivery_mode?: "webhook" | "websocket" | "both";
      webhook_url?: string | null;
      is_active?: boolean;
    },
  ) {
    return this.restRequest<RhcCopytradeSubscriptionResponse>(
      "PATCH",
      `/rhc/copytrade/subscriptions/${id}`,
      undefined,
      updates,
    );
  }

  /** Delete a copy-trade rule (PRO+). DELETE /rhc/copytrade/subscriptions/{id} */
  deleteCopytradeSubscription(id: number) {
    return this.restRequest<RhcDeletedResponse>("DELETE", `/rhc/copytrade/subscriptions/${id}`);
  }

  /**
   * Fire history for your copy-trade rules — the catch-up path after a missed
   * webhook or a dropped WS connection. Retained 7 days (PRO+).
   * GET /rhc/copytrade/signals
   */
  getCopytradeSignals(params?: {
    /** 1–500, default 50. */
    limit?: number;
    /** Restrict to one rule you own. */
    subscription_id?: number;
    /** ISO 8601 — only signals fired at or after this instant. */
    since?: string;
  }) {
    return this.restRequest<RhcCopytradeSignalsResponse>("GET", "/rhc/copytrade/signals", params);
  }

  // ── Price alerts (PRO+) ──

  /** List your RHC price alerts (PRO+). GET /rhc/price-alerts */
  getPriceAlerts() {
    return this.restRequest<RhcPriceAlertsResponse>("GET", "/rhc/price-alerts");
  }

  /**
   * Create an RHC price alert (PRO+). The baseline market cap is captured NOW, so
   * the alert is a delta from the moment you set it; the token must already be
   * tracked with a market cap or the call 400s.
   *
   * RHC alerts are evaluated on a ~15s POLL of `rhc_token_prices`, not a live
   * price loop — effective latency is that interval plus the token's own
   * price-update cadence. This is NOT parity with the sub-second Solana alerts.
   * POST /rhc/price-alerts
   */
  createPriceAlert(input: {
    name?: string;
    /** EVM token address (0x, 40 hex). */
    token_address: string;
    /** Percent drop from the captured baseline MC, 0.01–99.99. */
    drop_pct: number;
    /** Optional second leg — percent recovery from the dip low, 0.01–1000. */
    recovery_pct?: number;
    delivery_mode?: "webhook" | "websocket" | "both";
    webhook_url?: string;
  }) {
    return this.restRequest<RhcPriceAlertCreatedResponse>(
      "POST",
      "/rhc/price-alerts",
      undefined,
      input,
    );
  }

  /** One price alert by numeric id (PRO+). GET /rhc/price-alerts/{id} */
  getPriceAlert(id: number) {
    return this.restRequest<RhcPriceAlertResponse>("GET", `/rhc/price-alerts/${id}`);
  }

  /**
   * Update a price alert (PRO+). `token_address`, `drop_pct` and `recovery_pct`
   * are IMMUTABLE — changing a threshold would make the alert's recorded events
   * uninterpretable, so delete and recreate instead.
   * PATCH /rhc/price-alerts/{id}
   */
  updatePriceAlert(
    id: number,
    updates: {
      name?: string | null;
      delivery_mode?: "webhook" | "websocket" | "both";
      webhook_url?: string | null;
      is_active?: boolean;
    },
  ) {
    return this.restRequest<RhcPriceAlertResponse>(
      "PATCH",
      `/rhc/price-alerts/${id}`,
      undefined,
      updates,
    );
  }

  /** Delete a price alert (PRO+). DELETE /rhc/price-alerts/{id} */
  deletePriceAlert(id: number) {
    return this.restRequest<RhcDeletedResponse>("DELETE", `/rhc/price-alerts/${id}`);
  }

  /**
   * Dip / recovery fire history for your price alerts — the catch-up path.
   * Retained 30 days (PRO+). GET /rhc/price-alerts/events
   */
  getPriceAlertEvents(params?: {
    /** 1–500, default 50. */
    limit?: number;
    event_type?: "dip" | "recovery";
    /** ISO 8601 — only events fired at or after this instant. */
    since?: string;
    /** Restrict to one alert you own. */
    alert_id?: number;
  }) {
    return this.restRequest<RhcPriceAlertEventsResponse>("GET", "/rhc/price-alerts/events", params);
  }

  // ── KOL coordination alert rules (PRO+) ──

  /** List your RHC coordination alert rules (PRO+). GET /rhc/kol/coordination/alerts */
  getCoordinationAlerts() {
    return this.restRequest<RhcCoordinationAlertRulesResponse>(
      "GET",
      "/rhc/kol/coordination/alerts",
    );
  }

  /**
   * Create a coordination alert rule — fire when `min_kols`+ tracked KOLs buy the
   * same RHC token inside `window_minutes` (PRO+). Scoring is the shared v1 scorer
   * so the number is comparable to Solana, but the `earliness` component is
   * DEFAULTED on RHC (no early-entry equivalent); `quality` is real. Each fired
   * signal records which components were real in `score_inputs`.
   * POST /rhc/kol/coordination/alerts
   */
  createCoordinationAlert(input: {
    name?: string;
    /** 2–50, default 3. */
    min_kols?: number;
    /** 1–60, default 15. */
    window_minutes?: number;
    /** 0–100, default 0. */
    min_score?: number;
    /** 1–1440 minutes, default 30. */
    cooldown_min?: number;
    /** Re-fire inside the cooldown if the score jumps by this much. 0–100, default 20. */
    score_jump_break?: number;
    min_mc_usd?: number | null;
    max_mc_usd?: number | null;
    delivery_mode?: "websocket" | "webhook" | "both";
    webhook_url?: string;
  }) {
    return this.restRequest<RhcCoordinationAlertRuleCreatedResponse>(
      "POST",
      "/rhc/kol/coordination/alerts",
      undefined,
      input,
    );
  }

  /** One coordination alert rule by UUID (PRO+). GET /rhc/kol/coordination/alerts/{id} */
  getCoordinationAlert(id: string) {
    return this.restRequest<RhcCoordinationAlertRuleResponse>(
      "GET",
      `/rhc/kol/coordination/alerts/${encodeURIComponent(id)}`,
    );
  }

  /** Update a coordination alert rule (PRO+). PATCH /rhc/kol/coordination/alerts/{id} */
  updateCoordinationAlert(
    id: string,
    updates: {
      name?: string | null;
      min_kols?: number;
      window_minutes?: number;
      min_score?: number;
      cooldown_min?: number;
      score_jump_break?: number;
      min_mc_usd?: number | null;
      max_mc_usd?: number | null;
      delivery_mode?: "websocket" | "webhook" | "both";
      webhook_url?: string | null;
      is_active?: boolean;
    },
  ) {
    return this.restRequest<RhcCoordinationAlertRuleResponse>(
      "PATCH",
      `/rhc/kol/coordination/alerts/${encodeURIComponent(id)}`,
      undefined,
      updates,
    );
  }

  /** Delete a coordination alert rule (PRO+). DELETE /rhc/kol/coordination/alerts/{id} */
  deleteCoordinationAlert(id: string) {
    return this.restRequest<RhcDeletedResponse>(
      "DELETE",
      `/rhc/kol/coordination/alerts/${encodeURIComponent(id)}`,
    );
  }

  // ── KOL first-touch subscriptions (ULTRA+) ──

  /** List your RHC first-touch subscriptions (ULTRA+). GET /rhc/kol/first-touches/subscriptions */
  getFirstTouchSubscriptions() {
    return this.restRequest<RhcFirstTouchSubscriptionsResponse>(
      "GET",
      "/rhc/kol/first-touches/subscriptions",
    );
  }

  /**
   * Subscribe to RHC first touches — push when a token gets its FIRST tracked-KOL
   * buy (ULTRA+). Filters are RHC-specific: `min_kol_winrate` and `strategy`
   * replace Solana's scout-tier filters, which have no RHC equivalent. Unknown
   * filter keys are rejected rather than silently ignored.
   * POST /rhc/kol/first-touches/subscriptions
   */
  createFirstTouchSubscription(input: {
    name?: string;
    filters?: RhcFirstTouchFilters;
    delivery_mode?: "websocket" | "webhook" | "both";
    webhook_url?: string;
  }) {
    return this.restRequest<RhcFirstTouchSubscriptionCreatedResponse>(
      "POST",
      "/rhc/kol/first-touches/subscriptions",
      undefined,
      input,
    );
  }

  /** One first-touch subscription by UUID (ULTRA+). GET /rhc/kol/first-touches/subscriptions/{id} */
  getFirstTouchSubscription(id: string) {
    return this.restRequest<RhcFirstTouchSubscriptionResponse>(
      "GET",
      `/rhc/kol/first-touches/subscriptions/${encodeURIComponent(id)}`,
    );
  }

  /**
   * Update a first-touch subscription (ULTRA+). `filters` is a WHOLE-OBJECT
   * replace, not a merge — send the complete filter set you want, otherwise
   * removing a filter would be impossible to express.
   * PATCH /rhc/kol/first-touches/subscriptions/{id}
   */
  updateFirstTouchSubscription(
    id: string,
    updates: {
      name?: string | null;
      filters?: RhcFirstTouchFilters;
      delivery_mode?: "websocket" | "webhook" | "both";
      webhook_url?: string | null;
      is_active?: boolean;
    },
  ) {
    return this.restRequest<RhcFirstTouchSubscriptionResponse>(
      "PATCH",
      `/rhc/kol/first-touches/subscriptions/${encodeURIComponent(id)}`,
      undefined,
      updates,
    );
  }

  /** Delete a first-touch subscription (ULTRA+). DELETE /rhc/kol/first-touches/subscriptions/{id} */
  deleteFirstTouchSubscription(id: string) {
    return this.restRequest<RhcDeletedResponse>(
      "DELETE",
      `/rhc/kol/first-touches/subscriptions/${encodeURIComponent(id)}`,
    );
  }
}
