import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  
  esbuild: {
    drop: ['console', 'debugger'],
  },

  build: {
    chunkSizeWarningLimit: 1000,
  },
  
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})