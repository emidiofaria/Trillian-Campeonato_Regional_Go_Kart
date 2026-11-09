import { describe, expect, it } from 'vitest';
import { gpReport } from '../../src/lib/gp-report';
import { scoreSession } from '../../src/lib/scoring';
import type { ResultEntry } from '../../src/lib/schemas';

const at = (
  pilotId: string,
  avg: number,
  best: number,
  extras: Partial<ResultEntry> = {},
): ResultEntry => ({
  pilotId,
  attended: true,
  avgLapTime: avg,
  bestLap: best,
  secondBestLap: null,
  ...extras,
});

describe('gpReport', () => {
  it('ranks fastest lap, top speed and consistency with gaps to the best, skipping absentees', () => {
    const session = scoreSession({
      raceId: 'gp1',
      entries: [
        at('emidio', 62.769, 59, { topSpeed: 48.81, lapStdDev: 3.31 }),
        at('torres', 63.028, 61.195, { topSpeed: 47.06, lapStdDev: 1.802 }),
        at('dinis', 63.14, 60.059, { topSpeed: 47.95 }),
        { pilotId: 'joel', attended: false, avgLapTime: null, bestLap: null, secondBestLap: null },
      ],
    });
    const report = gpReport(session);

    expect(report.fastestLaps.map((r) => r.pilotId)).toEqual(['emidio', 'dinis', 'torres']);
    expect(report.fastestLaps[1].gap).toBeCloseTo(1.059, 6);
    expect(report.topSpeeds.map((r) => r.pilotId)).toEqual(['emidio', 'dinis', 'torres']);
    expect(report.topSpeeds[2].gap).toBeCloseTo(1.75, 6);
    // Dinis has no std dev recorded, so he is left out of the consistency ranking.
    expect(report.consistency.map((r) => [r.pilotId, r.value])).toEqual([
      ['torres', 1.802],
      ['emidio', 3.31],
    ]);
  });

  it('returns empty rankings when the timesheet has no telemetry extras', () => {
    const report = gpReport(scoreSession({ raceId: 'gp1', entries: [at('emidio', 50, 49)] }));
    expect(report.topSpeeds).toEqual([]);
    expect(report.consistency).toEqual([]);
  });
});
