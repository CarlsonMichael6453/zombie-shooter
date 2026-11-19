import { defineConfig } from 'vite';

export default defineConfig({
  // Relative URLs so one dist works on GitHub Pages and inside Capacitor.
  base: './',
  build: {
    target: 'es2020',
    sourcemap: false,
  },
  server: { host: '127.0.0.1', port: 5173 },
  preview: { host: '127.0.0.1', port: 4173 },
});
