import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// https://vitejs.dev/config/
export default defineConfig({
    envDir: '../../',
    envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
    plugins: [react()],
    server: {
        port: 3000,
        host: true,
        watch: {
            usePolling: true, // Required for stable file watching on many Windows environments
            interval: 100,
        }
    },
    optimizeDeps: {
        include: ['lucide-react', '@tanstack/react-query', 'axios', 'date-fns', 'socket.io-client'],
    },
    build: {
        chunkSizeWarningLimit: 1000,
    }
});
