// Vite config for the React frontend.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const frontendRoot = fileURLToPath(new URL('.', import.meta.url));
const workspaceRoot = path.resolve(frontendRoot, '..');

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true
  },
  resolve: {
    alias: {
      '@shared': path.resolve(workspaceRoot, 'shared', 'src'),
      '@backend': path.resolve(workspaceRoot, 'backend', 'src')
    }
  }
});
