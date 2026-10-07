import { spawn } from 'node:child_process';

const children = [
  spawn(process.execPath, ['--watch', 'server/index.js'], { stdio: 'inherit', shell: false }),
  spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['exec', 'vite', '--', '--host', '0.0.0.0'], { stdio: 'inherit', shell: false })
];

function stop(signal = 'SIGTERM') {
  for (const child of children) if (!child.killed) child.kill(signal);
}

process.on('SIGINT', () => { stop('SIGINT'); process.exit(0); });
process.on('SIGTERM', () => { stop(); process.exit(0); });
for (const child of children) child.on('exit', code => { if (code && code !== 0) { stop(); process.exit(code); } });
