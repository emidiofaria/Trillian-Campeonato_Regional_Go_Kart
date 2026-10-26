import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Season } from '../src/lib/validate';

const dataDir =
  process.env.KARTCUP_DATA_DIR ?? fileURLToPath(new URL('../src/data/', import.meta.url));
const file = (name: string) => `${dataDir.replace(/\/?$/, '/')}${name}.json`;

/** Reads the raw (unvalidated) season JSON files. Throws on malformed JSON. */
export function readRawSeason(): { pilots: unknown; races: unknown; results: unknown } {
  const read = (name: string) => {
    try {
      return JSON.parse(readFileSync(file(name), 'utf8')) as unknown;
    } catch (error) {
      throw new Error(`${name}.json: JSON inválido (${(error as Error).message})`);
    }
  };
  return { pilots: read('pilots'), races: read('races'), results: read('results') };
}

export function writeSeason(season: Season): void {
  writeFileSync(file('races'), `${JSON.stringify(season.races, null, 2)}\n`);
  writeFileSync(file('results'), `${JSON.stringify(season.results, null, 2)}\n`);
}
