import { spawn } from 'node:child_process';
import electron from 'electron';
const child = spawn(electron, ['.'], {
  stdio: 'inherit',
  env: { ...process.env, VIBE_DEV_URL: 'http://127.0.0.1:5173' },
});
child.on('error', (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on('exit', (code) => {
  process.exitCode = code ?? 1;
});
