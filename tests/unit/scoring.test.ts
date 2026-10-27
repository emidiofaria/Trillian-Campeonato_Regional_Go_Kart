import { describe, expect, it } from 'vitest';
import pilots from '../../src/data/pilots.json';
import races from '../../src/data/races.json';
import fixture from '../fixtures/season.json';
import {
  ABSENCE_RANKING_MODE,
  computeChampionship,
  scoreSession,
  type AbsenceRankingMode,
} from '../../src/lib/scoring';
import type { Race, RaceResult, ResultEntry } from '../../src/lib/schemas';
import { validateSeason } from '../../src/lib/validate';

const ORDER = ['emidio', 'p-queiros', 'joel', 'dinis'];

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

describe('scoreSession', () => {
  it('defaults to compact absence mode', () => {
    expect(ABSENCE_RANKING_MODE).toBe('compact');
  });

  it('normal race: ranks by average lap and awards 6/4/2/0 + VR to the winner', () => {
    const s = scoreSession(
      {
        raceId: 'gp1',
        entries: [
          at('joel', 50.3, 49.9, 50.0),
          at('emidio', 50.1, 49.5, 49.8),
          at('dinis', 51.0, 50.2, 50.4),
          at('p-queiros', 50.2, 49.7, 49.9),
        ],
      },
      ORDER,
    );
    expect(s.entries.map((e) => [e.pilotId, e.position, e.positionPoints, e.bonusPoints])).toEqual([
      ['emidio', 1, 6, 3],
      ['p-queiros', 2, 4, 0],
      ['joel', 3, 2, 0],
      ['dinis', 4, 0, 0],
    ]);
    expect(s.winnerId).toBe('emidio');
    expect(s.entries[0].totalPoints).toBe(9);
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
      ],
    });
    expect(pts).toEqual({ emidio: 6, 'p-queiros': 7, joel: 2, dinis: 0 });
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
    ],
  };

  it('absence (compact): attendees take the top positions, absent pilot scores 0', () => {
    const s = scoreSession(withAbsence, ORDER, 'compact');
    expect(s.entries.map((e) => [e.pilotId, e.position, e.positionPoints])).toEqual([
      ['emidio', 1, 6],
      ['joel', 2, 4],
      ['dinis', 3, 2],
      ['p-queiros', null, 0],
    ]);
    expect(pointsOf(withAbsence, 'compact')).toEqual({
      emidio: 6,
      joel: 7,
      dinis: 2,
      'p-queiros': 0,
    });
  });

  it('absence (fixed): the slowest attendee keeps the 4th-place 0 points', () => {
    expect(pointsOf(withAbsence, 'fixed')).toEqual({
      emidio: 6,
      joel: 7,
      dinis: 0,
      'p-queiros': 0,
    });
    // Two attendees: 6/0.
    const two: RaceResult = {
      raceId: 'gp2',
      entries: [
        at('emidio', 50, 49, 49.5),
        absent('p-queiros'),
        at('joel', 51, 50, 50.5),
        absent('dinis'),
      ],
    };
    expect(pointsOf(two, 'fixed')).toEqual({ emidio: 9, joel: 0, 'p-queiros': 0, dinis: 0 });
    expect(pointsOf(two, 'compact')).toEqual({ emidio: 9, joel: 4, 'p-queiros': 0, dinis: 0 });
  });

  it('fixed and compact are identical with full attendance', () => {
    const full: RaceResult = {
      raceId: 'gp1',
      entries: [
        at('emidio', 50.0, 49.6, 49.7),
        at('p-queiros', 50.5, 49.2, 50.1),
        at('joel', 50.8, 50.0, 50.2),
        at('dinis', 51.2, 50.4, 50.6),
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
        ],
      },
      ORDER,
    );
    expect(s.entries.map((e) => e.pilotId)).toEqual(['joel', 'p-queiros', 'dinis', 'emidio']);
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
    ]);
    for (const row of c.standings) {
      expect(row.perGp).toHaveLength(7);
      expect(row.perGp.every((cell) => cell.state === 'not-run')).toBe(true);
      expect([row.wins, row.fastestLaps, row.absences]).toEqual([0, 0, 0]);
    }
  });

  it('more wins breaks a tie on points, even against more fastest laps', () => {
    const results: RaceResult[] = [
      // GP1: emidio 6, p-queiros 4+3=7, joel 2, dinis 0
      {
        raceId: 'gp1',
        entries: [
          at('emidio', 50.0, 49.6, 49.7),
          at('p-queiros', 50.5, 49.2, 50.1),
          at('joel', 51.0, 49.8, 50.0),
          at('dinis', 51.5, 49.9, 50.2),
        ],
      },
      // GP2: emidio 6, joel 4, p-queiros 2+3=5, dinis 0
      {
        raceId: 'gp2',
        entries: [
          at('emidio', 50.0, 49.6, 49.7),
          at('p-queiros', 51.0, 49.3, 50.4),
          at('joel', 50.5, 49.7, 49.9),
          at('dinis', 51.5, 49.9, 50.2),
        ],
      },
    ];
    const c = computeChampionship(pilots, completedRaces(2), results);
    const byId = Object.fromEntries(c.standings.map((r) => [r.pilotId, r]));
    expect(byId.emidio).toMatchObject({ total: 12, wins: 2, fastestLaps: 0 });
    expect(byId['p-queiros']).toMatchObject({ total: 12, wins: 0, fastestLaps: 2 });
    expect(c.standings.map((r) => [r.pilotId, r.position])).toEqual([
      ['emidio', 1],
      ['p-queiros', 2],
      ['joel', 3],
      ['dinis', 4],
    ]);
    expect(c.leaderIds).toEqual(['emidio']);
  });

  it('more fastest laps breaks a tie on points and wins', () => {
    const results: RaceResult[] = [
      // GP1: emidio 6, p-queiros 4, joel 2+3=5, dinis 0
      {
        raceId: 'gp1',
        entries: [
          at('emidio', 50.0, 49.6, 49.7),
          at('p-queiros', 50.5, 49.7, 49.8),
          at('joel', 51.0, 49.2, 50.6),
          at('dinis', 51.5, 49.9, 50.2),
        ],
      },
      // GP2: emidio 6, p-queiros 4, dinis 2, joel 0+3=3
      {
        raceId: 'gp2',
        entries: [
          at('emidio', 50.0, 49.6, 49.7),
          at('p-queiros', 50.5, 49.7, 49.8),
          at('joel', 51.5, 49.2, 51.0),
          at('dinis', 51.0, 49.9, 50.2),
        ],
      },
    ];
    const c = computeChampionship(pilots, completedRaces(2), results);
    const byId = Object.fromEntries(c.standings.map((r) => [r.pilotId, r]));
    expect(byId.joel).toMatchObject({ total: 8, wins: 0, fastestLaps: 2 });
    expect(byId['p-queiros']).toMatchObject({ total: 8, wins: 0, fastestLaps: 0 });
    expect(c.standings.map((r) => [r.pilotId, r.position])).toEqual([
      ['emidio', 1],
      ['joel', 2],
      ['p-queiros', 3],
      ['dinis', 4],
    ]);
    expect(byId.emidio.perGp[2]).toEqual({ raceId: 'gp3', state: 'not-run' });
  });

  it('fewer absences breaks a tie on points, wins and fastest laps', () => {
    const results: RaceResult[] = [
      // GP1: emidio 9 (win+VR), joel 4, dinis 2, p-queiros absent
      {
        raceId: 'gp1',
        entries: [
          at('emidio', 50.0, 49.0, 49.5),
          absent('p-queiros'),
          at('joel', 50.5, 49.6, 49.8),
          at('dinis', 51.0, 49.7, 49.9),
        ],
      },
      // GP2: p-queiros 9 (win+VR), joel 4, dinis 2, emidio 0 (4th, attended)
      {
        raceId: 'gp2',
        entries: [
          at('emidio', 52.0, 50.5, 50.6),
          at('p-queiros', 50.0, 49.0, 49.5),
          at('joel', 50.5, 49.6, 49.8),
          at('dinis', 51.0, 49.7, 49.9),
        ],
      },
    ];
    const c = computeChampionship(pilots, completedRaces(2), results);
    const top = c.standings
      .slice(0, 2)
      .map((r) => [r.pilotId, r.total, r.wins, r.fastestLaps, r.absences]);
    expect(top).toEqual([
      ['emidio', 9, 1, 1, 0],
      ['p-queiros', 9, 1, 1, 1],
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
        ],
      },
      {
        raceId: 'gp2',
        entries: [
          at('emidio', 51, 50, 50.5),
          at('p-queiros', 50, 49, 49.5),
          absent('joel'),
          absent('dinis'),
        ],
      },
    ];
    const c = computeChampionship(pilots, completedRaces(2), results);
    expect(c.standings.slice(0, 2).map((r) => [r.pilotId, r.position, r.total])).toEqual([
      ['emidio', 1, 13],
      ['p-queiros', 1, 13],
    ]);
    expect(c.leaderIds).toEqual(['emidio', 'p-queiros']);
  });

  it('fixture season computes the expected standings', () => {
    const season = validateSeason({ pilots, races: fixture.races, results: fixture.results });
    const c = computeChampionship(season.pilots, season.races, season.results);
    expect(c.standings.map((r) => [r.pilotId, r.total, r.position])).toEqual([
      ['emidio', 16, 1],
      ['p-queiros', 13, 2],
      ['dinis', 9, 3],
      ['joel', 7, 4],
    ]);
    expect(c.completedRaces).toBe(3);
  });
});
