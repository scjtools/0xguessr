import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [],
  base: '/',
  build: {
    target: 'es2022',
    sourcemap: true,
  },
  server: {
    port: Number(process.env.PORT) || 5173,
    host: true,
  },
});