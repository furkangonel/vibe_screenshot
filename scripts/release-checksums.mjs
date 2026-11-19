import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
const files = (await fs.readdir('release')).filter((n) => /\.(dmg|zip|exe|AppImage)$/.test(n)).sort();
if (
  !files.some((n) => n.endsWith('.dmg')) ||
  !files.some((n) => n.endsWith('.exe')) ||
  !files.some((n) => n.endsWith('.AppImage'))
)
  throw new Error('Missing a platform installer.');
const rows = [];
for (const file of files)
  rows.push(
    `${createHash('sha256')
      .update(await fs.readFile(`release/${file}`))
      .digest('hex')}  ${file}`,
  );
await fs.writeFile('release/SHA256SUMS.txt', rows.join('\n') + '\n');
console.log(`Checksums written for ${files.length} release files.`);
