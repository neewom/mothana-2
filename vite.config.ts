import path from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  // Explicit opt-in for the staging-only lab; normal builds have no spike entry.
  build: {
    rollupOptions: {
      input: loadEnv(mode, process.cwd(), '').VITE_COUPON_SPIKE === 'true'
        ? { main: path.resolve(__dirname, 'index.html'), spike: path.resolve(__dirname, 'coupon-spike.html') }
        : path.resolve(__dirname, 'index.html'),
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
}))
