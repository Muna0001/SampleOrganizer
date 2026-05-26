---
name: run-sample-organizer
description: Build, run, drive, and screenshot the SampleOrganizer Electron app (Vite + React + better-sqlite3). Use when asked to start the app, open it, take a screenshot, click around the UI, exercise its IPC handlers, or verify a change works locally.
---

SampleOrganizer is an Electron desktop app (Vite + React renderer, better-sqlite3 main). Tested on **macOS only** — the app uses `afconvert` for AIFF → WAV conversion (macOS-only binary).

The agent path is a Playwright REPL driver at `.claude/skills/run-sample-organizer/driver.mjs`. It spawns Vite, launches Electron via Playwright's `_electron`, and reads commands from stdin (`launch`, `ss`, `click-text`, `ipc`, `eval`, `quit`).

All paths below are relative to the repo root.

## Prerequisites

- macOS (the `afconvert` audio-conversion code path in `electron/main.js` is macOS-only).
- Node ≥ 20 (verified on v25.9.0).
- `npm` resolves from `/opt/homebrew/bin` on Apple Silicon — prepend it if running from a non-login shell:

  ```bash
  export PATH=/opt/homebrew/bin:$PATH
  ```

No `xvfb`, no extra system packages — macOS gives Electron a real display.

## Setup

```bash
npm install         # postinstall runs electron-rebuild for better-sqlite3
```

If `better-sqlite3` complains about NODE_MODULE_VERSION later:

```bash
npm run rebuild
```

`playwright-core` is already a devDependency (used by the driver).

## Run (agent path)

```bash
node .claude/skills/run-sample-organizer/driver.mjs
```

The driver prompts `driver> ` on stdin. Drive it interactively, or pipe a script:

```bash
printf 'launch\nss landing\nipc getStats\nquit\n' \
  | node .claude/skills/run-sample-organizer/driver.mjs
```

Screenshots land in `/tmp/sample-organizer-shots/` (override with `SCREENSHOT_DIR`). Vite logs go to `/tmp/sample-organizer-vite.log`.

### Commands

| command | what it does |
|---|---|
| `launch` | spawn Vite, launch Electron via Playwright, wait for React mount |
| `ss [name]` | screenshot the window → `/tmp/sample-organizer-shots/<name>.png` |
| `click <css-sel>` | DOM-click an element (uses `el.click()`, not coords) |
| `click-text <text>` | click first `<button>`/`<a>` whose text matches |
| `type <text>` | type into focused field |
| `press <key>` | keypress (e.g. `press Enter`, `press ArrowDown`) |
| `wait <css-sel>` | wait up to 10s for selector |
| `eval <js>` | run JS in renderer, print JSON result |
| `text [css-sel]` | innerText of selector (or body) |
| `ipc <name> [json]` | call `window.electronAPI.<name>(...args)`. JSON arg may be a single value or `[a, b, c]`. |
| `windows` | list all Electron windows + URLs |
| `quit` | close Electron, kill Vite, exit |

### Verified flow

These commands were exercised end-to-end:

```
launch                                 → vite + electron come up, React mounts
ipc getStats                           → {"total":13815,"types":[…],"genres":[…],…}
click-text Scan Library                → OK: BUTTON  (opens native folder picker)
ss after-scan-click                    → /tmp/sample-organizer-shots/after-scan-click.png
quit                                   → clean shutdown
```

## Run (human path)

```bash
PATH=/opt/homebrew/bin:$PATH npm run dev
```

`concurrently` spawns Vite then Electron. Window opens; Ctrl-C to quit. Useless for agents — there's no programmatic handle on the running app.

## Gotchas

- **Vite binds to IPv6 (`::1`), not IPv4.** Naive `net.createConnection({ host: '127.0.0.1', port: 5173 })` returns ECONNREFUSED on macOS even when Vite is up. The driver's `portOpen` tries both `127.0.0.1` and `::1` — keep that if you rewrite it.
- **Electron's `main.js` always re-opens the saved DB.** It lives at `~/Library/Application Support/sample-organizer/samples.db` and is **not** isolated per Playwright launch. The driver shares whatever state the human-mode app left behind (16k+ samples from prior scans). If you need a clean state, delete the DB file before `launch`.
- **`ERR_FILE_NOT_FOUND` flooding stderr is *not* a launch failure.** The renderer asks for audio via the custom `sample://` protocol for every row; if the DB has rows whose underlying files moved/were deleted, every preview request logs this error. The UI renders correctly regardless.
- **The IPC bridge is `window.electronAPI`, not `window.electron`.** Method names match `electron/preload.js` exactly (camelCase): `getStats`, `getSamples`, `scanLibrary`, `toggleFavorite`, `updateTags`, `selectFolder`, `showInFolder`. The `ipc` command in the driver targets this bridge.
- **`Scan Library` opens a native (modal-ish) folder picker.** A click via the driver returns immediately but the OS dialog is now in front of the window. Subsequent screenshots may capture the app *behind* the dialog. Either dismiss it via OS-level means or avoid `click-text Scan Library` in screenshot-driven flows — use the `ipc scanLibrary "/path/to/folder"` form to bypass the picker.
- **Renderer stdin/`document.title` only — no DevTools by default.** Add `mainWindow.webContents.openDevTools()` to `electron/main.js` while debugging, or use `eval` from the driver to inspect state.

## Troubleshooting

- **`vite did not become ready on http://localhost:5173`**: another process holds 5173. Find and kill it: `lsof -i :5173 | awk '/LISTEN/{print $2}' | xargs kill`.
- **`Error: ENOENT: ... afconvert`**: you're not on macOS. The app calls `afconvert` for AIFF preview; non-macOS playback of AIFF will fail (other formats still work).
- **`NODE_MODULE_VERSION` mismatch from `better-sqlite3`** after a Node/Electron upgrade: `npm run rebuild`.
- **Driver hangs after `launch`**: check `/tmp/sample-organizer-vite.log` — if Vite crashed (port collision, missing dep), the driver waits 30s then errors. Clear the port and retry.
- **Stale Electron processes from a previous run**: `pkill -f 'SampleOrganizer/node_modules/electron'; pkill -f 'SampleOrganizer/node_modules/.bin/vite'`.
