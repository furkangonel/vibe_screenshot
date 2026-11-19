import fs from 'node:fs';
const { version } = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const tag = process.env.GITHUB_REF_NAME;
if (tag !== `v${version}`) throw new Error(`Tag ${tag} must match package version v${version}.`);
if (!fs.readFileSync('CHANGELOG.md', 'utf8').includes(`## ${version}\n`))
  throw new Error('Missing changelog section.');
console.log(`Release version verified: ${tag}`);
