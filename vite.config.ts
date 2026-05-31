import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    rollupOptions: {
      external: [
        'express',
        'ws',
        'dotenv',
        '@google/genai',
        'fsevents',
        'path',
        'fs',
        'url'
      ]
    }
  }
});
