/** Background behind avatar initials (the initials use the page background colour). */
export const AVATAR_TEXT_COLOUR = '#0d1117';
/** WCAG AA for normal text. */
export const MIN_AVATAR_CONTRAST = 4.5;

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two #rrggbb colours (1–21). */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** True if dark initials on this avatar colour meet WCAG AA. */
export function isAvatarColourAccessible(colour: string): boolean {
  return contrastRatio(colour, AVATAR_TEXT_COLOUR) >= MIN_AVATAR_CONTRAST;
}
