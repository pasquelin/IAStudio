/**
 * What an auto-update manifest promises, and what has to sit beside it for that promise to hold.
 *
 * A missing block map does not fail a download — it hangs the client on "Download block maps"
 * instead of degrading to a full one. So the `release` job refuses to publish without them, and
 * this is the rule it applies.
 *
 * The subtlety, measured on the v0.1.0 run of 2026-08-15 rather than assumed: **the two
 * platforms publish block maps differently**. Windows writes `<url>.blockmap` beside the
 * installer and says nothing in the manifest; the Linux AppImage carries its own inside the file
 * and declares `blockMapSize`, which electron-updater reads with a range request. Demanding a
 * separate file for every listed entry — what the job used to do — asks for a file that never had
 * to exist, and refuses every release.
 */

export type ManifestFile = {
  url: string
  /** Declared as `blockMapSize`: the block map travels inside the installer, not beside it. */
  carriesItsOwn: boolean
}

const FILE_ENTRY = /^\s*-\s+url:\s*(.+?)\s*$/
const BLOCK_MAP_SIZE = /^\s+blockMapSize:\s*\d+\s*$/

/** The `files:` entries of a manifest, in order. */
export const manifestFiles = (manifest: string): ManifestFile[] => {
  const files: ManifestFile[] = []

  for (const line of manifest.split('\n')) {
    const url = FILE_ENTRY.exec(line)?.[1]
    if (url !== undefined) {
      files.push({ url, carriesItsOwn: false })
      continue
    }
    // Keys are indented under the entry they belong to, so the open one is always the last.
    const open = files[files.length - 1]
    if (open && BLOCK_MAP_SIZE.test(line)) open.carriesItsOwn = true
  }

  return files
}

// electron-updater never installs a Debian package — `dpkg` does. It appears in the manifest
// because electron-builder lists every artefact it produced, and it publishes no block map at
// all, in either form.
const updatesItself = (url: string) => !url.endsWith('.deb')

/** The `<url>.blockmap` files a manifest requires to be served next to it. */
export const blockMapsExpected = (manifest: string): string[] =>
  manifestFiles(manifest)
    .filter(file => updatesItself(file.url) && !file.carriesItsOwn)
    .map(file => `${file.url}.blockmap`)
