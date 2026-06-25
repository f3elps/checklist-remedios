import type { Config } from 'tailwindcss'

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)', surface: 'var(--surface)', 'surface-2': 'var(--surface-2)',
        text: 'var(--text)', muted: 'var(--muted)', border: 'var(--border)',
        primary: 'var(--primary)', 'primary-strong': 'var(--primary-strong)',
        'primary-soft': 'var(--primary-soft)', 'on-primary': 'var(--on-primary)',
        amber: 'var(--amber)', 'amber-soft': 'var(--amber-soft)',
        error: 'var(--error)', 'error-soft': 'var(--error-soft)',
      },
      borderRadius: { sm: 'var(--radius-sm)', DEFAULT: 'var(--radius)', lg: 'var(--radius-lg)' },
      fontFamily: { sans: 'var(--font-sans)' },
      boxShadow: { card: 'var(--card-shadow)' },
    },
  },
  plugins: [],
} satisfies Config
