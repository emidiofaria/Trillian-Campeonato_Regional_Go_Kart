import { describe, expect, it } from 'vitest';
import pilots from '../../src/data/pilots.json';
import races from '../../src/data/races.json';
import { applyResult, parseLapTime } from '../../src/lib/results-entry';
import { computeChampionship } from '../../src/lib/scoring';
import type { ResultEntry } from '../../src/lib/schemas';
import { validateSeason } from '../../src/lib/validate';

const emptySeason = () => validateSeason({ pilots, races, results: [] });

const attended = (pilotId: string, avg: number, best: number, second: number): ResultEntry => ({
  pilotId,
  attended: true,
  avgLapTime: avg,
  bestLap: best,
  secondBestLap: second,
});
const absent = (pilotId: string): ResultEntry => ({
  pilotId,
  attended: false,
  avgLapTime: null,
  bestLap: null,
  secondBestLap: null,
});

const gpEntries = [
  attended('emidio', 52.8, 51.9, 52.0),
  attended('p-queiros', 53.1, 51.5, 51.8),
  attended('joel', 53.5, 52.6, 52.7),
  absent('dinis'),
];

describe('parseLapTime', () => {
  it.each([
    ['52.341', 52.341],
    ['52,341', 52.341],
    ['0:52.341', 52.341],
    ['1:02.5', 62.5],
    [' 48 ', 48],
  ])('parses %s', (input, expected) => {
    expect(parseLapTime(input)).toBe(expected);
  });

  it.each(['', 'abc', '52.3415', '1:60.000', '0', '-52.3', '52:', '1:2:3'])(
    'rejects "%s"',
    (input) => {
      expect(parseLapTime(input)).toBeNull();
    },
  );
});

describe('applyResult', () => {
  it('marks the GP completed, promotes the next GP and updates the standings', () => {
    const updated = applyResult(emptySeason(), 'gp1', gpEntries, {
      date: '2026-03-14',
      timesheetUrl: 'https://example.com/gp1.pdf',
    });
    const byId = new Map(updated.races.map((r) => [r.id, r]));
    expect(byId.get('gp1')).toMatchObject({ status: 'completed', date: '2026-03-14' });
    expect(byId.get('gp2')?.status).toBe('next');
    expect(updated.races.filter((r) => r.status === 'next')).toHaveLength(1);

    const champ = computeChampionship(updated.pilots, updated.races, updated.results);
    expect(champ.standings.map((s) => [s.pilotId, s.total])).toEqual([
      ['p-queiros', 7],
      ['emidio', 6],
      ['joel', 2],
      ['dinis', 0],
    ]);
  });

  it('replaces existing results for the same GP', () => {
    const once = applyResult(emptySeason(), 'gp1', gpEntries);
    const twice = applyResult(once, 'gp1', [
      attended('emidio', 52, 51, 51.2),
      attended('p-queiros', 53, 52, 52.1),
      attended('joel', 54, 53, 53.1),
      attended('dinis', 55, 54, 54.1),
    ]);
    expect(twice.results).toHaveLength(1);
    expect(twice.results[0].entries.every((e) => e.attended)).toBe(true);
  });

  it('keeps results ordered by round and sets "next" to the first open GP', () => {
    const s = applyResult(applyResult(emptySeason(), 'gp3', gpEntries), 'gp1', gpEntries);
    expect(s.results.map((r) => r.raceId)).toEqual(['gp1', 'gp3']);
    expect(s.races.find((r) => r.status === 'next')?.id).toBe('gp2');
  });

  it('leaves no "next" GP when the season is complete', () => {
    let s = emptySeason();
    for (let i = 1; i <= 7; i++) s = applyResult(s, `gp${i}`, gpEntries);
    expect(s.races.every((r) => r.status === 'completed')).toBe(true);
  });

  it('rejects inconsistent entries', () => {
    expect(() =>
      applyResult(emptySeason(), 'gp1', [attended('emidio', 50, 51, 52), ...gpEntries.slice(1)]),
    ).toThrow(/melhor volta/);
    expect(() => applyResult(emptySeason(), 'gp1', gpEntries.slice(0, 3))).toThrow(/dinis/);
    expect(() => applyResult(emptySeason(), 'gp9', gpEntries)).toThrow(/inexistente/);
  });
});
