import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const platform = process.platform;
const executable =
  platform === 'darwin'
    ? path.resolve(
        `release/mac${process.arch === 'arm64' ? '-arm64' : ''}/Vibe Screenshots.app/Contents/MacOS/Vibe Screenshots`,
      )
    : platform === 'win32'
      ? path.resolve('release/win-unpacked/Vibe Screenshots.exe')
      : path.resolve('release/linux-unpacked/vibe-screenshots');
if (!fs.existsSync(executable)) throw new Error(`Packaged executable not found: ${executable}`);
for (const script of ['scripts/desktop-smoke.mjs', 'scripts/mcp-smoke.mjs']) {
  const result = spawnSync(
    platform === 'linux' ? 'xvfb-run' : process.execPath,
    platform === 'linux' ? ['-a', process.execPath, script] : [script],
    { stdio: 'inherit', env: { ...process.env, VIBE_PACKAGED_EXECUTABLE: executable } },
  );
  if (result.status !== 0) process.exit(result.status || 1);
}
