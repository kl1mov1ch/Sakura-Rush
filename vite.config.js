import { defineConfig } from 'vite';

// Relative base so the build works from any folder or static host.
export default defineConfig({ base: './', build: { chunkSizeWarningLimit: 2500, assetsInlineLimit: 4 * 1024 * 1024 } });
