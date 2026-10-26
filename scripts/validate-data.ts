import { collectSeasonIssues } from '../src/lib/validate';
import { readRawSeason } from './season-files';

try {
  const { issues } = collectSeasonIssues(readRawSeason());
  if (issues.length) {
    console.error(`✖ Dados do campeonato inválidos:\n- ${issues.join('\n- ')}`);
    process.exit(1);
  }
  console.log('✔ Dados do campeonato válidos (pilots, races, results).');
} catch (error) {
  console.error(`✖ ${(error as Error).message}`);
  process.exit(1);
}
