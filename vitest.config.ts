import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    setupFiles: ['./vitest.setup.ts'],
    environmentOptions: {
      jsdom: {
        // jsdom disables localStorage for opaque origins. Use a stable origin
        // so browser-storage behavior is available in component tests.
        url: 'http://localhost/',
      },
    },
  },
})
