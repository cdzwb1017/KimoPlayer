import { defineConfig } from 'vite';

export default defineConfig({
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
  },
  build: {
    target: 'esnext',
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      input: {
        main: 'index.html',
        metadata: 'metadata.html',
        desktopLyrics: 'desktop-lyrics.html',
      }
    }
  },
  esbuild: {
    drop: ['console', 'debugger'],
  },
});
