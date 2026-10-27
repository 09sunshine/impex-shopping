import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

const DEFAULT_LOCAL_BACKEND = 'http://127.0.0.1:8000'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const backendTarget = env.VITE_BACKEND_TARGET || env.VITE_COMMERCE_TARGET || DEFAULT_LOCAL_BACKEND

  return {
    plugins: [react()],
    server: {
      host: '0.0.0.0',
      port: 3001,
      proxy: {
        // Unified Shopping Engine & Order by Link Routes
        '/api/shopping': {
          target: backendTarget,
          changeOrigin: true,
          secure: false,
        },
        '/api/admin/shopping': {
          target: backendTarget,
          changeOrigin: true,
          secure: false,
        },
        // Marketplace Search, URL Quoting, and Universal Cart Engine
        '/api/commerce': {
          target: backendTarget,
          changeOrigin: true,
          secure: false,
        },
        // Existing IMPEX Authentication & Customer Account Infrastructure
        '/api/auth': {
          target: backendTarget,
          changeOrigin: true,
          secure: false,
        },
        '/api/customers': {
          target: backendTarget,
          changeOrigin: true,
          secure: false,
        },
        '/api/wallet': {
          target: backendTarget,
          changeOrigin: true,
          secure: false,
        },
        '/api/me': {
          target: backendTarget,
          changeOrigin: true,
          secure: false,
        },
        '/api/users': {
          target: backendTarget,
          changeOrigin: true,
          secure: false,
        },
        '/api/packages': {
          target: backendTarget,
          changeOrigin: true,
          secure: false,
        },
        '/api/subscriptions': {
          target: backendTarget,
          changeOrigin: true,
          secure: false,
        },
        '/api/addresses': {
          target: backendTarget,
          changeOrigin: true,
          secure: false,
        },
        // Default fallback to existing backend
        '/api': {
          target: backendTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },
  }
})
