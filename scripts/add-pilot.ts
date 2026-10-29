/**
 * Registers a new pilot.
 *
 *   npm run add-pilot                                    # interactive
 *   npm run add-pilot -- --name "Torres" --color "#34d399" --yes
 *   npm run add-pilot -- --name "Ana Sousa" --photo ~/ana.jpg [--color "#f472b6"] [--initials AS] --yes
 *
 * Writes src/data/pilots.json (and results.json if GPs were already run: the newcomer is recorded
 * as absent and those GPs keep the points table they had). Photos are centre-cropped to a 512px
 * square WebP in src/assets/pilots/<id>.webp.
 */
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { homedir } from 'node:os';
import { parseArgs } from 'node:util';
import * as p from '@clack/prompts';
import {
  addPilot,
  checkNewPilot,
  defaultInitials,
  normaliseHex,
  slugifyId,
  suggestColour,
  SUGGESTED_COLOURS,
  type NewPilotInput,
} from '../src/lib/pilot-entry';
import { isAvatarColourAccessible } from '../src/lib/colour';
import { MAX_PILOTS } from '../src/lib/schemas';
import { fastestLapBonus, positionPoints } from '../src/lib/scoring';
import { validateSeason, type Season } from '../src/lib/validate';
import { pilotPhotosDir, readRawSeason, writePilots, writeSeason } from './season-files';

const PHOTO_EXT = /\.(jpe?g|png|webp|avif)$/i;

const { values: args } = parseArgs({
  options: {
    name: { type: 'string' },
    color: { type: 'string' },
    photo: { type: 'string' },
    initials: { type: 'string' },
    yes: { type: 'boolean', short: 'y', default: false },
  },
});

const expandHome = (path: string) => resolve(path.replace(/^~(?=$|\/)/, homedir()));

function fail(message: string): never {
  console.error(`✖ ${message}`);
  process.exit(1);
}

function cancelled<T>(value: T | symbol): T {
  if (p.isCancel(value)) {
    p.cancel('Operação cancelada. Nada foi gravado.');
    process.exit(0);
  }
  return value as T;
}

function photoProblem(path: string): string | undefined {
  if (!PHOTO_EXT.test(path)) return 'Formato não suportado (usa jpg, png, webp ou avif).';
  if (!existsSync(expandHome(path))) return `Ficheiro não encontrado: ${path}`;
  return undefined;
}

/** Centre-crops the photo to a 512×512 WebP (falls back to a plain copy without sharp). */
async function importPhoto(source: string, id: string): Promise<string> {
  mkdirSync(pilotPhotosDir, { recursive: true });
  try {
    const { default: sharp } = await import('sharp');
    const target = `${id}.webp`;
    await sharp(expandHome(source))
      .rotate()
      .resize(512, 512, { fit: 'cover', position: 'attention' })
      .webp({ quality: 85 })
      .toFile(`${pilotPhotosDir}${target}`);
    return target;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ERR_MODULE_NOT_FOUND') throw error;
    const target = `${id}${extname(source).toLowerCase().replace('.jpeg', '.jpg')}`;
    copyFileSync(expandHome(source), `${pilotPhotosDir}${target}`);
    return target;
  }
}

async function askInteractively(season: Season): Promise<{ input: NewPilotInput; photo?: string }> {
  const suggested = suggestColour(season.pilots);
  const name = cancelled(
    await p.text({
      message: 'Nome do piloto',
      placeholder: 'ex.: Torres',
      validate: (v) =>
        checkNewPilot(season.pilots, { name: v ?? '', color: suggested }).find((m) =>
          /nome|piloto/i.test(m),
        ),
    }),
  ).trim();

  const initials = cancelled(
    await p.text({
      message: 'Iniciais (avatar sem foto)',
      initialValue: defaultInitials(name),
      validate: (v) => (v && v.trim().length <= 3 ? undefined : '1 a 3 caracteres.'),
    }),
  ).trim();

  const kind = cancelled(
    await p.select({
      message: 'Avatar',
      options: [
        { value: 'colour', label: 'Cor (círculo com iniciais)' },
        { value: 'photo', label: 'Fotografia (com anel na cor do piloto)' },
      ],
    }),
  );

  let photo: string | undefined;
  if (kind === 'photo') {
    photo = cancelled(
      await p.text({
        message: 'Caminho para a fotografia (jpg, png, webp, avif; idealmente quadrada ≥ 256px)',
        validate: (v) => photoProblem(v ?? ''),
      }),
    ).trim();
  }

  const used = new Set(season.pilots.map((x) => x.color.toLowerCase()));
  const options = SUGGESTED_COLOURS.filter((c) => !used.has(c)).map((c) => ({
    value: c as string,
    label: c,
  }));
  let color = cancelled(
    await p.select({
      message: kind === 'photo' ? 'Cor do anel / destaques' : 'Cor do avatar',
      initialValue: suggested,
      options: [...options, { value: 'custom', label: 'Outra (#rrggbb)…' }],
    }),
  );
  if (color === 'custom') {
    color = cancelled(
      await p.text({
        message: 'Cor (#rrggbb)',
        validate: (v) => {
          const hex = normaliseHex(v ?? '');
          if (!hex) return 'Usa o formato #rrggbb.';
          if (used.has(hex)) return 'Cor já usada por outro piloto.';
          if (!isAvatarColourAccessible(hex)) return 'Cor demasiado escura (contraste AA).';
          return undefined;
        },
      }),
    );
  }
  return { input: { name, initials, color }, photo };
}

async function main() {
  let season: Season;
  try {
    season = validateSeason(readRawSeason());
  } catch (error) {
    fail(`Os dados atuais são inválidos. Corrige-os primeiro.\n${(error as Error).message}`);
  }
  if (season.pilots.length >= MAX_PILOTS) fail(`Limite de ${MAX_PILOTS} pilotos atingido.`);

  const interactive = !args.name;
  if (interactive) p.intro('Kart Cup 2026 · Inscrever piloto');

  const { input, photo } = interactive
    ? await askInteractively(season)
    : {
        input: {
          name: args.name!,
          initials: args.initials,
          color: args.color ?? suggestColour(season.pilots),
        },
        photo: args.photo,
      };

  if (photo) {
    const problem = photoProblem(photo);
    if (problem) fail(problem);
  }
  const problems = checkNewPilot(season.pilots, input);
  if (problems.length) fail(`Piloto inválido:\n- ${problems.join('\n- ')}`);

  const id = slugifyId(input.name);
  const n = season.pilots.length + 1;
  const summary = [
    `Piloto: #${n} ${input.name.trim()} (id "${id}", iniciais ${(input.initials ?? defaultInitials(input.name)).toUpperCase()})`,
    `Avatar: ${photo ? `foto ${photo} → src/assets/pilots/` : 'iniciais'} · cor ${normaliseHex(input.color)}`,
    `Pontos por GP (${n} pilotos): ${positionPoints(n).join(' / ')} · VR +${fastestLapBonus(n)}`,
    season.results.length
      ? `GP já realizados (${season.results.map((r) => r.raceId.toUpperCase()).join(', ')}): ${input.name.trim()} fica com falta (0 pts); esses GP mantêm a pontuação com que foram disputados.`
      : 'Nenhum GP realizado: nada a ajustar nos resultados.',
  ].join('\n');

  if (interactive) {
    p.note(summary, 'Resumo');
    const ok = cancelled(await p.confirm({ message: 'Gravar?' }));
    if (!ok) {
      p.cancel('Nada foi gravado.');
      return;
    }
  } else {
    console.log(summary);
    if (!args.yes) fail('Revê o resumo e repete com --yes para gravar.');
  }

  const photoFile = photo ? await importPhoto(photo, id) : undefined;
  let outcome;
  try {
    outcome = addPilot(season, { ...input, photo: photoFile });
  } catch (error) {
    fail((error as Error).message);
  }
  await writePilots(outcome.season);
  if (outcome.absentRaceIds.length) writeSeason(outcome.season);

  const done = `✔ ${outcome.pilot.name} inscrito como #${outcome.pilot.number}. Ficheiros: src/data/pilots.json${
    outcome.absentRaceIds.length ? ', src/data/results.json' : ''
  }${photoFile ? `, src/assets/pilots/${photoFile}` : ''}`;
  if (interactive) p.outro(done);
  else console.log(done);
}

main().catch((error) => fail((error as Error).message));
