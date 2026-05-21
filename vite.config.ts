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


// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    'process.env': {},
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
        headers: {
          'Origin': 'https://suno.com',
          'Referer': 'https://suno.com/',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'sec-ch-ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
          'sec-ch-ua-mobile': '?0',
          'sec-ch-ua-platform': '"Windows"',
          'Accept-Language': 'pl-PL,pl;q=0.9,en-US;q=0.8,en;q=0.7'
        }
      }
    }
  },
  preview: {
    headers: {
      "Cross-Origin-Resource-Policy": "cross-origin"
    }
  },
  assetsInclude: ['**/*.bin'],
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-motion': ['framer-motion'],
          'vendor-firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage'],
          'vendor-ui': ['lucide-react', 'recharts'],
          'vendor-ai': ['@google/generative-ai', '@google/genai'],
          'vendor-state': ['jotai', 'zustand'],
          'vendor-util': ['ethers', 'uuid', 'axios'],
        },
      },
    },
  },
})
