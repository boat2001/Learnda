import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig(({ command }) => ({
  plugins: [
    react(),
    // Run `ANALYZE=true npm run build` to open a bundle treemap after build
    process.env.ANALYZE && visualizer({ open: true, gzipSize: true, brotliSize: true, filename: 'dist/bundle-stats.html' }),
  ].filter(Boolean),
  server: {
    port: parseInt(process.env.VITE_PORT) || 5175,
    host: true,
  },
  // Pre-bundling react-icons often triggers "504 Outdated Optimize Dep" in dev (stale
  // .vite/deps hashes). Excluding skips the optimizer for this package; dev cold load
  // is slightly slower but stable.
  optimizeDeps: {
    exclude: ['react-icons'],
    esbuildOptions: {
      loader: { '.js': 'jsx' },
    },
  },
  // Strip console.* and debugger statements from production bundles only.
  // command === 'build' means `vite build`; dev server leaves them intact.
  esbuild: {
    drop: command === 'build' ? ['console', 'debugger'] : [],
  },
  build: {
    // Raise warning threshold — we track real bloat via manualChunks below
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React — cached separately; rarely changes between deploys
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // Icons are large and change infrequently
          'vendor-icons': ['react-icons'],
          // Charting library only needed in admin / analytics pages
          'vendor-charts': ['recharts'],
          // Misc utilities
          'vendor-utils': ['dompurify', 'pdfjs-dist'],
        },
      },
    },
    // Minify with esbuild (default) — fastest and produces good output
    minify: 'esbuild',
    // Inline small assets directly into JS to cut requests
    assetsInlineLimit: 4096,
    // Enable CSS code splitting so each lazy chunk only loads its own CSS
    cssCodeSplit: true,
  },
}));
