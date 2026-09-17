// electron-builder afterPack hook: ad-hoc sign unsigned macOS builds.
//
// Without a Developer ID certificate, electron-builder skips code signing
// entirely. The bundle then keeps the Electron binary's original linker-signed
// ad-hoc signature but has no _CodeSignature resource seal, so macOS rejects it
// with "code has no resources but signature indicates they must be present" and
// tells the user *"Oh a comber is damaged and can't be opened"* — a hard block
// with no right-click → Open escape hatch.
//
// Re-signing ad-hoc writes a proper resource seal. The app is still unsigned as
// far as Apple is concerned, so Gatekeeper still blocks a downloaded copy — but
// with the ordinary "unidentified developer" prompt that right-click → Open
// clears, instead of the dead-end "damaged" error.
//
// Why afterPack and not afterSign: afterPack runs *before* electron-builder's
// own signing step, so in a properly signed build the real Developer ID
// signature is applied afterwards with --force and replaces this one. afterSign
// would be the tidier hook point, but electron-builder skips it entirely when
// no signing occurred — which is precisely the case this hook exists for.
//
// Note: signing without --options runtime is deliberate. Hardened runtime under
// an ad-hoc signature enables library validation, which would refuse to load
// better-sqlite3's unsigned .node binary. Properly signed builds still get
// hardened runtime via the `mac.hardenedRuntime` setting in electron-builder.yml.

const { execFileSync } = require("node:child_process");
const path = require("node:path");

// True only when the bundle carries a signature macOS will actually accept.
// At afterPack time nothing has been signed yet, so this is effectively always
// false today; it is kept as a guard against electron-builder reordering its
// hooks, so a future real signature is never clobbered with an ad-hoc one.
function isProperlySigned(appPath) {
  try {
    execFileSync("codesign", ["--verify", "--deep", "--strict", appPath], {
      stdio: "pipe",
    });
    return true;
  } catch {
    return false;
  }
}

exports.default = async function adhocSign(context) {
  if (context.electronPlatformName !== "darwin") return;

  const appPath = path.join(
    context.appOutDir,
    `${context.packager.appInfo.productFilename}.app`
  );

  if (isProperlySigned(appPath)) {
    console.log("  • signature valid, skipping ad-hoc signing");
    return;
  }

  console.log(`  • ad-hoc signing unsigned build  path=${appPath}`);
  execFileSync("codesign", ["--force", "--deep", "--sign", "-", appPath], {
    stdio: "inherit",
  });
};
