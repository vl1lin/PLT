/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// base: './' — относительные пути, чтобы сборка работала на GitHub Pages
// по адресу https://vl1lin.github.io/PLT/ без привязки к имени репозитория.
export default defineConfig({
  base: './',
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
