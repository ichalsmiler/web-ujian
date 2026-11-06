import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Satu file index.html berisi semua JS, CSS, dan template xlsx,
// supaya bisa dibuka langsung (file://) tanpa server dan tanpa internet.
export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
  build: {
    assetsInlineLimit: 10_000_000,
  },
});
