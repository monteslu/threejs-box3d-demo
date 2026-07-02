import { defineConfig } from 'vite';

// Cross-origin isolation headers: required for SharedArrayBuffer, which the
// threaded box3d-wasm build uses. Netlify sets the same headers in
// netlify.toml for the deployed site.
const isolationHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
};

export default defineConfig({
  build: {
    // top level await in main.js
    target: 'esnext',
  },
  worker: {
    // the emscripten pthread worker (deluxe build) uses top level await,
    // which only module workers support
    format: 'es',
  },
  optimizeDeps: {
    // leave the emscripten module alone so its import.meta.url based wasm
    // and pthread worker loading keeps working in dev
    exclude: ['box3d-wasm'],
  },
  server: {
    headers: isolationHeaders,
    port: 8973,
  },
  preview: {
    headers: isolationHeaders,
    port: 8975,
  },
});
