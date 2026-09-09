#!/usr/bin/env node
/* eslint-disable */
// Workaround untuk esbuild yang postinstall-nya diblokir di
// Vercel / npm strict allow-scripts. Script ini mendeteksi platform & CPU
// lalu men-download binary esbuild secara manual, symlink ke node_modules/.bin.
const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const { execSync } = require('child_process');

const ESBUILD_VERSION = '0.21.5';
const ESBUILD_DIR = path.join(__dirname, 'node_modules', 'esbuild');
const BIN_DIR = path.join(__dirname, 'node_modules', '.bin');
const TARGET_BIN = path.join(
  ESBUILD_DIR,
  process.platform === 'win32' ? 'esbuild.exe' : 'bin',
  process.platform === 'win32' ? 'esbuild.exe' : 'esbuild'
);

function getPlatform() {
  const platform = process.platform;
  const arch = process.arch;
  const names = {
    'android-arm': 'android-arm',
    'android-arm64': 'android-arm64',
    'android-x64': 'android-x64',
    'darwin-x64': 'darwin-x64',
    'darwin-arm64': 'darwin-arm64',
    'freebsd-x64': 'freebsd-x64',
    'freebsd-arm64': 'freebsd-arm64',
    'linux-x64': 'linux-x64',
    'linux-arm64': 'linux-arm64',
    'linux-ia32': 'linux-ia32',
    'linux-mips64el': 'linux-mips64el',
    'linux-ppc64': 'linux-ppc64',
    'linux-riscv64': 'linux-riscv64',
    'linux-s390x': 'linux-s390x',
    'netbsd-x64': 'netbsd-x64',
    'openbsd-x64': 'openbsd-x64',
    'sunos-x64': 'sunos-x64',
    'win32-x64': 'win32-x64',
    'win32-arm64': 'win32-arm64',
    'win32-ia32': 'win32-ia32',
  };
  const key = `${platform}-${arch}`;
  return names[key] || (arch === 'x64' ? `${platform}-x64` : `${platform}-${arch}`);
}

function checkAlreadyInstalled() {
  try {
    if (fs.existsSync(TARGET_BIN)) {
      try {
        const out = execSync(
          process.platform === 'win32'
            ? `"${TARGET_BIN}" --version`
            : `"${TARGET_BIN}" --version`,
          { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
        );
        if (out && out.trim() === ESBUILD_VERSION) return true;
      } catch {}
    }
  } catch {}
  return false;
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const tmp = dest + '.tmp';
    const file = fs.createWriteStream(tmp);
    https
      .get(url, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return download(res.headers.location, dest).then(resolve).catch(reject);
        }
        if (!res.statusCode || res.statusCode >= 400) {
          return reject(new Error(`HTTP ${res.statusCode} ${url}`));
        }
        res.pipe(file);
        file.on('finish', () => {
          file.close(() => {
            fs.renameSync(tmp, dest);
            resolve(dest);
          });
        });
      })
      .on('error', (e) => {
        try { fs.unlinkSync(tmp); } catch {}
        reject(e);
      });
  });
}

async function main() {
  if (checkAlreadyInstalled()) {
    process.stdout.write('[esbuild-fix] esbuild binary ready (v' + ESBUILD_VERSION + ')\n');
    return 0;
  }

  const platform = getPlatform();
  process.stdout.write('[esbuild-fix] installing esbuild binary for: ' + platform + '\n');

  // Try running esbuild official install.js first
  try {
    const installScript = path.join(__dirname, 'node_modules', 'esbuild', 'install.js');
    if (fs.existsSync(installScript)) {
      process.stdout.write('[esbuild-fix] running esbuild/install.js...\n');
      try {
        execSync(`node "${installScript}"`, { stdio: 'inherit', env: { ...process.env, FORCE_COLOR: '0' } });
        if (checkAlreadyInstalled()) {
          process.stdout.write('[esbuild-fix] esbuild installed successfully via install.js\n');
          return 0;
        }
      } catch (e) {
        process.stderr.write('[esbuild-fix] install.js skipped: ' + (e.message || '') + '\n');
      }
    }
  } catch {}

  // Fallback: cari di optional dependencies @esbuild/<platform>
  try {
    const pkgName = `@esbuild/${platform}`;
    const pkgDir = path.join(__dirname, 'node_modules', pkgName);
    if (fs.existsSync(pkgDir)) {
      const entries = fs.readdirSync(pkgDir);
      const candidates = entries.filter((f) => f.includes('esbuild') || f === 'bin');
      for (const c of candidates) {
        const full = path.join(pkgDir, c);
        try {
          if (fs.statSync(full).isDirectory()) {
            const inner = fs.readdirSync(full).find((x) => x.startsWith('esbuild'));
            if (inner) {
              const src = path.join(full, inner);
              const targetDir = path.dirname(TARGET_BIN);
              if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
              fs.copyFileSync(src, TARGET_BIN);
              if (process.platform !== 'win32') fs.chmodSync(TARGET_BIN, 0o755);
              process.stdout.write('[esbuild-fix] copied from ' + pkgName + '\n');
              return 0;
            }
          }
        } catch {}
      }
    }
  } catch (e) {
    process.stderr.write('[esbuild-fix] optional deps lookup failed: ' + e.message + '\n');
  }

  // Final fallback: download dari npm registry tarball
  const url = `https://registry.npmjs.org/@esbuild/${platform}/-/${platform}-${ESBUILD_VERSION}.tgz`;
  const tarballPath = path.join(os.tmpdir(), `esbuild-${platform}-${ESBUILD_VERSION}.tgz`);
  try {
    process.stdout.write('[esbuild-fix] downloading ' + url + '\n');
    await download(url, tarballPath);
    const extractDir = fs.mkdtempSync(path.join(os.tmpdir(), 'esbuild-'));
    try {
      execSync(`tar -xzf "${tarballPath}" -C "${extractDir}"`, { stdio: 'inherit' });
      const pkgDir = path.join(extractDir, 'package');
      const binFile = fs
        .readdirSync(pkgDir, { recursive: true })
        .map((f) => path.join(pkgDir, f))
        .find((f) => {
          try {
            const s = fs.statSync(f);
            return s.isFile() && (path.basename(f) === 'esbuild' || path.basename(f) === 'esbuild.exe');
          } catch {
            return false;
          }
        });
      if (!binFile) throw new Error('Binary tidak ditemukan di tarball');
      const targetDir = path.dirname(TARGET_BIN);
      if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
      fs.copyFileSync(binFile, TARGET_BIN);
      if (process.platform !== 'win32') fs.chmodSync(TARGET_BIN, 0o755);
      process.stdout.write('[esbuild-fix] esbuild binary installed from registry\n');
      return 0;
    } finally {
      try { fs.rmSync(extractDir, { recursive: true, force: true }); } catch {}
      try { fs.unlinkSync(tarballPath); } catch {}
    }
  } catch (e) {
    process.stderr.write('[esbuild-fix] ERROR: ' + e.message + '\n');
    process.stderr.write('[esbuild-fix] akan melanjutkan (esbuild akan mencoba fallback install.js)\n');
    return 0;
  }
}

main().then((code) => process.exit(code || 0));
