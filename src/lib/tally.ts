import type { Poll, Vote } from "../types";

export interface TallyRow {
  id: string;
  text: string;
  real: number;
  adjustment: number;
  count: number; // displayed
  pct: number; // 0-100, displayed
}

export interface Tally {
  rows: TallyRow[];
  /** Displayed total: votes for single-select, respondents for multi-select. */
  total: number;
  realRespondents: number;
  leaderId: string | null;
}

export function tally(poll: Poll, votes: Vote[]): Tally {
  const real: Record<string, number> = {};
  poll.options.forEach((o) => (real[o.id] = 0));
  let respondents = 0;
  for (const v of votes) {
    const valid = (v.choices || []).filter((c) => c in real);
    if (!valid.length) continue;
    respondents++;
    valid.forEach((c) => real[c]++);
  }
  const adj = poll.adjustments || {};
  const rows: TallyRow[] = poll.options.map((o) => {
    const a = adj[o.id] || 0;
    return { id: o.id, text: o.text, real: real[o.id], adjustment: a, count: Math.max(0, real[o.id] + a), pct: 0 };
  });
  const sum = rows.reduce((s, r) => s + r.count, 0);
  // Multi-select: percent of respondents. Adjustments can push a count past the
  // real respondent count, so never let the denominator fall below the biggest count.
  const denom = poll.multiSelect ? Math.max(respondents, ...rows.map((r) => r.count), 0) : sum;
  rows.forEach((r) => (r.pct = denom > 0 ? (r.count / denom) * 100 : 0));
  const top = Math.max(0, ...rows.map((r) => r.count));
  const leaders = rows.filter((r) => r.count === top && top > 0);
  return {
    rows,
    total: poll.multiSelect ? denom : sum,
    realRespondents: respondents,
    leaderId: leaders.length === 1 ? leaders[0].id : null,
  };
}
