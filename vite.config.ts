import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [],
      manifest: {
        name: 'ParkMate',
        short_name: 'ParkMate',
        description: 'Remember your parking. Find your way back.',
        theme_color: '#f7faf8',
        background_color: '#f7faf8',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: []
      },
      workbox: {
        navigateFallback: '/index.html',
        globPatterns: ['**/*.{js,css,html,svg,png,ico}']
      }
    })
  ]
});