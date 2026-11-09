import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import prodPilots from '../../src/data/pilots.json';
import prodResults from '../../src/data/results.json';
import { importReport, matchPilots, nameMatches } from '../../src/lib/gp-import';
import type { Pilot } from '../../src/lib/schemas';

const pilots = prodPilots as Pilot[];
const gp1Report = readFileSync(new URL('../../docs/results/gp1.md', import.meta.url), 'utf8');

describe('nameMatches', () => {
  it.each([
    ['Emidio', 'Emídio', true],
    ['Andre Torres', 'Torres', true],
    ['Pedro Oliveira', 'P. Oliveira', true],
    ['PEDRO QUEIROS', 'P. Queirós', true],
    ['Pedro Oliveira', 'P. Queirós', false],
    ['Rui Oliveira', 'P. Oliveira', false],
    ['TOMAS', 'Torres', false],
  ])('%s vs %s → %s', (report, pilot, expected) => {
    expect(nameMatches(report, pilot)).toBe(expected);
  });
});

describe('matchPilots', () => {
  it('ignores unknown names and honours overrides', () => {
    const { matched, ignored } = matchPilots(['Tomas', 'Joel Silva', 'Zé'], pilots, {
      Zé: 'dinis',
      'Joel Silva': 'ignore',
    });
    expect([...matched]).toEqual([['Zé', 'dinis']]);
    expect(ignored).toEqual(['Tomas', 'Joel Silva']);
  });

  it('rejects two names mapping to the same pilot', () => {
    expect(() => matchPilots(['Andre Torres', 'Rui Torres'], pilots)).toThrow(/ambos/);
  });
});

describe('importReport', () => {
  it('reproduces the stored GP1 results from the archived report', () => {
    const gp1 = importReport(gp1Report, pilots);
    expect(gp1.mismatches).toEqual([]);
    expect(gp1.session).toBe('23');
    const stored = prodResults.find((r) => r.raceId === 'gp1')!;
    const byId = (es: { pilotId: string }[]) =>
      [...es].sort((a, b) => a.pilotId.localeCompare(b.pilotId));
    expect(byId(gp1.entries)).toEqual(byId(stored.entries));
  });

  it('marks registered pilots missing from the report as absent', () => {
    const withoutJoel = gp1Report
      .split('\n')
      .filter((l) => !/\|\s*Joel\s*\|/.test(l))
      .join('\n');
    const gp = importReport(withoutJoel, pilots);
    expect(gp.entries.find((e) => e.pilotId === 'joel')).toMatchObject({ attended: false });
    expect(gp.mismatches).toEqual([]);
  });

  it('reports points mismatches against the rules', () => {
    const wrong = gp1Report
      .replace('| 2 | Andre Torres | 8 |  | 8 |', '| 2 | Andre Torres | 9 |  | 9 |')
      .replace('| 1 | Emidio | 15 | 1 | 15 |', '| 1 | Emidio | 10 |  | 10 |');
    const { mismatches } = importReport(wrong, pilots);
    expect(mismatches).toContain('Andre Torres: relatório 9 pts, regulamento 8 pts');
    expect(mismatches).toContain('Emidio: relatório 10 pts, regulamento 15 pts');
  });

  it('requires the mean time and fastest lap tables', () => {
    expect(() =>
      importReport('## 4. Top speed\n\n| Pilot | Top speed |\n|--|--|\n| Joel | 47 |', pilots),
    ).toThrow(/Best mean time/);
  });
});
