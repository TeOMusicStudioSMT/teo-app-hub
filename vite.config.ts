import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // To jest ta szczepionka. Mówimy przeglądarce:
    // "Jeśli kod pyta o process.env, daj mu pusty obiekt, ale nie panikuj."
    'process.env': {}
  },
  // Konfiguracja serwera dla obsługi dużych modeli AI (MediaPipe/WASM)
  // OPCJA B: Całkowite wyłączenie nagłówków dla odblokowania Firebase Auth
  server: {
    headers: {
      "Cross-Origin-Resource-Policy": "cross-origin"
    }
  },
  preview: {
    headers: {
      "Cross-Origin-Resource-Policy": "cross-origin"
    }
  },
  assetsInclude: ['**/*.bin']
})