import express from 'express'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { createAssetsRouter } from './server/api.js'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'api-server',
      configureServer(server) {
        const app = express()
        app.use('/api', createAssetsRouter())
        server.middlewares.use(app)
      },
    },
  ],
})
