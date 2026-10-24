// Deployer reputation text for both API contracts.
//
// v1 (default): graduation_rate / runner_rate / runners / graduated / launchpads.
// Deployer Hunter v2 (rule_version "v2.0", after the owner cutover): those v1
// fields are absent; the tier rides organic durable runners over RESOLVED
// launches (organic_runners / resolved_launches, lifetime_rate, recent_rate).
// Every field is read defensively so neither shape prints NaN or throws.

type Row = Record<string, unknown>;

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const pct = (v: unknown): string => {
  const n = num(v);
  return n == null ? "?" : `${(n * 100).toFixed(0)}%`;
};
const cnt = (v: unknown): string => (num(v) == null ? "?" : String(v));

export function isV2Deployer(d: unknown): boolean {
  const r = (d ?? {}) as Row;
  return r.rule_version === "v2.0" || (num(r.organic_runners) != null && num(r.resolved_launches) != null);
}

/** One line: the metric the deployer's tier is earned on. */
export function reputationSummary(d: unknown): string {
  const r = (d ?? {}) as Row;
  if (isV2Deployer(r)) {
    return `organic runners ${cnt(r.organic_runners)}/${cnt(r.resolved_launches)} resolved (lifetime ${pct(r.lifetime_rate)}, recent ${pct(r.recent_rate)})`;
  }
  return `grad ${pct(r.graduation_rate)}, run ${pct(r.runner_rate)}`;
}

/** Profile/history detail lines (v1: runners + best peak + launchpads; v2: resolved + survival + manipulation). */
export function reputationDetail(d: unknown): string[] {
  const r = (d ?? {}) as Row;
  if (isV2Deployer(r)) {
    const lines = [
      `• ${cnt(r.tokens_deployed)} tokens deployed, ${cnt(r.resolved_launches)} resolved, ${cnt(r.organic_runners)} organic runners (lifetime ${pct(r.lifetime_rate)}, recent ${pct(r.recent_rate)})`,
      `• 1h survival ${pct(r.survival_1h_rate)}${num(r.survival_sample) != null ? ` (n=${r.survival_sample})` : ""}, manipulation: ${typeof r.manipulation_status === "string" ? r.manipulation_status : "?"}`,
    ];
    const reasons = Array.isArray(r.tier_reasons) ? r.tier_reasons.filter((x) => typeof x === "string") : [];
    if (reasons.length > 0) lines.push(`• Tier gates not met: ${reasons.join(", ")}`);
    return lines;
  }
  const best = num(r.best_peak_mc_usd);
  const pads = Array.isArray(r.launchpads) ? r.launchpads.filter((x) => typeof x === "string") : [];
  return [
    `• ${cnt(r.tokens_deployed)} tokens deployed, ${cnt(r.graduated)} graduated, ${cnt(r.runners)} runners (${pct(r.runner_rate)})`,
    `• Best peak MC ${best != null ? `$${best.toFixed(0)}` : "?"}, launchpads: ${pads.join(", ") || "?"}`,
  ];
}
