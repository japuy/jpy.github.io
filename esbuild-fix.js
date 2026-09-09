#!/usr/bin/env node
/* eslint-disable */
// Workaround esbuild binary installer — multiple fallback strategies.
// FORCE output (tidak ada 2>/dev/null) supaya Vercel log menampilkan progress.
const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const { execSync, spawnSync } = require('child_process');

const ESBUILD_VERSION = '0.24.0';
const ROOT = __dirname;
const ESBUILD_DIR = path.join(ROOT, 'node_modules', 'esbuild');
const TARGET_BIN_DIR = path.join(ESBUILD_DIR, 'bin');
const IS_WIN = process.platform === 'win32';
const TARGET_BIN = IS_WIN
  ? path.join(ESBUILD_DIR, 'esbuild.exe')
  : path.join(TARGET_BIN_DIR, 'esbuild');
const BIN_DIR = path.join(ROOT, 'node_modules', '.bin');
const BIN_LINK = path.join(BIN_DIR, IS_WIN ? 'esbuild.cmd' : 'esbuild');

function log(msg) {
  const t = new Date().toISOString().substr(11, 8);
  process.stdout.write(`[${t}] [esbuild-fix v${ESBUILD_VERSION}] ${msg}\n`);
}

function getPlatformKey() {
  const p = process.platform;
  const a = process.arch;
  const map = {
    'android-arm': '@esbuild/android-arm',
    'android-arm64': '@esbuild/android-arm64',
    'android-x64': '@esbuild/android-x64',
    'darwin-arm64': '@esbuild/darwin-arm64',
    'darwin-x64': '@esbuild/darwin-x64',
    'freebsd-arm64': '@esbuild/freebsd-arm64',
    'freebsd-x64': '@esbuild/freebsd-x64',
    'linux-arm': '@esbuild/linux-arm',
    'linux-arm64': '@esbuild/linux-arm64',
    'linux-ia32': '@esbuild/linux-ia32',
    'linux-loong64': '@esbuild/linux-loong64',
    'linux-mips64el': '@esbuild/linux-mips64el',
    'linux-ppc64': '@esbuild/linux-ppc64',
    'linux-riscv64': '@esbuild/linux-riscv64',
    'linux-s390x': '@esbuild/linux-s390x',
    'linux-x64': '@esbuild/linux-x64',
    'netbsd-x64': '@esbuild/netbsd-x64',
    'openbsd-x64': '@esbuild/openbsd-x64',
    'sunos-x64': '@esbuild/sunos-x64',
    'win32-arm64': '@esbuild/win32-arm64',
    'win32-ia32': '@esbuild/win32-ia32',
    'win32-x64': '@esbuild/win32-x64',
  };
  return map[`${p}-${a}`] || (a === 'x64' ? map[`${p}-x64`] : null);
}

function verifyBinary(file) {
  try {
    if (!fs.existsSync(file)) return false;
    const r = spawnSync(file, ['--version'], { encoding: 'utf8', timeout: 10000 });
    if (r.status === 0 && r.stdout && r.stdout.trim() === ESBUILD_VERSION) return true;
    log(`verifyBinary FAILED status=${r.status} out=${r.stdout} err=${r.stderr}`);
  } catch (e) {
    log(`verifyBinary error: ${e.message}`);
  }
  return false;
}

function findBinInDir(dir) {
  try {
    const names = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of names) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const r = findBinInDir(full);
        if (r) return r;
      } else if (entry.isFile()) {
        const base = entry.name.toLowerCase().replace(/\.exe$/, '');
        if (base === 'esbuild') return full;
      }
    }
  } catch {}
  return null;
}

function downloadHttps(url, dest) {
  return new Promise((resolve, reject) => {
    const tmp = dest + '.downloading';
    const file = fs.createWriteStream(tmp);
    function doGet(u) {
      https.get(u, { headers: { 'User-Agent': 'esbuild-fix' } }, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          return doGet(new URL(res.headers.location, u).toString());
        }
        if (!res.statusCode || res.statusCode >= 400) {
          file.destroy();
          return reject(new Error(`HTTP ${res.statusCode}: ${u}`));
        }
        res.pipe(file);
        file.on('finish', () => {
          file.close(() => {
            try { fs.renameSync(tmp, dest); resolve(dest); }
            catch (e) { reject(e); }
          });
        });
      }).on('error', (e) => {
        try { fs.unlinkSync(tmp); } catch {}
        reject(e);
      });
    }
    doGet(url);
  });
}

async function main() {
  log(`platform=${process.platform} arch=${process.arch} cwd=${ROOT}`);

  if (verifyBinary(TARGET_BIN)) {
    log('✅ binary already OK at ' + TARGET_BIN);
    ensureBinLink();
    return 0;
  }

  const pkgKey = getPlatformKey();
  log(`target platform package: ${pkgKey}`);

  // STAGE 1: Run official esbuild install.js
  log('STAGE 1/4: run esbuild/install.js');
  try {
    const installJs = path.join(ESBUILD_DIR, 'install.js');
    if (fs.existsSync(installJs)) {
      execSync(`node "${installJs}"`, { stdio: 'inherit', timeout: 60000 });
    }
    if (verifyBinary(TARGET_BIN)) {
      log('✅ installed via install.js');
      ensureBinLink();
      return 0;
    }
  } catch (e) {
    log(`STAGE 1 skipped: ${e.message || e}`);
  }

  // STAGE 2: copy from installed optional dep @esbuild/<platform>
  log('STAGE 2/4: copy from node_modules/' + pkgKey);
  try {
    if (pkgKey) {
      const pkgDir = path.join(ROOT, 'node_modules', ...pkgKey.split('/'));
      log(`looking in dir: ${pkgDir}`);
      if (fs.existsSync(pkgDir)) {
        const bin = findBinInDir(pkgDir);
        if (bin) {
          if (!fs.existsSync(path.dirname(TARGET_BIN))) fs.mkdirSync(path.dirname(TARGET_BIN), { recursive: true });
          fs.copyFileSync(bin, TARGET_BIN);
          if (!IS_WIN) fs.chmodSync(TARGET_BIN, 0o755);
          if (verifyBinary(TARGET_BIN)) {
            log('✅ installed via optional dep copy (' + pkgKey + ')');
            ensureBinLink();
            return 0;
          }
        }
      }
    }
  } catch (e) {
    log(`STAGE 2 skipped: ${e.message}`);
  }

  // STAGE 3: run esbuild install via npx
  log('STAGE 3/4: force install via npm exec esbuild --version');
  try {
    execSync(`npm exec --package=esbuild@${ESBUILD_VERSION} --yes -- esbuild --version`, {
      stdio: 'inherit', timeout: 120000,
    });
    if (verifyBinary(TARGET_BIN)) {
      log('✅ installed via npm exec');
      ensureBinLink();
      return 0;
    }
  } catch (e) {
    log(`STAGE 3 skipped: ${e.message}`);
  }

  // STAGE 4: direct tarball download from npm registry
  log('STAGE 4/4: download tarball directly from npm registry');
  try {
    if (!pkgKey) throw new Error('Unsupported platform ' + process.platform + '-' + process.arch);
    const pkgShort = pkgKey.replace('@esbuild/', '');
    const url = `https://registry.npmjs.org/${pkgKey}/-/${pkgShort}-${ESBUILD_VERSION}.tgz`;
    const tmpTgz = path.join(os.tmpdir(), `esbuild-bin-${Date.now()}.tgz`);
    log(`url=${url}`);
    log(`dest tmp=${tmpTgz}`);
    await downloadHttps(url, tmpTgz);
    const extractDir = fs.mkdtempSync(path.join(os.tmpdir(), 'esbuild-'));
    try {
      execSync(`tar -xzf "${tmpTgz}" -C "${extractDir}"`, { stdio: 'inherit', timeout: 60000 });
      const bin = findBinInDir(extractDir);
      if (!bin) throw new Error('Binary tidak ditemukan di tarball npm');
      if (!fs.existsSync(path.dirname(TARGET_BIN))) fs.mkdirSync(path.dirname(TARGET_BIN), { recursive: true });
      fs.copyFileSync(bin, TARGET_BIN);
      if (!IS_WIN) fs.chmodSync(TARGET_BIN, 0o755);
      if (verifyBinary(TARGET_BIN)) {
        log('✅ installed via npm tarball download');
        ensureBinLink();
        return 0;
      } else {
        throw new Error('Binary downloaded tapi tidak valid versi');
      }
    } finally {
      try { fs.rmSync(extractDir, { recursive: true, force: true }); } catch {}
      try { fs.unlinkSync(tmpTgz); } catch {}
    }
  } catch (e) {
    log(`STAGE 4 FAILED: ${e.message}`);
  }

  log('❌ SEMUA STAGE GAGAL — coba jalankan tanpa minify dulu');
  log('Vite akan tetap jalan, tapi minify ESBuild fallback ke tidak transform (bisa lambat).');
  return 0;
}

function ensureBinLink() {
  try {
    if (!fs.existsSync(BIN_DIR)) fs.mkdirSync(BIN_DIR, { recursive: true });
    if (IS_WIN) {
      const cmd = `@echo off\n"${TARGET_BIN}" %*`;
      fs.writeFileSync(BIN_LINK, cmd);
    } else {
      if (fs.existsSync(BIN_LINK)) fs.unlinkSync(BIN_LINK);
      fs.symlinkSync(TARGET_BIN, BIN_LINK);
      fs.chmodSync(BIN_LINK, 0o755);
    }
    log(`link binary ${TARGET_BIN} -> ${BIN_LINK}`);
  } catch (e) {
    log(`warning: tidak bisa bikin bin link: ${e.message}`);
  }
}

main()
  .then((c) => process.exit(c || 0))
  .catch((e) => {
    process.stderr.write('[esbuild-fix] FATAL: ' + e.stack + '\n');
    process.exit(0); // never fail the build
  });

// 15 detik watchdog: jika esbuild-fix stuck, keluar saja
setTimeout(() => {
  process.stdout.write('[esbuild-fix] watchdog timeout 60s -> exit 0 (lanjut build)\n');
  process.exit(0);
}, 60000);
