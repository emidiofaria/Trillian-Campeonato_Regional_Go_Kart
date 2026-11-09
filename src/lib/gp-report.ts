import type { SessionEntry, SessionResult } from './scoring';

export interface RankedStat {
  pilotId: string;
  value: number;
  /** Difference to the best value (0 for the leader). */
  gap: number;
}

function rank(
  entries: SessionEntry[],
  pick: (e: SessionEntry) => number | null,
  direction: 'asc' | 'desc',
): RankedStat[] {
  const ranked = entries
    .filter((e) => e.attended && pick(e) !== null)
    .map((e) => ({ pilotId: e.pilotId, value: pick(e)! }))
    // Stable sort keeps the session order for exact ties.
    .sort((a, b) => (direction === 'asc' ? a.value - b.value : b.value - a.value));
  const best = ranked[0]?.value ?? 0;
  return ranked.map((r) => ({ ...r, gap: Math.abs(r.value - best) }));
}

export interface GpReport {
  fastestLaps: RankedStat[];
  topSpeeds: RankedStat[];
  /** Lowest lap-time standard deviation first. */
  consistency: RankedStat[];
}

/** Secondary rankings of a scored GP session (rankings without data are empty). */
export function gpReport(session: SessionResult): GpReport {
  return {
    fastestLaps: rank(session.entries, (e) => e.bestLap, 'asc'),
    topSpeeds: rank(session.entries, (e) => e.topSpeed, 'desc'),
    consistency: rank(session.entries, (e) => e.lapStdDev, 'asc'),
  };
}
