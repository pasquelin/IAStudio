/**
 * Gives the development run the product's name instead of Electron's.
 *
 * macOS reads the menu bar title and the Dock label from the running bundle, never from
 * `app.setName()`. Unpackaged, that bundle is `node_modules/.../Electron.app`, so the studio
 * shows up as "Electron" until this rewrites its Info.plist. A packaged build is unaffected —
 * electron-builder writes the real bundle from `productName`.
 *
 * Runs on postinstall because pnpm re-extracts the bundle whenever Electron is reinstalled.
 * The icon has no equivalent problem: `app.dock.setIcon` handles it at runtime.
 */
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

const PRODUCT_NAME = 'Scenario Studio'
const PLIST_BUDDY = '/usr/libexec/PlistBuddy'

if (process.platform !== 'darwin') process.exit(0)

const binary = createRequire(import.meta.url)('electron')
if (typeof binary !== 'string') {
  // Electron resolves to its own module when required inside a running app; on the CLI it is
  // the path to the binary. Anything else means there is no bundle to rename.
  process.exit(0)
}

// <bundle>/Contents/MacOS/Electron → <bundle>
const bundle = dirname(dirname(dirname(binary)))
const plist = join(bundle, 'Contents', 'Info.plist')

const plistBuddy = command => execFileSync(PLIST_BUDDY, ['-c', command, plist], { encoding: 'utf8' })

try {
  if (plistBuddy('Print :CFBundleName').trim() === PRODUCT_NAME) process.exit(0)

  plistBuddy(`Set :CFBundleName ${PRODUCT_NAME}`)
  plistBuddy(`Set :CFBundleDisplayName ${PRODUCT_NAME}`)

  // Editing a bundle breaks its ad-hoc signature, and macOS refuses to launch what no longer
  // matches its own seal. Re-sealing ad-hoc is what keeps `pnpm start` working.
  execFileSync('codesign', ['--force', '--sign', '-', bundle], { stdio: 'ignore' })

  console.log(`[dev-app-identity] ${bundle} now runs as "${PRODUCT_NAME}"`)
} catch (error) {
  // Never fail an install over a cosmetic name: the app runs either way.
  console.warn(`[dev-app-identity] skipped — ${error instanceof Error ? error.message : error}`)
}
