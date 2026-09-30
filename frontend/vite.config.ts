import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8200',
        changeOrigin: true,
      },
    },
  },
  build: {
    // Treat missing optional PDF packages (collaborator's pdfGenerator.ts) as
    // external so Rolldown doesn't hard-fail the bundle. The module is only
    // invoked at runtime when the user clicks "Download PDF".
    rolldownOptions: {
      external: ['jspdf', 'jspdf-autotable', 'html2canvas'],
    },
  },
})
