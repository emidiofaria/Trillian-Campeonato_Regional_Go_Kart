export const SITE_NAME = 'Kart Cup 2026';

export const SPONSOR = {
  name: 'Trillian Driving Coach',
  websiteUrl: 'https://emidiofaria.github.io/Trillian-website/',
  playStoreUrl: 'https://play.google.com/store/apps/details?id=io.github.emidiofaria.trillian',
} as const;

export const NAV_ITEMS = [
  { id: 'classificacao', label: 'Classificação' },
  { id: 'calendario', label: 'Calendário' },
  { id: 'pilotos', label: 'Pilotos' },
  { id: 'patrocinador', label: 'Patrocinador' },
  { id: 'regulamento', label: 'Regulamento' },
] as const;

/** Prefix a public asset / internal path with the configured base path. */
export function withBase(path = ''): string {
  const base = import.meta.env.BASE_URL.replace(/\/?$/, '/');
  return `${base}${path.replace(/^\//, '')}`;
}
