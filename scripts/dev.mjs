// `npm run dev`: the database (Docker), the API (live reload), the IFC converter and the web app, together.
// Each takes its port from README §11, or the next free one; Ctrl-C stops them all.
import { execFileSync, spawn } from 'node:child_process';
import net from 'node:net';
import { existsSync } from 'node:fs';

const root = new URL('..', import.meta.url).pathname;
const probe = (port, host) =>
  new Promise((done) => {
    const server = net.createServer().once('error', () => done(false));
    server.listen(port, host, () => server.close(() => done(true)));
  });
const free = async (port) => (await probe(port, '127.0.0.1')) && (await probe(port, '::'));
const next = async (port) => {
  while (!(await free(port))) port += 1;
  return port;
};
const run = (command, args, options = {}) => (execFileSync(command, args, { cwd: root, encoding: 'utf8', ...options }) ?? '').trim();

for (const [dir, how] of [['apps/web/node_modules', 'npm run setup'], ['apps/converter/node_modules', 'npm run setup'], ['apps/api/.venv', 'npm run setup']])
  if (!existsSync(root + dir)) {
    console.log(`First run: installing (${how})…`);
    execFileSync('npm', ['run', 'setup'], { cwd: root, stdio: 'inherit' });
    break;
  }

// the database: ours if it is already up, else on the first free port from 55622
let db;
try {
  db = Number(run('docker', ['compose', 'port', 'db', '5432'], { stdio: ['ignore', 'pipe', 'ignore'] }).split(':').pop());
} catch {}
if (!db) {
  db = await next(55622);
  console.log(`database: starting Postgres on :${db}`);
  run('docker', ['compose', 'up', '-d', '--wait', 'db'], { env: { ...process.env, DB_PORT: String(db) }, stdio: 'inherit' });
}
const api = await next(8000);
const converter = await next(8100);
const web = await next(3000);
const env = {
  ...process.env,
  DATABASE_URL: `postgresql://adnario:adnario@localhost:${db}/adnario`,
  CONVERTER_URL: `http://localhost:${converter}`,
  CONVERTER_PORT: String(converter),
  API_PORT: String(api),
  FORCE_COLOR: '1',
};

const colours = { api: 36, converter: 35, web: 32 };
const children = [];
function start(name, command, args, cwd) {
  const child = spawn(command, args, { cwd: root + cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
  const tag = `\x1b[${colours[name]}m${name.padEnd(9)}\x1b[0m│ `;
  for (const stream of [child.stdout, child.stderr])
    stream.on('data', (data) => process.stdout.write(data.toString().replace(/\n(?!$)/g, `\n${tag}`).replace(/^/, tag)));
  child.on('exit', (code) => {
    console.log(`${tag}stopped (${code ?? 'signal'})`);
    stop();
  });
  children.push(child);
}
let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill('SIGTERM');
  setTimeout(() => process.exit(0), 500);
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);

start('converter', 'node', ['server.js'], 'apps/converter');
start('api', 'uv', ['run', 'uvicorn', 'app.main:app', '--reload', '--reload-dir', 'app', '--timeout-graceful-shutdown', '2', '--port', String(api)], 'apps/api');
start('web', 'npx', ['vite', '--port', String(web), '--strictPort'], 'apps/web');
console.log(`\n  Adnario Estimate → http://localhost:${web}   (API :${api}, converter :${converter}, Postgres :${db})\n`);
