import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const root = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const seen = new Set();
const blocks = [];
function visit(name, from = process.cwd()) {
  let entry;
  try {
    entry = require.resolve(name, { paths: [from] });
  } catch {
    // Packages such as the MCP SDK expose only subpaths, without a root entry.
    const candidate = require.resolve
      .paths(name)
      ?.map((base) => path.join(base, name, 'package.json'))
      .find((file) => fs.existsSync(file));
    if (!candidate) throw new Error(`Could not locate runtime license for ${name} from ${from}`);
    entry = candidate;
  }
  let directory = path.dirname(entry);
  while (!fs.existsSync(path.join(directory, 'package.json'))) {
    const parent = path.dirname(directory);
    if (parent === directory) return;
    directory = parent;
  }
  const pkg = JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8'));
  const id = `${pkg.name}@${pkg.version}`;
  if (seen.has(id)) return;
  seen.add(id);
  const licenseFile = fs
    .readdirSync(directory)
    .find((name) => /^licen[cs]e(?:\.txt|\.md|\.markdown)?$/i.test(name));
  const noticeFile = fs.readdirSync(directory).find((name) => /^notice(?:\.txt|\.md)?$/i.test(name));
  const notice = noticeFile ? '\n\n' + fs.readFileSync(path.join(directory, noticeFile), 'utf8').trim() : '';
  const text = licenseFile
    ? fs.readFileSync(path.join(directory, licenseFile), 'utf8')
    : `License: ${pkg.license ?? 'See package source'}`;
  const normalized = `${text.trim()}${notice}`
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n');
  blocks.push(`## ${id}\n\n${normalized}\n`);
  for (const dep of Object.keys(pkg.dependencies ?? {})) visit(dep, directory);
}
for (const name of Object.keys(root.dependencies)) visit(name);
fs.writeFileSync(
  'THIRD_PARTY_NOTICES.md',
  `# Third-party notices\n\nRuntime JavaScript dependencies used by the renderer and local desktop services.\nElectron distributions also include their own LICENSE and Chromium notices.\n\n${blocks.join('\n')}`,
);
console.log(`Recorded ${seen.size} runtime dependency notices.`);
