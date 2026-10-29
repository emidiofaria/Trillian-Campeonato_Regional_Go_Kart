import { describe, expect, it } from 'vitest';
import pilots from '../fixtures/pilots.json';
import races from '../../src/data/races.json';
import {
  addPilot,
  checkNewPilot,
  defaultInitials,
  nextNumber,
  normaliseHex,
  slugifyId,
  suggestColour,
  SUGGESTED_COLOURS,
} from '../../src/lib/pilot-entry';
import { isAvatarColourAccessible } from '../../src/lib/colour';
import { applyResult } from '../../src/lib/results-entry';
import { computeChampionship } from '../../src/lib/scoring';
import type { ResultEntry } from '../../src/lib/schemas';
import { validateSeason } from '../../src/lib/validate';

const emptySeason = () => validateSeason({ pilots, races, results: [] });
const at = (pilotId: string, avg: number, best: number, second: number): ResultEntry => ({
  pilotId,
  attended: true,
  avgLapTime: avg,
  bestLap: best,
  secondBestLap: second,
});

describe('pilot-entry helpers', () => {
  it.each([
    ['Torres', 'torres', 'TO'],
    ['P. Queirós', 'p-queiros', 'PQ'],
    ['Ana Rita Sousa', 'ana-rita-sousa', 'AS'],
    ['  João  ', 'joao', 'JO'],
  ])('%s => id %s, initials %s', (name, id, initials) => {
    expect(slugifyId(name)).toBe(id);
    expect(defaultInitials(name)).toBe(initials);
  });

  it('normalises hex colours', () => {
    expect(normaliseHex('34D399')).toBe('#34d399');
    expect(normaliseHex('#abc')).toBe('#aabbcc');
    expect(normaliseHex('green')).toBeNull();
  });

  it('suggests the next unused, accessible colour and number', () => {
    expect(nextNumber(pilots)).toBe(6);
    const colour = suggestColour(pilots);
    expect(pilots.map((p) => p.color)).not.toContain(colour);
    expect(SUGGESTED_COLOURS.every(isAvatarColourAccessible)).toBe(true);
  });

  it('reports invalid input', () => {
    const problems = checkNewPilot(pilots, { name: 'joel', color: '#000000', initials: 'ABCD' });
    expect(problems.join('\n')).toMatch(/id "joel"/);
    expect(problems.join('\n')).toMatch(/contraste/);
    expect(problems.join('\n')).toMatch(/iniciais/i);
    expect(checkNewPilot(pilots, { name: 'Rui', color: pilots[0].color })).toHaveLength(1);
  });
});

describe('addPilot', () => {
  it('before the season: appends the pilot and widens the points table', () => {
    const { season, pilot, absentRaceIds } = addPilot(emptySeason(), {
      name: 'Ana Sousa',
      color: '#F472B6',
      photo: 'ana-sousa.webp',
    });
    expect(pilot).toEqual({
      id: 'ana-sousa',
      name: 'Ana Sousa',
      number: 6,
      color: '#f472b6',
      initials: 'AS',
      photo: 'ana-sousa.webp',
    });
    expect(absentRaceIds).toEqual([]);
    expect(season.pilots).toHaveLength(6);

    const all = [...season.pilots.map((p, i) => at(p.id, 50 + i, 49 + i, 49.5 + i))];
    const after = applyResult(season, 'gp1', all);
    const c = computeChampionship(after.pilots, after.races, after.results);
    expect(c.standings.map((r) => r.total)).toEqual([15, 8, 6, 4, 2, 0]);
  });

  it('mid-season: newcomer is absent in past GPs, which keep their points table', () => {
    const fivePilotGp = pilots.map((p, i) => at(p.id, 50 + i, 49 + i, 49.5 + i));
    const before = applyResult(emptySeason(), 'gp1', fivePilotGp);
    const { season, absentRaceIds } = addPilot(before, { name: 'Rui', color: '#2dd4bf' });

    expect(absentRaceIds).toEqual(['gp1']);
    expect(season.results[0].pilotCount).toBe(5);
    expect(season.results[0].entries.find((e) => e.pilotId === 'rui')).toMatchObject({
      attended: false,
    });
    const c = computeChampionship(season.pilots, season.races, season.results);
    const byId = Object.fromEntries(c.standings.map((r) => [r.pilotId, r]));
    expect(byId.emidio.total).toBe(12); // 8 + 4, unchanged by the newcomer
    expect(byId.rui).toMatchObject({ total: 0, absences: 1 });
  });

  it('a legacy result without pilotCount is frozen at its entry count', () => {
    const legacy = validateSeason({
      pilots,
      races: races.map((r) => ({
        ...r,
        status: r.id === 'gp1' ? 'completed' : r.id === 'gp2' ? 'next' : 'scheduled',
      })),
      results: [
        { raceId: 'gp1', entries: pilots.map((p, i) => at(p.id, 50 + i, 49 + i, 49.5 + i)) },
      ],
    });
    const { season } = addPilot(legacy, { name: 'Rui', color: '#2dd4bf' });
    expect(season.results[0].pilotCount).toBe(5);
  });

  it('throws on duplicates', () => {
    expect(() => addPilot(emptySeason(), { name: 'Torres', color: '#2dd4bf' })).toThrow(/Torres/);
  });
});
