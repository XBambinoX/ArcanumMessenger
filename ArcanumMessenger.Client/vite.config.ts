import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
    plugins: [react()],
    server: {
        proxy: {
            '/api': {
                target: process.env.API_URL ?? 'http://localhost:5135',
                changeOrigin: true,
            },
        },
    },
})