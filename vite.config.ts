import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({

  plugins: [react()],

  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false
      }
    }
  },

  resolve: {
    dedupe: ['leaflet']
  },

  optimizeDeps: {
    include: [
      'leaflet',
      'react-leaflet',
      '@geoman-io/leaflet-geoman-free',
      'leaflet.tilelayer.pouchdbcached',
      'pouchdb'
    ]
  },

  define: {
    global: 'window'
  },

  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          maps: ['leaflet', 'react-leaflet', '@geoman-io/leaflet-geoman-free'],
          utils: ['@supabase/supabase-js', 'lucide-react'],
          charts: ['recharts'],
          pdf: ['jspdf', 'jspdf-autotable']
        }
      }
    }
  }

})