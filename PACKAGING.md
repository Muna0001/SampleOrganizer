# Packaging Sample Organizer as a standalone macOS app

This project uses [electron-builder](https://www.electron.build/) to produce a
standalone `.app` bundled inside a `.dmg` installer that you can host on your
website. Config lives in `electron-builder.yml`; entitlements in
`build/entitlements.mac.plist`; the app icon in `build/icon.png`.

## TL;DR

```bash
# On a Mac:
npm ci
npm run dist:mac
# → release/SampleOrganizer-1.0.0-arm64.dmg  (Apple Silicon)
# → release/SampleOrganizer-1.0.0-x64.dmg    (Intel)
```

Or run the **Build macOS app** GitHub Actions workflow (Actions tab →
"Build macOS app" → Run workflow), which builds on a macOS runner and uploads
the DMGs as artifacts. Pushing a tag like `v1.0.0` also triggers it.

Upload the two DMGs to your website and link them ("Download for Apple
Silicon" / "Download for Intel"). Users drag the app into `/Applications`.

## Signing & notarization (required for distribution)

macOS Gatekeeper blocks unsigned apps downloaded from the internet — users
would see *"Sample Organizer is damaged and can't be opened"*. To distribute
outside the App Store you need to **sign** with a Developer ID certificate and
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
`SampleOrganizer-macOS` artifact — those DMGs are signed, notarized, and ready
for your website.

If the secrets are missing the workflow still builds an **unsigned** app you
can test yourself (right-click → Open the first time, or
`xattr -dc "/Applications/Sample Organizer.app"`), but don't ship that to
users.

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
