import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
    plugins: [react()],
    server: {
        port: 3000,
        proxy: {
            '/api': {
                target: 'http://localhost:5000',
                changeOrigin: true,
                secure: false,
                ws: true,
                configure: (proxy, _options) => {
                    proxy.on('error', (err, _req, _res) => {
                        console.log('Proxy error:', err.message);
                        console.log('Make sure the backend server is running on port 5000');
                    });
                    proxy.on('proxyReq', (proxyReq, req, _res) => {
                        console.log('Proxying:', req.method, req.url);
                    });
                },
            },
        },
    },
})
