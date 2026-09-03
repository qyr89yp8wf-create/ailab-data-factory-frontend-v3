import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  base: '/',
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        admin: resolve(import.meta.dirname, 'admin.html'),
      },
    },
  },
  server: { host: '127.0.0.1', port: 8767, strictPort: true },
  preview: { host: '127.0.0.1', port: 8767, strictPort: true },
});
