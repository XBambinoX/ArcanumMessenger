import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'

// crypto.subtle (used for client-side key derivation) is only available in
// secure contexts — HTTPS, or http://localhost. Accessing the dev server from
// another machine on the LAN needs real HTTPS, so we turn it on whenever a
// cert is provided (see docker-compose.yml) and fall back to plain HTTP
// otherwise, so `npm run dev` on its own still works unchanged.
const certPath = process.env.VITE_CERT_PATH
const keyPath = process.env.VITE_KEY_PATH

export default defineConfig({
    plugins: [react()],
    server: {
        https: certPath && keyPath
            ? { cert: fs.readFileSync(certPath), key: fs.readFileSync(keyPath) }
            : undefined,
        proxy: {
            '/api': {
                target: process.env.API_URL ?? 'http://api:8080',
                changeOrigin: true,
            },
            '/hubs': {
                target: process.env.API_URL ?? 'http://api:8080',
                changeOrigin: true,
                ws: true,
            },
        },
    },
})