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

/** One row of the RHC DEX trade tape. `trader_eoa` is the authoritative wallet. */
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

/**
 * Robinhood Chain client. All 25 RHC endpoints, EVM-native, Bearer `msk_` auth.
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

  /** RHC DEX trade tape with real trader EOA + MEV fields (PRO+). GET /rhc/trades */
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
}
