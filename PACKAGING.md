# Packaging Oh a comber as a standalone app (macOS + Windows)

This project uses [electron-builder](https://www.electron.build/) to produce
standalone installers you can host on your website: a `.dmg` for macOS and an
NSIS setup `.exe` for Windows. Config lives in `electron-builder.yml`;
macOS entitlements in `build/entitlements.mac.plist`; the app icon in
`build/icon.png`.

## TL;DR

```bash
# On a Mac:
npm ci
npm run dist:mac
# → release/OhAComber-1.0.0-arm64.dmg  (Apple Silicon)
# → release/OhAComber-1.0.0-x64.dmg    (Intel)

# On a Windows PC:
npm ci
npm run dist:win
# → release/OhAComber-Setup-1.0.0.exe
```

Or run the **Build macOS + Windows apps** GitHub Actions workflow (Actions tab
→ Run workflow), which builds both platforms in parallel and uploads the
installers as artifacts. Pushing a tag like `v1.0.0` also triggers it.

Upload the installers to your website with three links: "Download for Apple
Silicon", "Download for Intel Mac", and "Download for Windows".

## Signing & notarization (required for distribution)

macOS Gatekeeper blocks unsigned apps downloaded from the internet — users see
*"Oh a comber can't be opened because it is from an unidentified
developer"* and have to right-click → **Open** the first time. To ship without
that hurdle you need to **sign** with a Developer ID certificate and
**notarize** with Apple. Both happen automatically during the build once
credentials are available.

### One-time Apple setup

1. **Join the Apple Developer Program** ($99/year): https://developer.apple.com/programs/
2. **Create a "Developer ID Application" certificate**:
   - Easiest: Xcode → Settings → Accounts → your team → *Manage Certificates*
     → **+** → *Developer ID Application*.
   - Or via https://developer.apple.com/account/resources/certificates
3. **Create an app-specific password** for notarization at
   https://account.apple.com → Sign-In and Security → App-Specific Passwords.
4. **Find your Team ID** (10-character code) at
   https://developer.apple.com/account → Membership details.

### Building locally on a Mac

If the Developer ID certificate is in your login keychain, electron-builder
finds it automatically. Provide notarization credentials via environment
variables:

```bash
export APPLE_ID="you@example.com"
export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"
export APPLE_TEAM_ID="ABCDE12345"
npm run dist:mac
```

Notarization uploads the app to Apple and usually takes 1–10 minutes. When it
finishes, the DMGs in `release/` are ready to publish.

### Building via GitHub Actions

Export your certificate: Keychain Access → find *Developer ID Application:
Your Name* → right-click → Export as `.p12` with a password, then:

```bash
base64 -i certificate.p12 | pbcopy
```

Add these repository secrets (Settings → Secrets and variables → Actions):

| Secret | Value |
|---|---|
| `MAC_CERT_P12_BASE64` | base64 of the exported `.p12` |
| `MAC_CERT_PASSWORD` | password you set when exporting |
| `APPLE_ID` | your Apple ID email |
| `APPLE_APP_SPECIFIC_PASSWORD` | app-specific password from step 3 |
| `APPLE_TEAM_ID` | your 10-character Team ID |

Then run the workflow (or push a `v*` tag) and download the
`OhAComber-macOS` artifact — those DMGs are signed, notarized, and ready
for your website.

### Unsigned builds

If the secrets are missing the workflow still builds an **unsigned** app you can
test yourself. `build/adhoc-sign.js` ad-hoc signs it during packaging, which is
what keeps Gatekeeper on the recoverable "unidentified developer" path — without
it the bundle has no code-signature resource seal and macOS reports the
dead-end *"Oh a comber is damaged and can't be opened"* instead.

To run an unsigned build, drag it to `/Applications`, then either right-click →
**Open** and confirm, or clear the download quarantine flag directly:

```bash
xattr -cr "/Applications/Oh a comber.app"
```

Fine for your own testing; don't ship it to users.

## Windows notes

- The Windows build is currently **unsigned**. Users see a SmartScreen prompt
  ("Windows protected your PC") and click **More info → Run anyway** — a much
  smaller hurdle than macOS Gatekeeper, so shipping unsigned is a reasonable
  way to start. To remove the prompt later, buy a code-signing certificate
  (OV/EV, roughly $100–400/year) or use
  [Azure Trusted Signing](https://azure.microsoft.com/en-us/products/trusted-signing)
  (~$10/month), then wire it into the workflow.
- AIFF preview is macOS-only (it relies on Apple's built-in `afconvert`).
  On Windows, WAV/MP3/FLAC/OGG previews all work; AIFF files still get
  scanned, tagged, and drag-and-dropped into a DAW — they just won't play
  in the built-in previewer.

## Notes

- **Two DMGs, two chips**: `arm64` is for Apple Silicon (M1 and later), `x64`
  for Intel Macs. If you'd rather ship a single download, change the arch list
  in `electron-builder.yml` to `[universal]` — the file is roughly twice as
  large.
- **better-sqlite3** is a native module; electron-builder rebuilds it for
  Electron and keeps it outside the asar archive (`asarUnpack`) so it loads at
  runtime.
- **Versioning**: bump `version` in `package.json` before each release — it's
  baked into the DMG filename and the app's About panel.
- **Auto-updates**: not set up. If you later want the app to update itself
  from your website, electron-updater's
  [generic provider](https://www.electron.build/publish#genericserveroptions)
  works with any static file host.
- The `sample://` AIFF conversion uses macOS's built-in `afconvert`, so AIFF
  playback works in the packaged app with no extra bundling.
