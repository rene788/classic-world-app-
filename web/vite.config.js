import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

// MOCK=1 gebruikt een nagebootste database (alleen om te testen, zonder Supabase)
export default defineConfig({
  plugins: [react()],
  base: './',
  resolve: {
    alias: process.env.MOCK ? [{ find: /^\.\.?\/db$/, replacement: path.resolve('src/db.mock.js') }] : [],
  },
})
