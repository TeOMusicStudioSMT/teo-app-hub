import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs';
import path from 'path';

// Odczyt credentials z .env w czasie build/run
const envPath = path.resolve(__dirname, '.env');
let envVars: Record<string, string> = {};
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && trimmed.includes('=')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        envVars[key] = valueParts.join('=').replace(/^"|"$/g, '');
      }
    }
  });
}

const sunoCookie = envVars['VITE_SUNO_COOKIE'] || '';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    'process.env': {},
    'import.meta.env.VITE_SUNO_COOKIE': JSON.stringify(sunoCookie),
    'import.meta.env.VITE_TEO_ISKA_KEY': JSON.stringify(envVars['VITE_TEO_ISKA_KEY'] || ''),
  },
  server: {
    headers: {
      "Cross-Origin-Resource-Policy": "cross-origin"
    },
    proxy: {
      '/api/suno': {
        target: 'https://studio-api.suno.ai',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/suno/, ''),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            console.log('[Vite Proxy] Dodaję nagłówki do Suno API');
            // Dodaj cookie - Suno używa tokena w cookie
            if (sunoCookie) {
              proxyReq.setHeader('Cookie', sunoCookie);
              proxyReq.setHeader('Authorization', `Bearer ${sunoCookie}`);
            }
            proxyReq.setHeader('Origin', 'https://suno.ai');
            proxyReq.setHeader('Referer', 'https://suno.ai/');
          });
          proxy.on('proxyRes', (proxyRes) => {
            console.log('[Vite Proxy] Suno Response:', proxyRes.statusCode);
          });
        }
      }
    }
  },
  preview: {
    headers: {
      "Cross-Origin-Resource-Policy": "cross-origin"
    }
  },
  assetsInclude: ['**/*.bin']
})
