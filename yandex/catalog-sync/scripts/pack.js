const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');
const zipPath = path.join(root, 'catalog-sync.zip');

if (!fs.existsSync(path.join(dist, 'index.js'))) {
  console.error('dist/index.js missing — run npm run build first');
  process.exit(1);
}

if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);

// PowerShell Compress-Archive is available on Windows; zip CLI may be missing.
const isWin = process.platform === 'win32';
if (isWin) {
  execSync(
    `powershell -NoProfile -Command "Compress-Archive -Path '${dist}\\*' -DestinationPath '${zipPath}' -Force"`,
    { stdio: 'inherit' }
  );
} else {
  execSync(`cd "${dist}" && zip -r "${zipPath}" .`, { stdio: 'inherit' });
}

console.log('Packed:', zipPath);
