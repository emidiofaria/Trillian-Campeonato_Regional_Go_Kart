import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Season } from '../src/lib/validate';

const dataDir =
  process.env.KARTCUP_DATA_DIR ?? fileURLToPath(new URL('../src/data/', import.meta.url));
const file = (name: string) => `${dataDir.replace(/\/?$/, '/')}${name}.json`;

/** Folder holding pilot photos (bundled and optimised by astro:assets). */
export const pilotPhotosDir = (
  process.env.KARTCUP_PHOTOS_DIR ?? fileURLToPath(new URL('../src/assets/pilots/', import.meta.url))
).replace(/\/?$/, '/');

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

/** Pilot photos referenced in pilots.json that don't exist in the photos folder. */
export function missingPhotos(season: Pick<Season, 'pilots'>): string[] {
  return season.pilots
    .filter((p) => p.photo && !existsSync(`${pilotPhotosDir}${p.photo}`))
    .map((p) => `pilots.json [${p.id}]: foto "${p.photo}" não existe em src/assets/pilots/`);
}

export function writeSeason(season: Season): void {
  writeFileSync(file('races'), `${JSON.stringify(season.races, null, 2)}\n`);
  writeFileSync(file('results'), `${JSON.stringify(season.results, null, 2)}\n`);
}

/** Writes pilots.json formatted with the repo's Prettier config (keeps `format:check` green). */
export async function writePilots(season: Season): Promise<void> {
  const target = file('pilots');
  const compact = `[\n${season.pilots.map((p) => `  ${JSON.stringify(p)}`).join(',\n')}\n]\n`;
  const { format, resolveConfig } = await import('prettier');
  const options = (await resolveConfig(target)) ?? {};
  writeFileSync(target, await format(compact, { ...options, parser: 'json' }));
}
