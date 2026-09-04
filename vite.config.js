import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The frontend calls the intelligence engine via relative /api/* paths.
// In dev, Vite proxies those to the Express server on :3001 so there is no
// CORS juggling and the same relative paths work in a built deployment behind
// a reverse proxy. Override the target with VITE_API_TARGET if needed.
const API_TARGET = process.env.VITE_API_TARGET || 'http://localhost:3001'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: API_TARGET,
        changeOrigin: true,
      },
    },
  },
})
