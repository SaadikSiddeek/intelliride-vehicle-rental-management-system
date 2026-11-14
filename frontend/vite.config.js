import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import process from 'node:process'
const configDirectory = path.dirname(fileURLToPath(import.meta.url))


// https://vite.dev/config/
export default defineConfig({
  server: process.env.INTELLIRIDE_RBAC_DEMO === '1'
    ? { proxy: { '/api': { target: 'http://127.0.0.1:8001', changeOrigin: true } } }
    : undefined,

  plugins: [
    react(),
    tailwindcss()
  ],


  resolve: {

    alias: {

      "@": path.resolve(configDirectory, "./src")

    }

  }

})
