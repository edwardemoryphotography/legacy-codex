import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [],
    // Each test file runs in its own isolate so module-level side-effects
    // (e.g. the GEMINI_API_KEY throw in src/lib/gemini.ts) can be mocked
    // per file without leaking into other suites.
    isolate: true,
  },
})
