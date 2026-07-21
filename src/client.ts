/**
 * Robinhood Chain API client (chain id 4663).
 *
 * Talks to MadeOnSol's Robinhood Chain endpoints in the /api/v1/rhc namespace,
 * served from a self-hosted RHC node. Auth is a single mode: a MadeOnSol API key
 * (`msk_`, Bearer) — the SAME key that covers the Solana API, bundled into every
 * tier at no extra cost. Get a free key at https://madeonsol.com/developer.
 *
 * Everything here is EVM-native: `token_address`/`0x` addresses (lowercase),
 * `eth_amount`, `tx_hash`, `block_number`, `net_flow_eth`. There are no Solana
 * field names. The x402 pay-per-call rail is Solana-native and is NOT available
 * on Robinhood Chain — key auth only.
 */

import { VERSION } from "./version.js";

const DEFAULT_BASE = "https://madeonsol.com";

export interface RobinhoodChainClientOptions {
  /** MadeOnSol API base URL. Default https://madeonsol.com */
  baseUrl?: string;
  /** MadeOnSol API key (`msk_...`). Get one free at https://madeonsol.com/developer. */
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
 * Robinhood Chain client. All 14 RHC endpoints, EVM-native, Bearer `msk_` auth.
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
          "  → Get a free `msk_` key (covers Robinhood Chain at no extra cost) at https://madeonsol.com/developer\n" +
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

  /** Low-level GET against `/api/v1{path}`. `path` starts with `/rhc/...`. */
  private async restRequest<T = unknown>(
    method: string,
    path: string,
    params?: Record<string, string | number | undefined>,
  ): Promise<ApiResult<T>> {
    if (!this.apiKey) {
      return {
        error:
          "MadeOnSol API key required. Get a free `msk_` key at https://madeonsol.com/developer",
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
      },
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
