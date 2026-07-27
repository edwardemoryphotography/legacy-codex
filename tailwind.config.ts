import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Mirror v17 CSS custom properties
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        'surface-soft': 'var(--surface-soft)',
        'surface-strong': 'var(--surface-strong)',
        line: 'var(--line)',
        'line-strong': 'var(--line-strong)',
        tx: 'var(--text)',
        'tx-soft': 'var(--text-soft)',
        'tx-dim': 'var(--text-dim)',
        teal: 'var(--teal)',
        'teal-soft': 'var(--teal-soft)',
        amber: 'var(--amber)',
        'amber-soft': 'var(--amber-soft)',
        error: 'var(--error)',
        'error-soft': 'var(--error-soft)',
        success: 'var(--success)',
        'success-soft': 'var(--success-soft)',
      },
      borderRadius: {
        codex: 'var(--radius)',
        'codex-sm': 'var(--radius-sm)',
        'codex-lg': 'var(--radius-lg)',
      },
    },
  },
  plugins: [],
}

export default config
