import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const cwd = fileURLToPath(new URL('../', import.meta.url));
const children = [];
let stopping = false;

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  for (const child of children) {
    if (!child.pid || child.exitCode !== null) continue;
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], { windowsHide: true, stdio: 'ignore' });
    } else {
      child.kill('SIGTERM');
    }
  }
}

function run(name, args) {
  const child = spawn(process.execPath, args, { cwd, stdio: 'inherit', windowsHide: true });
  children.push(child);
  child.on('error', () => {
    console.error(`${name} could not start.`);
    stop(1);
  });
  child.on('exit', code => {
    if (!stopping) {
      console.log(`${name} stopped; shutting down both services.`);
      stop(code ?? 1);
    }
  });
}

process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());

console.log('Starting API and frontend at http://localhost:8100. Press Ctrl+C to stop both.');
run('API', ['--watch', '--env-file=server/.env', 'server/index.mjs', '--phone-number-login']);
run('Frontend', ['node_modules/@angular/cli/bin/ng.js', 'serve', '--port', '8100']);
