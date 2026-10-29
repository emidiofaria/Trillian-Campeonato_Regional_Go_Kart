import { describe, expect, it } from 'vitest';
import pilots from '../fixtures/pilots.json';
import races from '../../src/data/races.json';
import fixture from '../fixtures/season.json';
import {
  ABSENCE_RANKING_MODE,
  computeChampionship,
  fastestLapBonus,
  positionPoints,
  scoreSession,
  type AbsenceRankingMode,
} from '../../src/lib/scoring';
import type { Race, RaceResult, ResultEntry } from '../../src/lib/schemas';
import { validateSeason } from '../../src/lib/validate';

const ORDER = ['emidio', 'p-queiros', 'joel', 'dinis', 'torres'];

const at = (pilotId: string, avg: number, best: number, second: number): ResultEntry => ({
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

const pointsOf = (result: RaceResult, mode?: AbsenceRankingMode) =>
  Object.fromEntries(
    scoreSession(result, ORDER, mode).entries.map((e) => [e.pilotId, e.totalPoints]),
  );

const completedRaces = (n: number): Race[] =>
  (races as Race[]).map((r) => ({ ...r, status: r.round <= n ? 'completed' : 'scheduled' }));

describe('points table derived from the number of pilots', () => {
  it.each([
    [2, [2, 0], 1],
    [3, [4, 2, 0], 2],
    [4, [6, 4, 2, 0], 3],
    [5, [8, 6, 4, 2, 0], 4],
    [6, [10, 8, 6, 4, 2, 0], 5],
  ])('%i pilots => %j, VR +%i', (n, table, vr) => {
    expect(positionPoints(n)).toEqual(table);
    expect(fastestLapBonus(n)).toBe(vr);
    expect(fastestLapBonus(n)).toBe(positionPoints(n)[0] / 2);
  });
});

describe('scoreSession', () => {
  it('defaults to compact absence mode', () => {
    expect(ABSENCE_RANKING_MODE).toBe('compact');
  });

  it('normal race: ranks by average lap and awards 8/6/4/2/0 + VR to the winner', () => {
    const s = scoreSession(
      {
        raceId: 'gp1',
        entries: [
          at('joel', 50.3, 49.9, 50.0),
          at('emidio', 50.1, 49.5, 49.8),
          at('dinis', 51.0, 50.2, 50.4),
          at('torres', 51.5, 50.5, 50.7),
          at('p-queiros', 50.2, 49.7, 49.9),
        ],
      },
      ORDER,
    );
    expect(s.entries.map((e) => [e.pilotId, e.position, e.positionPoints, e.bonusPoints])).toEqual([
      ['emidio', 1, 8, 4],
      ['p-queiros', 2, 6, 0],
      ['joel', 3, 4, 0],
      ['dinis', 4, 2, 0],
      ['torres', 5, 0, 0],
    ]);
    expect(s.winnerId).toBe('emidio');
    expect(s.entries[0].totalPoints).toBe(12);
    expect(s.fastestLapPilotIds).toEqual(['emidio']);
    expect(s.fastestLapTime).toBe(49.5);
  });

  it('fastest-lap bonus goes to a non-winner', () => {
    const pts = pointsOf({
      raceId: 'gp1',
      entries: [
        at('emidio', 50.0, 49.6, 49.7),
        at('p-queiros', 50.5, 49.2, 50.1),
        at('joel', 50.8, 50.0, 50.2),
        at('dinis', 51.2, 50.4, 50.6),
        at('torres', 51.6, 50.6, 50.8),
      ],
    });
    expect(pts).toEqual({ emidio: 8, 'p-queiros': 10, joel: 4, dinis: 2, torres: 0 });
  });

  it('awards the VR bonus to every pilot sharing the exact fastest lap', () => {
    const s = scoreSession({
      raceId: 'gp1',
      entries: [at('emidio', 50.0, 49.5, 49.7), at('joel', 50.4, 49.5, 49.6)],
    });
    expect(s.fastestLapPilotIds.sort()).toEqual(['emidio', 'joel']);
  });

  const withAbsence: RaceResult = {
    raceId: 'gp2',
    entries: [
      at('emidio', 50.0, 49.6, 49.7),
      absent('p-queiros'),
      at('joel', 50.5, 49.4, 49.9),
      at('dinis', 51.0, 50.1, 50.3),
      at('torres', 51.5, 50.5, 50.7),
    ],
  };

  it('absence (compact): attendees take the top positions, absent pilot scores 0', () => {
    const s = scoreSession(withAbsence, ORDER, 'compact');
    expect(s.entries.map((e) => [e.pilotId, e.position, e.positionPoints])).toEqual([
      ['emidio', 1, 8],
      ['joel', 2, 6],
      ['dinis', 3, 4],
      ['torres', 4, 2],
      ['p-queiros', null, 0],
    ]);
    expect(pointsOf(withAbsence, 'compact')).toEqual({
      emidio: 8,
      joel: 10,
      dinis: 4,
      torres: 2,
      'p-queiros': 0,
    });
  });

  it('absence (fixed): the slowest attendee keeps the last-place 0 points', () => {
    expect(pointsOf(withAbsence, 'fixed')).toEqual({
      emidio: 8,
      joel: 10,
      dinis: 4,
      torres: 0,
      'p-queiros': 0,
    });
    // Two attendees: 8/0.
    const two: RaceResult = {
      raceId: 'gp2',
      entries: [
        at('emidio', 50, 49, 49.5),
        absent('p-queiros'),
        at('joel', 51, 50, 50.5),
        absent('dinis'),
        absent('torres'),
      ],
    };
    expect(pointsOf(two, 'fixed')).toEqual({
      emidio: 12,
      joel: 0,
      'p-queiros': 0,
      dinis: 0,
      torres: 0,
    });
    expect(pointsOf(two, 'compact')).toEqual({
      emidio: 12,
      joel: 6,
      'p-queiros': 0,
      dinis: 0,
      torres: 0,
    });
  });

  it('fixed and compact are identical with full attendance', () => {
    const full: RaceResult = {
      raceId: 'gp1',
      entries: [
        at('emidio', 50.0, 49.6, 49.7),
        at('p-queiros', 50.5, 49.2, 50.1),
        at('joel', 50.8, 50.0, 50.2),
        at('dinis', 51.2, 50.4, 50.6),
        at('torres', 51.6, 50.6, 50.8),
      ],
    };
    expect(pointsOf(full, 'fixed')).toEqual(pointsOf(full, 'compact'));
  });

  it('session tie on average: better best lap, then better second-best lap', () => {
    const s = scoreSession(
      {
        raceId: 'gp3',
        entries: [
          at('emidio', 50.0, 49.5, 49.9),
          at('p-queiros', 50.0, 49.5, 49.7),
          at('joel', 50.0, 49.3, 49.95),
          at('dinis', 50.0, 49.5, 49.8),
          at('torres', 50.0, 49.5, 49.85),
        ],
      },
      ORDER,
    );
    expect(s.entries.map((e) => e.pilotId)).toEqual([
      'joel',
      'p-queiros',
      'dinis',
      'torres',
      'emidio',
    ]);
  });
});

describe('computeChampionship', () => {
  it('empty season: everyone on zero, no leader, all GPs not run, no crash', () => {
    const c = computeChampionship(pilots, races as Race[], []);
    expect(c.completedRaces).toBe(0);
    expect(c.leaderIds).toEqual([]);
    expect(c.sessions).toEqual([]);
    expect(c.standings.map((r) => [r.pilotId, r.position, r.total])).toEqual([
      ['emidio', 1, 0],
      ['p-queiros', 1, 0],
      ['joel', 1, 0],
      ['dinis', 1, 0],
      ['torres', 1, 0],
    ]);
    for (const row of c.standings) {
      expect(row.perGp).toHaveLength(7);
      expect(row.perGp.every((cell) => cell.state === 'not-run')).toBe(true);
      expect([row.wins, row.fastestLaps, row.absences]).toEqual([0, 0, 0]);
    }
  });

  it('more wins breaks a tie on points, even against more fastest laps', () => {
    // Both GPs: emidio 8, joel 6, p-queiros 4+4=8, dinis 2, torres 0
    const gp = (raceId: string): RaceResult => ({
      raceId,
      entries: [
        at('emidio', 50.0, 49.6, 49.7),
        at('joel', 50.5, 49.7, 49.9),
        at('p-queiros', 51.0, 49.2, 50.4),
        at('dinis', 51.5, 49.9, 50.2),
        at('torres', 52.0, 50.0, 50.3),
      ],
    });
    const c = computeChampionship(pilots, completedRaces(2), [gp('gp1'), gp('gp2')]);
    const byId = Object.fromEntries(c.standings.map((r) => [r.pilotId, r]));
    expect(byId.emidio).toMatchObject({ total: 16, wins: 2, fastestLaps: 0 });
    expect(byId['p-queiros']).toMatchObject({ total: 16, wins: 0, fastestLaps: 2 });
    expect(c.standings.map((r) => [r.pilotId, r.position])).toEqual([
      ['emidio', 1],
      ['p-queiros', 2],
      ['joel', 3],
      ['dinis', 4],
      ['torres', 5],
    ]);
    expect(c.leaderIds).toEqual(['emidio']);
  });

  it('more fastest laps breaks a tie on points and wins', () => {
    const results: RaceResult[] = [
      // GP1: emidio 8, p-queiros 6, joel 4+4=8, dinis 2, torres 0
      {
        raceId: 'gp1',
        entries: [
          at('emidio', 50.0, 49.6, 49.7),
          at('p-queiros', 50.5, 49.7, 49.8),
          at('joel', 51.0, 49.2, 50.6),
          at('dinis', 51.5, 49.9, 50.2),
          at('torres', 52.0, 50.0, 50.3),
        ],
      },
      // GP2: emidio 8, p-queiros 6, dinis 4, torres 2, joel 0+4=4
      {
        raceId: 'gp2',
        entries: [
          at('emidio', 50.0, 49.6, 49.7),
          at('p-queiros', 50.5, 49.7, 49.8),
          at('joel', 52.0, 49.2, 51.5),
          at('dinis', 51.0, 49.9, 50.2),
          at('torres', 51.5, 50.0, 50.3),
        ],
      },
    ];
    const c = computeChampionship(pilots, completedRaces(2), results);
    const byId = Object.fromEntries(c.standings.map((r) => [r.pilotId, r]));
    expect(byId.joel).toMatchObject({ total: 12, wins: 0, fastestLaps: 2 });
    expect(byId['p-queiros']).toMatchObject({ total: 12, wins: 0, fastestLaps: 0 });
    expect(c.standings.map((r) => [r.pilotId, r.position])).toEqual([
      ['emidio', 1],
      ['joel', 2],
      ['p-queiros', 3],
      ['dinis', 4],
      ['torres', 5],
    ]);
    expect(byId.emidio.perGp[2]).toEqual({ raceId: 'gp3', state: 'not-run' });
  });

  it('fewer absences breaks a tie on points, wins and fastest laps', () => {
    const results: RaceResult[] = [
      // GP1: emidio 12 (win+VR), joel 6, dinis 4, torres 2, p-queiros absent
      {
        raceId: 'gp1',
        entries: [
          at('emidio', 50.0, 49.0, 49.5),
          absent('p-queiros'),
          at('joel', 50.5, 49.6, 49.8),
          at('dinis', 51.0, 49.7, 49.9),
          at('torres', 51.5, 49.8, 50.0),
        ],
      },
      // GP2: p-queiros 12 (win+VR), joel 6, dinis 4, torres 2, emidio 0 (5th, attended)
      {
        raceId: 'gp2',
        entries: [
          at('emidio', 52.0, 50.5, 50.6),
          at('p-queiros', 50.0, 49.0, 49.5),
          at('joel', 50.5, 49.6, 49.8),
          at('dinis', 51.0, 49.7, 49.9),
          at('torres', 51.5, 49.8, 50.0),
        ],
      },
    ];
    const c = computeChampionship(pilots, completedRaces(2), results);
    const top = c.standings
      .slice(0, 2)
      .map((r) => [r.pilotId, r.total, r.wins, r.fastestLaps, r.absences]);
    expect(top).toEqual([
      ['emidio', 12, 1, 1, 0],
      ['p-queiros', 12, 1, 1, 1],
    ]);
    expect(c.standings[1].position).toBe(2);
    const pq = c.standings.find((r) => r.pilotId === 'p-queiros');
    expect(pq?.perGp[0]).toEqual({ raceId: 'gp1', state: 'absent', points: 0 });
  });

  it('pilots tied on every criterion share the position and the lead', () => {
    const results: RaceResult[] = [
      {
        raceId: 'gp1',
        entries: [
          at('emidio', 50, 49, 49.5),
          at('p-queiros', 51, 50, 50.5),
          absent('joel'),
          absent('dinis'),
          absent('torres'),
        ],
      },
      {
        raceId: 'gp2',
        entries: [
          at('emidio', 51, 50, 50.5),
          at('p-queiros', 50, 49, 49.5),
          absent('joel'),
          absent('dinis'),
          absent('torres'),
        ],
      },
    ];
    const c = computeChampionship(pilots, completedRaces(2), results);
    expect(c.standings.slice(0, 2).map((r) => [r.pilotId, r.position, r.total])).toEqual([
      ['emidio', 1, 18],
      ['p-queiros', 1, 18],
    ]);
    expect(c.leaderIds).toEqual(['emidio', 'p-queiros']);
  });

  it('fixture season computes the expected standings', () => {
    const season = validateSeason({ pilots, races: fixture.races, results: fixture.results });
    const c = computeChampionship(season.pilots, season.races, season.results);
    expect(c.standings.map((r) => [r.pilotId, r.total, r.position])).toEqual([
      ['emidio', 22, 1],
      ['p-queiros', 20, 2],
      ['dinis', 16, 3],
      ['joel', 12, 4],
      ['torres', 2, 5],
    ]);
    expect(c.completedRaces).toBe(3);
  });

  it('a GP keeps the points table of the pilot count it was run with', () => {
    const gp: RaceResult = {
      raceId: 'gp1',
      pilotCount: 4,
      entries: [
        at('emidio', 50.0, 49.0, 49.5),
        at('p-queiros', 50.5, 49.6, 49.8),
        at('joel', 51.0, 49.7, 49.9),
        at('dinis', 51.5, 49.8, 50.0),
        absent('torres'),
      ],
    };
    expect(pointsOf(gp)).toEqual({ emidio: 9, 'p-queiros': 4, joel: 2, dinis: 0, torres: 0 });
    expect(pointsOf({ ...gp, pilotCount: undefined })).toEqual({
      emidio: 12,
      'p-queiros': 6,
      joel: 4,
      dinis: 2,
      torres: 0,
    });
  });
});
