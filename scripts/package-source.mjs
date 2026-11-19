import fs from 'node:fs/promises';
import path from 'node:path';
import JSZip from 'jszip';
// An explicit source boundary also works from an extracted archive without Git.
const roots = ['src', 'electron', 'scripts', 'tests', 'e2e', 'public', '.github', 'docs', 'examples'];
const rootFiles = [
  '.editorconfig',
  '.gitignore',
  '.nvmrc',
  '.prettierignore',
  '.prettierrc.json',
  'CONTRIBUTING.md',
  'LICENSE',
  'README.md',
  'README.tr.md',
  'SECURITY.md',
  'THIRD_PARTY_NOTICES.md',
  'CHANGELOG.md',
  'electron-builder.yml',
  'eslint.config.js',
  'index.html',
  'package.json',
  'package-lock.json',
  'playwright.config.ts',
  'tsconfig.app.json',
  'tsconfig.json',
  'tsconfig.node.json',
  'vite.config.ts',
  'vitest.config.ts',
];
const zip = new JSZip();
async function add(filename) {
  if (
    filename.startsWith('docs/') &&
    path.extname(filename) === '.png' &&
    !filename.startsWith('docs/images/')
  )
    return;
  if (filename.endsWith('.vibescreens.json') && filename !== 'examples/daylight.vibescreens.json') return;
  if (
    /(^|\/)(node_modules|\.local|\.git|\.env)(\/|$)/.test(filename) ||
    filename.includes('mcp-connection.json') ||
    filename.includes('vibe-backup-')
  )
    return;
  const stat = await fs.lstat(filename);
  if (stat.isSymbolicLink()) return;
  if (stat.isDirectory()) {
    for (const entry of await fs.readdir(filename)) await add(path.posix.join(filename, entry));
  } else if (stat.isFile()) zip.file(`vibe-screenshots/${filename}`, await fs.readFile(filename));
}
for (const file of [...rootFiles, ...roots]) {
  try {
    await add(file);
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
}
const { version } = JSON.parse(await fs.readFile('package.json', 'utf8'));
await fs.mkdir('release', { recursive: true });
const output = `release/vibe-screenshots-${version}-source.zip`;
await fs.writeFile(
  output,
  await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } }),
);
console.log(output);
