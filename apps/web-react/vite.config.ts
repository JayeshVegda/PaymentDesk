import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '127.0.0.1',
    port: 4782,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:4783',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'build', // Let's use build directory so that it's consistent or dist. Wait, Svelte uses build, React can use build too or dist. Let's make it build so it's consistent. Wait! If the brief says we verify a production build Hono can serve from alternate path without switching live app first, we can output to build.
    emptyOutDir: true,
  }
});
