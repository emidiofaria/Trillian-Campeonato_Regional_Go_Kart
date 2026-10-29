import { readFileSync } from 'node:fs';

/** True when the site under test was built with tests/fixtures/season.json. */
export const FIXTURE = process.env.KARTCUP_FIXTURE === '1';

interface PilotData {
  id: string;
  name: string;
  number: number;
}

const read = <T>(path: string): T =>
  JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8')) as T;

/** Pilots the site under test was built with (production data or the fixture), by number. */
export const pilots: PilotData[] = (
  FIXTURE
    ? read<{ pilots: PilotData[] }>('../fixtures/season.json').pilots
    : read<PilotData[]>('../../src/data/pilots.json')
).sort((a, b) => a.number - b.number);

/** Points table for the current pilot count: 2×(N−1)…0, VR = N−1 (docs/rules.md section 5). */
export const N = pilots.length;
export const positionPoints = Array.from({ length: N }, (_, i) => 2 * (N - 1 - i));
export const vrBonus = N - 1;
