/** Adnario's colours. */
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    fontFamily: { sans: ['Archivo', 'system-ui', 'sans-serif'], mono: ['"IBM Plex Mono"', 'monospace'] },
    extend: {
      colors: {
        ink: '#12212f',
        primary: {
          DEFAULT: '#14456e',
          50: '#eef5fa',
          100: '#d8e8f3',
          200: '#b3d1e7',
          300: '#7fb0d4',
          400: '#4c8bbc',
          500: '#2b6c9e',
          600: '#1d5786',
          700: '#14456e',
          800: '#103a5c',
          900: '#0c2c47',
        },
        accent: {
          DEFAULT: '#e8b13c',
          50: '#fdf6e5',
          100: '#fbeabf',
          200: '#f6d784',
          300: '#f0c14b',
          400: '#e8b13c',
          500: '#d19a25',
          600: '#a97a1b',
        },
        paper: '#f6f5f2',
        canvas: '#eeede8',
        line: '#e6e4dd',
        success: { DEFAULT: '#2e7d5b', 50: '#e9f5ef', 100: '#cfe8db', 500: '#2e7d5b', 600: '#256a4c' },
        warning: { DEFAULT: '#b97324', 50: '#fbf3e7', 100: '#f5e2c4', 500: '#b97324', 600: '#9c5f1c' },
        danger: { DEFAULT: '#b3402f', 50: '#fbecea', 100: '#f4cfca', 500: '#b3402f', 600: '#953426' },
      },
      boxShadow: {
        sheet: '0 -8px 40px -8px rgba(12,26,43,0.25)',
        panel: '-12px 0 48px -12px rgba(12,26,43,0.18)',
        card: '0 1px 2px rgba(12,26,43,0.04), 0 4px 16px -6px rgba(12,26,43,0.08)',
        pop: '0 12px 40px -8px rgba(12,26,43,0.18)',
      },
    },
  },
  plugins: [],
};
