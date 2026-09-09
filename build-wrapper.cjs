#!/usr/bin/env node
/* eslint-disable */
// Build-wrapper: jalankan vite build dengan watchdog timeout.
// Jika vite hang (stuck > 180s), matikan & retry tanpa minify.
// Selalu print progress setiap 10 detik supaya Vercel tidak anggap hang.
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const TIMEOUT_MS = 180_000; // 3 menit max per vite attempt
const HEARTBEAT_MS = 10_000;

function log(msg) {
  const t = new Date().toISOString().substr(11, 8);
  process.stdout.write(`[${t}] [build-wrapper] ${msg}\n`);
}

function runVite(args, envExtra) {
  return new Promise((resolve, reject) => {
    const env = { ...process.env, ...(envExtra || {}) };
    log(`run: vite ${args.join(' ')} (env=${JSON.stringify(envExtra || {})})`);
    const viteBin = path.resolve(__dirname, 'node_modules', '.bin', process.platform === 'win32' ? 'vite.cmd' : 'vite');
    log(`vite bin path: ${viteBin} exists=${fs.existsSync(viteBin)}`);
    const proc = process.platform === 'win32'
      ? spawn(process.env.comspec || 'cmd.exe', ['/c', '"' + viteBin + '" ' + args.join(' ')], { stdio: 'inherit', env, shell: false })
      : spawn(viteBin, args, { stdio: 'inherit', env });

    let lastOutputAt = Date.now();
    const heartbeat = setInterval(() => {
      const ago = Math.round((Date.now() - lastOutputAt) / 1000);
      log(`... masih berjalan (pid=${proc.pid || '?'}), sejak output terakhir: ${ago}s ...`);
    }, HEARTBEAT_MS);

    const killer = setTimeout(() => {
      log(`❌ TIMEOUT (${TIMEOUT_MS / 1000}s) - kill vite process`);
      try { proc.kill('SIGKILL'); } catch {}
      try { proc.kill(9); } catch {}
    }, TIMEOUT_MS);

    proc.on('error', (e) => {
      clearInterval(heartbeat); clearTimeout(killer);
      reject(e);
    });
    proc.stdout?.on?.('data', () => { lastOutputAt = Date.now(); });
    proc.stderr?.on?.('data', () => { lastOutputAt = Date.now(); });
    proc.on('exit', (code, signal) => {
      clearInterval(heartbeat); clearTimeout(killer);
      log(`vite exit code=${code} signal=${signal || '-'}`);
      resolve(code || 0);
    });
  });
}

async function main() {
  log('node version=' + process.version + ' platform=' + process.platform);

  // Attempt 1: vite build dengan settings default (termasuk minify jika esbuild OK)
  let code = await runVite(['build']);
  if (code === 0 && fs.existsSync(path.join(__dirname, 'dist', 'index.html'))) {
    log('✅ build ATTEMPT 1 sukses');
    return 0;
  }

  // Attempt 2: paksa TANPA minify, TANPA optimizeDeps (jangan panggil esbuild)
  log('ATTEMPT 1 gagal -> ATTEMPT 2: mode safe (no minify, no esbuild)');
  process.env.VITE_SAFE_MODE = '1';
  code = await runVite(['build', '--mode', 'production', '--minify', 'false'], {
    NODE_ENV: 'production',
    VITE_DISABLE_ESBUILD: '1',
  });
  if (code === 0 && fs.existsSync(path.join(__dirname, 'dist', 'index.html'))) {
    log('✅ build ATTEMPT 2 sukses (safe-mode)');
    return 0;
  }

  log('❌ semua attempt gagal — kode exit=' + code);
  return code || 1;
}

main()
  .then((c) => process.exit(c || 0))
  .catch((e) => {
    process.stderr.write('[build-wrapper] FATAL: ' + e.stack + '\n');
    process.exit(1);
  });
