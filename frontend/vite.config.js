import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath } from 'node:url';

const sourceDirectory = fileURLToPath(new URL('./src', import.meta.url));

export default defineConfig({
  plugins: [react(), VitePWA({ registerType: 'autoUpdate', manifest: false, workbox: { globPatterns: ['**/*.{js,css,html,svg,png,ico}'] } })],
  resolve: {
    alias: {
      '@': sourceDirectory,
    },
  },
  server: {
    port: 5174,
  },
});
