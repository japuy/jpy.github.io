import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { spawnSync } from 'child_process'
import fs from 'fs'
import path from 'path'

function detectGoodEsbuild() {
  const candidates = [
    path.resolve(process.cwd(), 'node_modules', 'esbuild', 'bin', 'esbuild'),
    path.resolve(process.cwd(), 'node_modules', 'esbuild', 'esbuild.exe'),
    path.resolve(process.cwd(), 'node_modules', '.bin', 'esbuild'),
    path.resolve(process.cwd(), 'node_modules', '.bin', 'esbuild.cmd'),
  ]
  for (const c of candidates) {
    try {
      if (fs.existsSync(c)) {
        const r = spawnSync(c, ['--version'], { encoding: 'utf8', timeout: 5000 });
        if (r.status === 0 && r.stdout && r.stdout.trim() !== '') {
          console.log('[vite] menggunakan esbuild binary: ' + c + ' -> v' + r.stdout.trim());
          return true;
        }
      }
    } catch {}
  }
  console.log('[vite] ⚠️ esbuild binary tidak tersedia -> fallback minify=false + css.target not esbuild');
  return false;
}

const hasEsbuild = detectGoodEsbuild();

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: hasEsbuild ? 'esbuild' : false,
    target: 'es2020',
    cssMinify: hasEsbuild,
    chunkSizeWarningLimit: 5000,
    reportCompressedSize: false,
    emptyOutDir: true,
  },
  optimizeDeps: {
    disabled: false,
    force: true,
    esbuildOptions: {
      target: 'es2020',
    },
  },
  server: {
    port: 3000,
    open: true,
  },
  preview: {
    port: 4173,
  },
});
