import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
export default defineConfig({
    plugins: [
        react(),
        VitePWA({
            registerType: 'autoUpdate',
            injectRegister: 'auto',
            manifest: {
                name: 'RestoFlow Customer',
                short_name: 'RestoFlow',
                theme_color: '#0f172a',
                background_color: '#020617',
                display: 'standalone',
            },
            workbox: { globPatterns: ['**/*.{js,css,html,ico,png,svg}'] }
        })
    ],
    build: {
        rollupOptions: {
            output: {
                manualChunks: {
                    react: ['react', 'react-dom', 'react-router-dom'],
                    query: ['@tanstack/react-query'],
                    state: ['zustand', 'idb-keyval'],
                    network: ['axios', 'socket.io-client'],
                    icons: ['lucide-react'],
                },
            },
        },
    },
    server: { port: 3001 }
});
