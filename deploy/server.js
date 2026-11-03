// ─────────────────────────────────────────────────────────────────────────────
// Entry point of the live system at https://attedance.shulepoa.co.ke
// (cPanel CloudLinux Node.js app, run by Passenger).
//
// Passenger only runs one Node process per app, so this file starts the rest:
//   • the five FastAPI services (gateway, school, device, attendance,
//     notification) from backend/ with the Python venv in venv/
//   • the built Next.js website from web/ (Next "standalone" output)
// all on 127.0.0.1 ports, and answers the public port itself:
//   /api/*, /ws/*  → API gateway        everything else → website
//
// Settings come from .env next to this file (see deploy/env.example). Child
// output goes to logs/<name>.log. Children whose parent was killed outright are
// cleaned up on the next start through tmp/children.pid.
// No npm dependencies — only Node's own modules.
// ─────────────────────────────────────────────────────────────────────────────
'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const net = require('net');
const { spawn } = require('child_process');

const ROOT = __dirname;
const LOGS = path.join(ROOT, 'logs');
const PIDFILE = path.join(ROOT, 'tmp', 'children.pid');
fs.mkdirSync(LOGS, { recursive: true });
fs.mkdirSync(path.dirname(PIDFILE), { recursive: true });

function log(msg) {
  fs.appendFileSync(path.join(LOGS, 'server.log'), `${new Date().toISOString()} ${msg}\n`);
}

// ── settings ────────────────────────────────────────────────────────────────
function readEnv(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const i = line.indexOf('=');
    let v = line.slice(i + 1).trim();
    if (/^(['"]).*\1$/.test(v)) v = v.slice(1, -1);
    out[line.slice(0, i).trim()] = v;
  }
  return out;
}
const env = { ...readEnv(path.join(ROOT, '.env')), ...process.env };

const BASE = parseInt(env.INTERNAL_PORT_BASE || '38100', 10);
const PORTS = {
  gateway: BASE, school: BASE + 1, device: BASE + 2, attendance: BASE + 3, notification: BASE + 4, web: BASE + 10,
};
const local = (p) => `http://127.0.0.1:${p}`;
const PYTHON = env.PYTHON || path.join(ROOT, 'venv', 'bin', 'python');

// What every Python service sees: the .env plus the internal addresses.
const pyEnv = {
  ...env,
  SCHOOL_SERVICE_URL: local(PORTS.school),
  DEVICE_SERVICE_URL: local(PORTS.device),
  ATTENDANCE_SERVICE_URL: local(PORTS.attendance),
  NOTIFICATION_SERVICE_URL: local(PORTS.notification),
  API_GATEWAY_URL: local(PORTS.gateway),
  PYTHONUNBUFFERED: '1',
};
delete pyEnv.PORT; // Passenger's port is ours, not theirs

const SERVICES = [
  ['gateway', 'api_gateway'], ['school', 'school_service'], ['device', 'device_service'],
  ['attendance', 'attendance_service'], ['notification', 'notification_service'],
].map(([name, dir]) => ({
  name,
  cmd: PYTHON,
  args: ['-m', 'uvicorn', 'main:app', '--host', '127.0.0.1', '--port', String(PORTS[name]), '--no-access-log'],
  cwd: path.join(ROOT, 'backend', dir),
  env: pyEnv,
  health: `${local(PORTS[name])}/health`,
}));
SERVICES.push({
  name: 'web',
  cmd: process.execPath,
  args: ['server.js'],
  cwd: path.join(ROOT, 'web'),
  env: { ...env, NODE_ENV: 'production', PORT: String(PORTS.web), HOSTNAME: '127.0.0.1' },
  health: `${local(PORTS.web)}/login`,
});

// ── children ────────────────────────────────────────────────────────────────
function killLeftovers() {
  if (!fs.existsSync(PIDFILE)) return;
  for (const pid of fs.readFileSync(PIDFILE, 'utf8').split(/\s+/).filter(Boolean).map(Number)) {
    try { process.kill(-pid, 'SIGTERM'); } catch { /* already gone */ }
  }
  fs.rmSync(PIDFILE, { force: true });
}

const running = new Map();
let stopping = false;

function writePids() {
  fs.writeFileSync(PIDFILE, [...running.values()].map((c) => c.pid).join('\n'));
}

function start(svc, attempt = 0) {
  const out = fs.openSync(path.join(LOGS, `${svc.name}.log`), 'a');
  // detached: each child leads its own process group, so killLeftovers() can
  // take down uvicorn's workers with it.
  const child = spawn(svc.cmd, svc.args, { cwd: svc.cwd, env: svc.env, stdio: ['ignore', out, out], detached: true });
  fs.closeSync(out);
  running.set(svc.name, child);
  writePids();
  const startedAt = Date.now();
  child.on('exit', (code, signal) => {
    running.delete(svc.name);
    writePids();
    if (stopping) return;
    // Back off when it keeps dying straight away (bad .env, port taken, …).
    const next = Date.now() - startedAt > 60_000 ? 0 : attempt + 1;
    const delay = Math.min(30_000, 1000 * 2 ** next);
    log(`${svc.name} exited (${signal || code}); restarting in ${delay / 1000}s`);
    setTimeout(() => start(svc, next), delay);
  });
}

function stopAll() {
  stopping = true;
  for (const child of running.values()) {
    try { process.kill(-child.pid, 'SIGTERM'); } catch { /* gone */ }
  }
  fs.rmSync(PIDFILE, { force: true });
}
process.on('exit', stopAll);
for (const sig of ['SIGTERM', 'SIGINT', 'SIGHUP']) process.on(sig, () => { stopAll(); process.exit(0); });

// ── readiness ───────────────────────────────────────────────────────────────
function ping(url) {
  return new Promise((resolve) => {
    const req = http.get(url, { timeout: 3000 }, (res) => { res.resume(); resolve(res.statusCode < 500); });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

const ready = {};
async function watchReady() {
  for (;;) {
    for (const svc of SERVICES) ready[svc.name] = await ping(svc.health);
    await new Promise((r) => setTimeout(r, Object.values(ready).every(Boolean) ? 15_000 : 1000));
  }
}

// Holds a request until its upstream answers health checks (first boot takes a
// few seconds), instead of failing it.
async function whenReady(name, ms = 90_000) {
  const until = Date.now() + ms;
  while (!ready[name] && Date.now() < until) await new Promise((r) => setTimeout(r, 300));
  return ready[name];
}

// ── public server ───────────────────────────────────────────────────────────
const toGateway = (url) => url.startsWith('/api/') || url === '/api' || url.startsWith('/ws/');

const server = http.createServer(async (req, res) => {
  if (req.url === '/health') {
    const ok = Object.values(ready).every(Boolean) && Object.keys(ready).length === SERVICES.length;
    res.writeHead(ok ? 200 : 503, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ status: ok ? 'healthy' : 'starting', services: ready }));
  }
  // ZKTeco terminals in cloud mode (Menu → Comm → Cloud Server Setting) poll
  // /iclock/* every few seconds; they go straight to the device service.
  const target = req.url.startsWith('/iclock/') || req.url.startsWith('/iclock?')
    ? 'device' : toGateway(req.url) ? 'gateway' : 'web';
  if (!(await whenReady(target))) {
    res.writeHead(503, { 'content-type': 'text/plain', 'retry-after': '10' });
    return res.end('The system is starting up. Please try again in a moment.');
  }
  const headers = {
    ...req.headers,
    'x-forwarded-for': req.headers['x-forwarded-for'] || req.socket.remoteAddress,
    'x-forwarded-proto': req.headers['x-forwarded-proto'] || 'https',
    'x-forwarded-host': req.headers['x-forwarded-host'] || req.headers.host,
  };
  const upstream = http.request(
    { host: '127.0.0.1', port: PORTS[target], method: req.method, path: req.url, headers },
    (up) => { res.writeHead(up.statusCode, up.headers); up.pipe(res); },
  );
  upstream.on('error', (err) => {
    log(`proxy ${target} ${req.method} ${req.url}: ${err.message}`);
    if (!res.headersSent) res.writeHead(502, { 'content-type': 'text/plain' });
    res.end('Service temporarily unavailable.');
  });
  req.pipe(upstream);
});

// WebSockets (/ws/*): hand the raw socket to the gateway after replaying the
// upgrade request.
server.on('upgrade', async (req, socket, head) => {
  if (!req.url.startsWith('/ws/') || !(await whenReady('gateway', 30_000))) return socket.destroy();
  const up = net.connect(PORTS.gateway, '127.0.0.1', () => {
    const lines = [`${req.method} ${req.url} HTTP/${req.httpVersion}`];
    for (let i = 0; i < req.rawHeaders.length; i += 2) lines.push(`${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}`);
    up.write(lines.join('\r\n') + '\r\n\r\n');
    if (head && head.length) up.write(head);
    up.pipe(socket).pipe(up);
  });
  up.on('error', () => socket.destroy());
  socket.on('error', () => up.destroy());
});

killLeftovers();
SERVICES.forEach((svc) => start(svc));
watchReady();
server.listen(env.PORT || 3000, () => log(`listening on ${env.PORT || 3000}; internal ports from ${BASE}`));
