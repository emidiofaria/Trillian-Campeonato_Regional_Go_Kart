import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import * as p from '@clack/prompts';
import { importReport } from '../src/lib/gp-import';
import { formatLap } from '../src/lib/format';
import { applyResult } from '../src/lib/results-entry';
import { computeChampionship, startGrid } from '../src/lib/scoring';
import { validateSeason } from '../src/lib/validate';
import { readRawSeason, writeSeason } from './season-files';

const USAGE = `Uso: npm run import-gp -- --race gpN --date AAAA-MM-DD [opções] <relatorio.md | ->

  --race gpN          GP a que pertencem os resultados (obrigatório)
  --date AAAA-MM-DD   data do GP (obrigatório se o GP ainda não tiver data)
  --timesheet URL     link para a folha de tempos oficial (opcional)
  --map "Nome=id"     força a correspondência de um nome (ou "Nome=ignore"); repetível
  --replace           substitui resultados já existentes desse GP
  --dry-run           só mostra a pré-visualização, não grava nada
  --yes               grava sem perguntar
  -                   lê o relatório do stdin`;

const archiveDir = (
  process.env.KARTCUP_RESULTS_DIR ?? fileURLToPath(new URL('../docs/results/', import.meta.url))
).replace(/\/?$/, '/');

function fail(message: string): never {
  p.cancel(message);
  process.exit(1);
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      race: { type: 'string' },
      date: { type: 'string' },
      timesheet: { type: 'string' },
      map: { type: 'string', multiple: true },
      replace: { type: 'boolean' },
      'dry-run': { type: 'boolean' },
      yes: { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
    },
  });
  if (values.help) {
    console.log(USAGE);
    return;
  }
  p.intro('Kart Cup 2026 · Importar resultados de um GP');

  const source = positionals[0];
  if (!source || !values.race) fail(`Faltam argumentos.\n\n${USAGE}`);
  const md = source === '-' ? readFileSync(0, 'utf8') : readFileSync(source, 'utf8');

  const season = validateSeason(readRawSeason());
  const race = season.races.find((r) => r.id === values.race);
  if (!race) fail(`GP inexistente: ${values.race}`);
  if (values.date && !/^\d{4}-\d{2}-\d{2}$/.test(values.date))
    fail(`Data inválida "${values.date}" (usa AAAA-MM-DD).`);
  if (!values.date && !race.date) fail(`O GP${race.round} não tem data: usa --date AAAA-MM-DD.`);
  if (season.results.some((r) => r.raceId === race.id) && !values.replace)
    fail(`O GP${race.round} já tem resultados. Usa --replace para os substituir.`);

  const overrides = Object.fromEntries(
    (values.map ?? []).map((m) => {
      const i = m.lastIndexOf('=');
      if (i < 1) fail(`--map inválido "${m}" (usa "Nome=id").`);
      return [m.slice(0, i).trim(), m.slice(i + 1).trim()];
    }),
  );

  let imported;
  try {
    imported = importReport(md, season.pilots, overrides);
  } catch (error) {
    fail((error as Error).message);
  }

  const name = (id: string) => season.pilots.find((x) => x.id === id)!.name;
  p.note(
    [
      ...[...imported.matched].map(([from, id]) => `${from} → ${name(id)}`),
      ...imported.ignored.map((n) => `${n} → ignorado (não está no campeonato)`),
    ].join('\n'),
    'Correspondência de pilotos',
  );
  p.note(
    imported.scored.entries
      .map((e) =>
        e.attended
          ? `${e.position}.º ${name(e.pilotId)} · média ${formatLap(e.avgLapTime)} · melhor ${formatLap(e.bestLap)} · ${e.totalPoints} pts (${e.positionPoints} + ${e.lapPoints})${e.fastestLap ? ' VR' : ''}`
          : `F  ${name(e.pilotId)} · falta · 0 pts`,
      )
      .join('\n'),
    `GP${race.round} · ${race.circuit}${imported.session ? ` · sessão ${imported.session}` : ''}`,
  );

  if (imported.mismatches.length) {
    fail(
      `O relatório não bate certo com o regulamento — nada foi gravado:\n- ${imported.mismatches.join('\n- ')}`,
    );
  }

  let updated;
  try {
    updated = applyResult(season, race.id, imported.entries, {
      date: values.date,
      timesheetUrl: values.timesheet,
      session: imported.session ?? undefined,
    });
  } catch (error) {
    fail((error as Error).message);
  }

  const champ = computeChampionship(updated.pilots, updated.races, updated.results);
  p.note(
    champ.standings.map((r) => `${r.position}.º ${name(r.pilotId)} · ${r.total} pts`).join('\n'),
    'Classificação geral',
  );
  p.note(
    startGrid(champ)
      .map((id, i) => `${i + 1}.º ${name(id)}`)
      .join('\n'),
    'Grelha de partida do próximo GP (invertida)',
  );

  if (values['dry-run']) {
    p.outro('Pré-visualização (--dry-run): nada foi gravado.');
    return;
  }
  if (!values.yes) {
    const save = await p.confirm({ message: 'Gravar?', initialValue: true });
    if (p.isCancel(save) || !save) {
      p.cancel('Nada foi gravado.');
      return;
    }
  }

  writeSeason(updated);
  mkdirSync(archiveDir, { recursive: true });
  const archived = `${archiveDir}${race.id}.md`;
  writeFileSync(archived, md.endsWith('\n') ? md : `${md}\n`);

  const next = updated.races.find((r) => r.status === 'next');
  p.outro(
    `Gravado: src/data/results.json, src/data/races.json e ${relative(process.cwd(), archived)}. ` +
      (next ? `Próximo GP: GP${next.round} · ${next.circuit}.` : 'Temporada concluída!'),
  );
}

main().catch((error) => fail((error as Error).message));
