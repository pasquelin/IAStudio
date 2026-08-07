/**
 * Fetches the ffmpeg and ffprobe the studio ships with, into `resources/ffmpeg/`.
 *
 * The studio carries its own encoder rather than asking for one: an import that needs a proxy
 * or a waveform is not the moment to teach someone what a codec is, and a Homebrew ffmpeg whose
 * library has moved looks installed while refusing to run.
 *
 * Run for the host platform by default, or for another one before packaging it:
 *
 *     node scripts/fetch-ffmpeg.mjs                        # this machine
 *     node scripts/fetch-ffmpeg.mjs --platform win32 --arch x64
 *
 * Extraction goes through `tar`, which reads zip as well as tar.xz on all three platforms —
 * one less dependency for a script that runs before anything is installed.
 *
 * Licences differ per target and that is deliberate: LGPL builds exist for Windows and Linux,
 * none does for macOS. Both are fine here because ffmpeg is spawned as a separate program, but
 * the GPL ones oblige us to offer FFmpeg's sources — hence `SOURCES` in the written notice.
 */
import { execFileSync } from 'node:child_process'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DESTINATION = join(ROOT, 'resources', 'ffmpeg')

const BTBN = 'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest'

/**
 * One entry per packaging target. `members` are paths inside the archive; a single archive
 * carrying both binaries is the common case, and macOS the exception with one each.
 */
const TARGETS = {
  'darwin-arm64': {
    licence: 'GPL-3.0-or-later',
    source: 'https://www.osxexperts.net',
    archives: [
      { url: 'https://www.osxexperts.net/ffmpeg711arm.zip', members: { ffmpeg: 'ffmpeg' } },
      { url: 'https://www.osxexperts.net/ffprobe711arm.zip', members: { ffprobe: 'ffprobe' } },
    ],
  },
  'darwin-x64': {
    licence: 'GPL-3.0-or-later',
    source: 'https://evermeet.cx/ffmpeg/',
    archives: [
      { url: 'https://evermeet.cx/ffmpeg/getrelease/zip', members: { ffmpeg: 'ffmpeg' } },
      { url: 'https://evermeet.cx/ffmpeg/getrelease/ffprobe/zip', members: { ffprobe: 'ffprobe' } },
    ],
  },
  'win32-x64': {
    licence: 'LGPL-2.1-or-later',
    source: 'https://github.com/BtbN/FFmpeg-Builds',
    archives: [
      {
        url: `${BTBN}/ffmpeg-master-latest-win64-lgpl.zip`,
        members: {
          'ffmpeg.exe': 'ffmpeg-master-latest-win64-lgpl/bin/ffmpeg.exe',
          'ffprobe.exe': 'ffmpeg-master-latest-win64-lgpl/bin/ffprobe.exe',
        },
      },
    ],
  },
  'linux-x64': {
    licence: 'LGPL-2.1-or-later',
    source: 'https://github.com/BtbN/FFmpeg-Builds',
    archives: [
      {
        url: `${BTBN}/ffmpeg-master-latest-linux64-lgpl.tar.xz`,
        members: {
          ffmpeg: 'ffmpeg-master-latest-linux64-lgpl/bin/ffmpeg',
          ffprobe: 'ffmpeg-master-latest-linux64-lgpl/bin/ffprobe',
        },
      },
    ],
  },
  'linux-arm64': {
    licence: 'LGPL-2.1-or-later',
    source: 'https://github.com/BtbN/FFmpeg-Builds',
    archives: [
      {
        url: `${BTBN}/ffmpeg-master-latest-linuxarm64-lgpl.tar.xz`,
        members: {
          ffmpeg: 'ffmpeg-master-latest-linuxarm64-lgpl/bin/ffmpeg',
          ffprobe: 'ffmpeg-master-latest-linuxarm64-lgpl/bin/ffprobe',
        },
      },
    ],
  },
}

const SOURCES = 'https://ffmpeg.org/download.html'

function flag(name, fallback) {
  const at = process.argv.indexOf(`--${name}`)
  return at === -1 ? fallback : process.argv[at + 1]
}

async function download(url, into) {
  const response = await fetch(url, { redirect: 'follow' }).catch(cause => {
    throw new Error(`Could not reach ${url}: ${cause.message}`)
  })
  if (!response.ok) throw new Error(`${url} answered ${response.status}`)
  writeFileSync(into, new Uint8Array(await response.arrayBuffer()))
}

/** Extracts one member and lands it under `resources/ffmpeg/` as `name`. */
function extract(archive, member, name, work) {
  // `--strip-components` would need the depth of each member; pulling the exact path and
  // renaming afterwards works the same for a flat zip and for a nested tarball.
  try {
    execFileSync('tar', ['-xf', archive, '-C', work, member], { stdio: 'pipe' })
  } catch (cause) {
    // GNU tar, the default on Linux, reads tarballs only — the zip targets need bsdtar.
    throw new Error(`Could not extract ${member}: ${cause.message}`)
  }
  renameSync(join(work, member), join(DESTINATION, name))
  chmodSync(join(DESTINATION, name), 0o755)
}

/**
 * Puts the binaries for one target in `resources/ffmpeg/`, replacing whatever was there.
 *
 * The folder is emptied first: the names differ per platform (`ffmpeg` vs `ffmpeg.exe`), so
 * fetching for a second target would otherwise leave the first one's binaries behind, and
 * `extraResources` ships the whole folder.
 */
export async function fetchFfmpeg(platform, arch) {
  const key = `${platform}-${arch}`
  const target = TARGETS[key]
  if (!target) {
    throw new Error(`No ffmpeg build declared for ${key}. Known: ${Object.keys(TARGETS).join(', ')}`)
  }

  rmSync(DESTINATION, { recursive: true, force: true })
  mkdirSync(DESTINATION, { recursive: true })
  const work = mkdtempSync(join(tmpdir(), 'scenario-ffmpeg-'))

  try {
    for (const archive of target.archives) {
      const file = join(work, 'archive')
      console.log(`Fetching ${archive.url}`)
      await download(archive.url, file)

      for (const [name, member] of Object.entries(archive.members)) {
        extract(file, member, name, work)
        console.log(`  \u2192 resources/ffmpeg/${name}`)
      }
      rmSync(file)
    }

    writeFileSync(
      join(DESTINATION, 'NOTICE.txt'),
      [
        `FFmpeg for ${key}`,
        `Licence: ${target.licence}`,
        `Build: ${target.source}`,
        `Corresponding sources: ${SOURCES}`,
        '',
        'FFmpeg is a separate program, spawned by Scenario Studio. It is not linked into it.',
        '',
      ].join('\n'),
    )
  } finally {
    rmSync(work, { recursive: true, force: true })
  }

  const binary = join(DESTINATION, platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg')
  if (!existsSync(binary)) throw new Error(`Nothing landed at ${binary}`)

  // Only meaningful when fetching for this machine; a cross-fetched binary cannot be run here.
  if (platform === process.platform && arch === process.arch) {
    console.log(execFileSync(binary, ['-version'], { encoding: 'utf8' }).split('\n')[0])
  }
  return binary
}

// Run directly rather than imported by `before-pack.mjs`.
if (process.argv[1] && process.argv[1].endsWith('fetch-ffmpeg.mjs')) {
  await fetchFfmpeg(flag('platform', process.platform), flag('arch', process.arch)).catch(
    failure => {
      console.error(failure.message)
      process.exit(1)
    },
  )
}
