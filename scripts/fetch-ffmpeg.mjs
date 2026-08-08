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
 * Extraction goes through `tar`, then `unzip` if that fails: bsdtar reads zip (macOS, and
 * Windows since 10/1803) while GNU tar, the default on Linux, reads tarballs only — and the
 * Windows and macOS targets are zips, which a Linux CI has every reason to fetch.
 *
 * Licences differ per target and that is deliberate: LGPL builds exist for Windows and Linux,
 * none does for macOS. Both are fine here because ffmpeg is spawned as a separate program, but
 * the GPL ones oblige us to offer FFmpeg's sources — hence `SOURCES` in the written notice.
 *
 * Every URL is pinned to a version and every extracted binary is checked against a recorded
 * digest: two builds of the same tag must ship the same encoder. Rotating a build means changing
 * the URL *and* the digest, which `--digests` prints:
 *
 *     node scripts/fetch-ffmpeg.mjs --digests
 */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DESTINATION = join(ROOT, 'resources', 'ffmpeg')

// A dated autobuild, not the rolling `latest` tag: `latest` moves under a pinned URL.
const BTBN = 'https://github.com/BtbN/FFmpeg-Builds/releases/download/autobuild-2026-08-07-13-13'
const BTBN_VERSION = '7.1.5'
const BTBN_BUILD = 'ffmpeg-n7.1.5-12-g1fdbca85aa'

/**
 * One entry per packaging target. `members` are paths inside the archive; a single archive
 * carrying both binaries is the common case, and macOS the exception with one each. `digests`
 * are sha256 of the *extracted* binaries, so recompression by a mirror does not invalidate them.
 *
 * All five targets sit on the 7.1 series on purpose: ffmpeg drops and renames CLI options
 * between majors, and `src/main/media/runner.ts` builds one command line for every platform.
 */
export const TARGETS = {
  'darwin-arm64': {
    version: '7.1.1',
    licence: 'GPL-3.0-or-later',
    source: 'https://www.osxexperts.net',
    archives: [
      { url: 'https://www.osxexperts.net/ffmpeg711arm.zip', members: { ffmpeg: 'ffmpeg' } },
      { url: 'https://www.osxexperts.net/ffprobe711arm.zip', members: { ffprobe: 'ffprobe' } },
    ],
    digests: {
      ffmpeg: '011221d75eae36943b5a6a28f70e25928cfb5602fe616d06da0a3b9b55ff6b75',
      ffprobe: 'ae77d6751f4db81098a11dcc966a8d098925411430169475c8f8a7bfad76188b',
    },
  },
  'darwin-x64': {
    version: '7.1.1',
    licence: 'GPL-3.0-or-later',
    source: 'https://evermeet.cx/ffmpeg/',
    archives: [
      { url: 'https://evermeet.cx/ffmpeg/ffmpeg-7.1.1.zip', members: { ffmpeg: 'ffmpeg' } },
      { url: 'https://evermeet.cx/ffmpeg/ffprobe-7.1.1.zip', members: { ffprobe: 'ffprobe' } },
    ],
    digests: {
      ffmpeg: '23fb76dd559e155e49b9808b86ab5117f297b76294a798e4ef6cbb12fd15a689',
      ffprobe: 'f7928a29c68c15cad6ef95b759d40477e3c97a3e74ff8ca69412d09f5889e9f6',
    },
  },
  'win32-x64': {
    version: BTBN_VERSION,
    licence: 'LGPL-2.1-or-later',
    source: 'https://github.com/BtbN/FFmpeg-Builds',
    archives: [
      {
        url: `${BTBN}/${BTBN_BUILD}-win64-lgpl-7.1.zip`,
        members: {
          'ffmpeg.exe': `${BTBN_BUILD}-win64-lgpl-7.1/bin/ffmpeg.exe`,
          'ffprobe.exe': `${BTBN_BUILD}-win64-lgpl-7.1/bin/ffprobe.exe`,
        },
      },
    ],
    digests: {
      'ffmpeg.exe': '7f1699cebe0cf8ce516ca07e344aec1daeb6ee327406210bfeba93d73d79f881',
      'ffprobe.exe': '4ef8134fd69e58f47760f7096abcd2400907cb273fa661ed48804599787aa20f',
    },
  },
  'linux-x64': {
    version: BTBN_VERSION,
    licence: 'LGPL-2.1-or-later',
    source: 'https://github.com/BtbN/FFmpeg-Builds',
    archives: [
      {
        url: `${BTBN}/${BTBN_BUILD}-linux64-lgpl-7.1.tar.xz`,
        members: {
          ffmpeg: `${BTBN_BUILD}-linux64-lgpl-7.1/bin/ffmpeg`,
          ffprobe: `${BTBN_BUILD}-linux64-lgpl-7.1/bin/ffprobe`,
        },
      },
    ],
    digests: {
      ffmpeg: '2906d9c9562208328105521968b98688112c3e9c31b65b5f29bfda0593b3de4a',
      ffprobe: '84412194eb4b87ca0dfe763843a2bb45b51e06042e7128b741c1b6c5a89d04f3',
    },
  },
  'linux-arm64': {
    version: BTBN_VERSION,
    licence: 'LGPL-2.1-or-later',
    source: 'https://github.com/BtbN/FFmpeg-Builds',
    archives: [
      {
        url: `${BTBN}/${BTBN_BUILD}-linuxarm64-lgpl-7.1.tar.xz`,
        members: {
          ffmpeg: `${BTBN_BUILD}-linuxarm64-lgpl-7.1/bin/ffmpeg`,
          ffprobe: `${BTBN_BUILD}-linuxarm64-lgpl-7.1/bin/ffprobe`,
        },
      },
    ],
    digests: {
      ffmpeg: '250065a03c052955963e3ff6724262e5fbffdc0d0325b08f62e2d04571ee4d1a',
      ffprobe: 'b11d18c6d1a56a66ca75b1b14a3f831b70d6a4c3d1f7d95a9b7c3358e84343c0',
    },
  },
}

export const SOURCES = 'https://ffmpeg.org/download.html'

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

/** Pulls one member out of the archive into `work`, and answers where it landed. */
function extract(archive, member, work) {
  // `--strip-components` would need the depth of each member; pulling the exact path and
  // renaming afterwards works the same for a flat zip and for a nested tarball.
  const attempts = [
    ['tar', ['-xf', archive, '-C', work, member]],
    ['unzip', ['-o', archive, member, '-d', work]],
  ]

  const failures = []
  for (const [tool, args] of attempts) {
    try {
      execFileSync(tool, args, { stdio: 'pipe' })
      // Left where it landed, still not executable. The caller checks its digest and only then
      // moves it into place: nothing unverified is ever runnable at the path the app spawns.
      return join(work, member)
    } catch (cause) {
      failures.push(`${tool}: ${cause.message}`)
    }
  }
  throw new Error(`Could not extract ${member} from ${archive}\n${failures.join('\n')}`)
}

function digestOf(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex')
}

/**
 * Puts the binaries for one target in `resources/ffmpeg/`, replacing whatever was there.
 *
 * The folder is emptied first: the names differ per platform (`ffmpeg` vs `ffmpeg.exe`), so
 * fetching for a second target would otherwise leave the first one's binaries behind, and
 * `extraResources` ships the whole folder.
 */
export async function fetchFfmpeg(platform, arch, options = {}) {
  const key = `${platform}-${arch}`
  const target = TARGETS[key]
  if (!target) {
    throw new Error(
      `No ffmpeg build declared for ${key}. Known: ${Object.keys(TARGETS).join(', ')}`,
    )
  }

  const destination = options.destination ?? DESTINATION
  const verify = options.verify ?? true
  const seen = {}

  rmSync(destination, { recursive: true, force: true })
  mkdirSync(destination, { recursive: true })
  const work = mkdtempSync(join(tmpdir(), 'scenario-ffmpeg-'))

  try {
    for (const archive of target.archives) {
      const file = join(work, 'archive')
      console.log(`Fetching ${archive.url}`)
      await download(archive.url, file)

      for (const [name, member] of Object.entries(archive.members)) {
        const extracted = extract(file, member, work)
        seen[name] = digestOf(extracted)

        if (verify) {
          const expected = target.digests[name]
          if (!expected) throw new Error(`No digest recorded for ${key}/${name}`)
          if (expected !== seen[name]) {
            throw new Error(
              `${key}/${name} does not match its recorded digest.\n` +
                `  expected ${expected}\n  got      ${seen[name]}\n` +
                `Rotate deliberately: update the URL and rerun with --digests.`,
            )
          }
        }

        renameSync(extracted, join(destination, name))
        chmodSync(join(destination, name), 0o755)
        console.log(`  \u2192 ${name} ${seen[name].slice(0, 12)}`)
      }
      rmSync(file)
    }

    writeFileSync(
      join(destination, 'NOTICE.txt'),
      [
        `FFmpeg ${target.version} for ${key}`,
        `Licence: ${target.licence}`,
        `Build: ${target.source}`,
        `Corresponding sources: ${SOURCES}`,
        '',
        'FFmpeg is a separate program, spawned by Scenario Studio. It is not linked into it.',
        '',
      ].join('\n'),
    )
  } catch (failure) {
    // Half a fetch looks like a whole one: an `ffmpeg` without its `ffprobe` resolves fine and
    // then fails per file. Leave nothing rather than something that reads as complete.
    rmSync(destination, { recursive: true, force: true })
    throw failure
  } finally {
    rmSync(work, { recursive: true, force: true })
  }

  const binary = join(destination, platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg')
  if (!existsSync(binary)) throw new Error(`Nothing landed at ${binary}`)

  // Only meaningful when fetching for this machine; a cross-fetched binary cannot be run here.
  if (platform === process.platform && arch === process.arch) {
    console.log(execFileSync(binary, ['-version'], { encoding: 'utf8' }).split('\n')[0])
  }
  return seen
}

/** Fetches every target into a scratch folder and prints what to paste back into `TARGETS`. */
async function printDigests() {
  const scratch = mkdtempSync(join(tmpdir(), 'scenario-ffmpeg-digests-'))
  try {
    for (const key of Object.keys(TARGETS)) {
      const [platform, arch] = key.split('-')
      const digests = await fetchFfmpeg(platform, arch, {
        destination: join(scratch, key),
        verify: false,
      })
      // Keys stay quoted: `ffmpeg.exe` is not a valid identifier, and the output is pasted back.
      const lines = Object.entries(digests).map(([name, hex]) => `      '${name}': '${hex}',`)
      console.log(`\n${key}:\n    digests: {\n${lines.join('\n')}\n    },`)
    }
  } finally {
    rmSync(scratch, { recursive: true, force: true })
  }
}

// Run directly rather than imported by `before-pack.mjs`.
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const run = process.argv.includes('--digests')
    ? printDigests()
    : fetchFfmpeg(flag('platform', process.platform), flag('arch', process.arch))

  await run.catch(failure => {
    console.error(failure.message)
    process.exit(1)
  })
}
