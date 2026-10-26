import defaultTheme from 'tailwindcss/defaultTheme';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        elevated: 'var(--elevated)',
        border: { DEFAULT: 'var(--border)', strong: 'var(--border-strong)' },
        fg: { DEFAULT: 'var(--text)', muted: 'var(--text-muted)' },
        brand: {
          blue: 'var(--brand-blue)',
          'blue-text': 'var(--brand-blue-text)',
          yellow: 'var(--brand-yellow)',
          green: 'var(--brand-green)',
          'green-strong': 'var(--brand-green-strong)',
          'green-text': 'var(--brand-green-text)',
          ring: 'var(--brand-ring)',
        },
      },
      fontFamily: {
        sans: ['"Inter Variable"', ...defaultTheme.fontFamily.sans],
        display: ['"Barlow Condensed"', '"Inter Variable"', ...defaultTheme.fontFamily.sans],
      },
      maxWidth: { content: '72rem' },
    },
  },
  plugins: [],
};
