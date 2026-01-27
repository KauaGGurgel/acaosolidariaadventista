import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const cwd = typeof process !== 'undefined' && (process as any).cwd ? (process as any).cwd() : '.';
  const env = loadEnv(mode, cwd, '');

  return {
    base: './', 
    plugins: [react()],
    define: {
      'process.env': JSON.stringify({
        API_KEY: process.env.API_KEY || env.API_KEY,
        VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL || env.VITE_SUPABASE_URL,
        VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY,
        NODE_ENV: mode
      })
    },
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      emptyOutDir: true,
    }
  }
})