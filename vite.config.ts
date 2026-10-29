import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({ server: { allowedHosts: ['terminal.local'] }, plugins: [react(), tailwindcss()], test: { environment: 'node', include: ['src/tests/**/*.test.ts'] }, build: { rollupOptions: { output: { manualChunks: { charts: ['recharts'], motion: ['motion/react'] } } } } });
