import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { apiMiddleware } from './proxy.mjs';

// Adds the /api routes (AI providers + web page reader) to `npm run dev` and `npm run preview`.
const apiPlugin = {
  name: 'case-study-api',
  configureServer(server) { server.middlewares.use(apiMiddleware); },
  configurePreviewServer(server) { server.middlewares.use(apiMiddleware); },
};

export default defineConfig({
  plugins: [react(), apiPlugin],
});
