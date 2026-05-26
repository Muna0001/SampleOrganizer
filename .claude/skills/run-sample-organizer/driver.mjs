// REPL driver for SampleOrganizer (Electron + Vite + React).
// Spawns Vite, waits for it, launches Electron via Playwright,
// then reads stdin commands: launch / ss / click / eval / ... / quit.
//
// Designed for agents: wrap in tmux, send-keys commands, capture-pane output.
// Screenshots land in /tmp/sample-organizer-shots/ (override: SCREENSHOT_DIR).

import { _electron as electron } from 'playwright-core';
import { spawn } from 'node:child_process';
import * as readline from 'node:readline';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as net from 'node:net';

const APP_DIR = path.resolve(import.meta.dirname, '../../..');
const SHOT_DIR = process.env.SCREENSHOT_DIR || '/tmp/sample-organizer-shots';
fs.mkdirSync(SHOT_DIR, { recursive: true });

const VITE_PORT = 5173;
const VITE_URL = `http://localhost:${VITE_PORT}`;

// Electron binary location — macOS app bundle vs Linux flat binary.
const electronBin = process.platform === 'darwin'
  ? path.join(APP_DIR, 'node_modules/electron/dist/Electron.app/Contents/MacOS/Electron')
  : path.join(APP_DIR, 'node_modules/electron/dist/electron');

let viteProc = null;
let app = null;
let page = null;

// macOS resolves "localhost" to ::1 first, so `host: '127.0.0.1'` misses
// Vite's default bind. Try both families; succeed if either connects.
function tryHost(port, host) {
  return new Promise(resolve => {
    const s = net.createConnection({ port, host });
    s.once('connect', () => { s.destroy(); resolve(true); });
    s.once('error', () => resolve(false));
  });
}
async function portOpen(port) {
  return (await tryHost(port, '127.0.0.1')) || (await tryHost(port, '::1'));
}

async function waitForVite(timeoutMs = 30_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await portOpen(VITE_PORT)) return true;
    await new Promise(r => setTimeout(r, 250));
  }
  return false;
}

async function startVite() {
  if (await portOpen(VITE_PORT)) {
    console.log('vite already running on', VITE_PORT);
    return;
  }
  viteProc = spawn(path.join(APP_DIR, 'node_modules/.bin/vite'), [], {
    cwd: APP_DIR,
    env: { ...process.env, BROWSER: 'none' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  // Surface vite errors but don't spam stdout — log to file.
  const logPath = '/tmp/sample-organizer-vite.log';
  const log = fs.createWriteStream(logPath, { flags: 'w' });
  viteProc.stdout.pipe(log);
  viteProc.stderr.pipe(log);
  console.log('spawned vite (logs:', logPath + ')');
  if (!(await waitForVite())) throw new Error('vite did not become ready on ' + VITE_URL);
  console.log('vite ready at', VITE_URL);
}

const COMMANDS = {
  async launch() {
    if (app) { console.log('already launched'); return; }
    await startVite();
    app = await electron.launch({
      executablePath: electronBin,
      args: [APP_DIR],
      env: { ...process.env, VITE_DEV_SERVER_URL: VITE_URL },
      timeout: 30_000,
    });
    page = await app.firstWindow();
    // Wait until React has actually mounted — index.html ships an empty #root.
    try {
      await page.waitForFunction(
        () => document.querySelector('#root')?.children?.length > 0,
        { timeout: 15_000 },
      );
    } catch {
      console.log('WARN: #root never populated within 15s — check vite log');
    }
    console.log('launched.', app.windows().length, 'window(s):');
    for (const w of app.windows()) console.log(' ', w.url());
  },

  async ss(name) {
    if (!page) { console.log('ERROR: launch first'); return; }
    const f = path.join(SHOT_DIR, (name || `ss-${Date.now()}`) + '.png');
    await page.screenshot({ path: f });
    console.log('screenshot:', f);
  },

  // DOM-click (page.evaluate) rather than locator.click() — robust against
  // any overlay/coordinate weirdness, and faster.
  async click(sel) {
    if (!page) { console.log('ERROR: launch first'); return; }
    const r = await page.evaluate(s => {
      const el = document.querySelector(s);
      if (!el) return 'NOT_FOUND';
      el.click(); return 'OK';
    }, sel);
    console.log('click', sel, '→', r);
  },

  async 'click-text'(text) {
    if (!page) { console.log('ERROR: launch first'); return; }
    const r = await page.evaluate(t => {
      const els = [...document.querySelectorAll('button, a, [role="button"]')];
      const el = els.find(e => e.textContent?.trim() === t)
              ?? els.find(e => e.textContent?.includes(t));
      if (!el) return 'NOT_FOUND';
      el.click(); return 'OK: ' + el.tagName;
    }, text);
    console.log('click-text', JSON.stringify(text), '→', r);
  },

  async type(text) { if (page) await page.keyboard.type(text, { delay: 30 }); },
  async press(key) { if (page) await page.keyboard.press(key); },

  async wait(sel) {
    if (!page) { console.log('ERROR: launch first'); return; }
    try { await page.waitForSelector(sel, { timeout: 10_000 }); console.log('found:', sel); }
    catch { console.log('TIMEOUT:', sel); }
  },

  async eval(expr) {
    if (!page) { console.log('ERROR: launch first'); return; }
    try { console.log(JSON.stringify(await page.evaluate(expr))); }
    catch (e) { console.log('ERROR:', e.message); }
  },

  async text(sel) {
    if (!page) { console.log('ERROR: launch first'); return; }
    console.log(await page.evaluate(
      s => (s ? document.querySelector(s) : document.body)?.innerText ?? '(null)',
      sel || null));
  },

  // Call an IPC method exposed by preload.js as window.electronAPI.<name>.
  // Args after the name are JSON-parsed; pass [arg1, arg2] for multi-arg calls.
  // Examples:
  //   ipc getStats
  //   ipc getSamples {"search":"","types":[],"genres":[],"favoritesOnly":false,"bpmMin":null,"bpmMax":null}
  //   ipc toggleFavorite 42
  async ipc(line) {
    if (!page) { console.log('ERROR: launch first'); return; }
    const sp = line.indexOf(' ');
    const name = sp === -1 ? line : line.slice(0, sp);
    const argsJson = sp === -1 ? 'null' : line.slice(sp + 1);
    const result = await page.evaluate(
      async ({ name, argsJson }) => {
        const api = window.electronAPI;
        if (!api) return { error: 'window.electronAPI not exposed — preload may have failed' };
        if (typeof api[name] !== 'function') return { error: 'no electronAPI method named ' + name };
        const parsed = JSON.parse(argsJson);
        const args = Array.isArray(parsed) ? parsed : [parsed];
        return await api[name](...args);
      },
      { name, argsJson },
    );
    console.log(JSON.stringify(result));
  },

  async windows() {
    if (!app) { console.log('ERROR: launch first'); return; }
    for (const w of app.windows()) console.log(' ', w.url());
  },

  async quit() {
    if (app) await app.close().catch(() => {});
    app = null; page = null;
    if (viteProc) { viteProc.kill('SIGTERM'); viteProc = null; }
  },

  help() {
    console.log('commands:', Object.keys(COMMANDS).join(', '));
  },
};

// Electron tries to commandeer stdin in some versions — open /dev/stdin
// explicitly to keep readline working under tmux send-keys / piped input.
const stdin = fs.createReadStream(null, { fd: fs.openSync('/dev/stdin', 'r') });
const rl = readline.createInterface({ input: stdin, output: process.stdout, prompt: 'driver> ' });

// Serial command queue: readline fires "line" events faster than async
// commands complete (especially noticeable with piped input). Without
// queueing, "launch\nss\nquit" runs ss before launch finishes.
const queue = [];
let draining = false;
let closeRequested = false;
async function drain() {
  if (draining) return;
  draining = true;
  while (queue.length) {
    const line = queue.shift().trim();
    if (!line) continue;
    const sp = line.indexOf(' ');
    const cmd = sp === -1 ? line : line.slice(0, sp);
    const rest = sp === -1 ? '' : line.slice(sp + 1);
    const fn = COMMANDS[cmd];
    if (!fn) { console.log('unknown:', cmd, '— try: help'); rl.prompt(); continue; }
    try { await fn(rest); } catch (e) { console.log('ERROR:', e.message); }
    if (cmd === 'quit') { rl.close(); process.exit(0); }
    if (!closeRequested) rl.prompt();
  }
  draining = false;
  // If stdin closed (piped input ended), shut down cleanly after the queue drains.
  if (closeRequested) { await COMMANDS.quit(); process.exit(0); }
}
rl.on('line', line => { queue.push(line); drain(); });
rl.on('close', () => { closeRequested = true; if (!draining) drain(); });

console.log('sample-organizer driver — type "help" for commands, "launch" to start');
rl.prompt();
