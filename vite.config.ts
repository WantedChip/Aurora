import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  resolve: {
    preserveSymlinks: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'esnext',
    sourcemap: true,
    chunkSizeWarningLimit: 1500,
    cssCodeSplit: true,
    minify: 'esbuild',
    rollupOptions: {
      output: {
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
        manualChunks(id) {
          const normalized = id.replace(/\\/g, '/');

          // Vendor dependencies code splitting
          if (normalized.includes('/node_modules/')) {
            if (normalized.includes('tweakpane') || normalized.includes('@tweakpane')) {
              return 'vendor-tweakpane';
            }
            if (normalized.includes('lenis')) {
              return 'vendor-lenis';
            }
            if (normalized.includes('motion')) {
              return 'vendor-motion';
            }
            if (normalized.includes('three/examples') || normalized.includes('three/addons')) {
              return 'vendor-three-addons';
            }
            if (normalized.includes('three')) {
              return 'vendor-three';
            }
            return 'vendor-misc';
          }

          // Dynamic room modules chunking
          if (normalized.includes('/src/rooms/')) {
            const match = normalized.match(/\/src\/rooms\/([a-z0-9-]+)\//);
            if (match && match[1]) {
              return `room-${match[1]}`;
            }
          }
        },
      },
    },
  },
  server: {
    port: 3000,
    open: false,
  },
});
