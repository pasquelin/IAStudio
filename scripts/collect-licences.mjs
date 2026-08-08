/**
 * Collects the licence of everything the studio redistributes into `src/shared/licences.json`,
 * which the Help ▸ Licences window reads, and into `THIRD-PARTY-NOTICES.md` for readers of the
 * repository and the release page.
 *
 * The list is spelled out rather than derived from `dependencies`: this project bundles React,
 * zustand, dockview and the rest with Vite, so they sit in `devDependencies` while shipping in
 * the binary all the same. Deriving from the manifest would quietly omit most of the notice.
 * `licence.test.ts` fails if a runtime dependency is added without landing here.
 *
 * The texts themselves are read from `node_modules`, never copied by hand — a version bump
 * brings its own wording.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { sourceArchives as FFMPEG_SOURCES, TARGETS as FFMPEG_TARGETS } from './fetch-ffmpeg.mjs'
// A `.ts` from a `.mjs`: Node 24 strips the types on the way in. Worth the novelty here — the
// rule that decides who owes a source offer must be the one the tests check, not a twin of it.
import { isCopyleft } from '../src/shared/domain/licence.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUTPUT = join(ROOT, 'src', 'shared', 'licences.json')
const NOTICES = join(ROOT, 'THIRD-PARTY-NOTICES.md')

/**
 * Everything that reaches a user's disk: bundled by Vite, loaded at runtime, or shipped beside.
 * Not here on purpose: eslint, prettier, vitest, typescript, electron-builder and the `@types`
 * — a build tool never leaves the machine that ran it.
 */
const SHIPPED = [
  // Runtime dependencies, loaded from `node_modules` by the main process.
  '@mdi/js',
  '@mdi/react',
  '@scenario-labs/sdk',
  'better-sqlite3',
  'electron-store',
  'electron-updater',
  'mediabunny',
  'opentype.js',
  'pixi.js',
  'three',
  'three-mesh-bvh',
  // The runtime itself.
  'electron',
  // Bundled into the renderer by Vite, hence in `devDependencies` while shipping all the same.
  '@hookform/resolvers',
  '@tanstack/react-query',
  '@tanstack/react-virtual',
  'daisyui',
  'dockview-react',
  'i18next',
  'immer',
  'react',
  'react-dom',
  'react-hook-form',
  'react-i18next',
  'react-is',
  'react-tooltip',
  'recharts',
  'tailwind-merge',
  'tailwindcss',
  'wavesurfer.js',
  'zod',
  'zundo',
  'zustand',
]

const LICENCE_FILES = ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'LICENCE', 'COPYING', 'COPYING.md']

function packageRoot(name) {
  // `pnpm` nests real packages under `.pnpm`; the symlinked path is the one that resolves.
  const direct = join(ROOT, 'node_modules', name)
  return existsSync(direct) ? direct : null
}

function licenceText(root) {
  for (const candidate of LICENCE_FILES) {
    const file = join(root, candidate)
    if (existsSync(file)) return readFileSync(file, 'utf8').trim()
  }
  // Some packages fold the terms into the readme rather than shipping a file of their own.
  const readme = readdirSync(root).find(entry => /^readme\.md$/i.test(entry))
  return readme ? `See ${readme} of the package.` : ''
}

function repository(manifest) {
  const declared =
    typeof manifest.repository === 'string' ? manifest.repository : manifest.repository?.url
  if (!declared) return undefined
  const url = declared.replace(/^git\+/, '').replace(/\.git$/, '')
  return `${url} — version ${manifest.version}, unmodified`
}

function collect(name) {
  const root = packageRoot(name)
  if (!root) throw new Error(`${name} is not installed — run pnpm install first`)

  const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
  const spdx = typeof manifest.license === 'string' ? manifest.license : 'UNKNOWN'
  const entry = { name, version: manifest.version, spdx, text: licenceText(root) }

  return isCopyleft(spdx) ? { ...entry, sources: repository(manifest) } : entry
}

/**
 * FFmpeg is not an npm package: it is fetched by `pnpm ffmpeg:fetch` and spawned as a separate
 * program.
 *
 * Read from `TARGETS`, never from `resources/ffmpeg/NOTICE.txt`: this file is one shared
 * constant compiled into every platform's bundle, while the folder holds whichever target this
 * machine last fetched. Sourcing it from disk would ship "GPL-3.0, darwin-arm64" to the Windows
 * and Linux users whose build is LGPL — a licence notice stating the wrong licence.
 */
function ffmpegLicence() {
  const terms = Object.entries(FFMPEG_TARGETS).map(
    ([target, { version, licence, source }]) => `  ${target}: ${version}, ${licence} — ${source}`,
  )

  const licences = new Set(Object.values(FFMPEG_TARGETS).map(target => target.licence))

  return {
    name: 'FFmpeg',
    version: [...new Set(Object.values(FFMPEG_TARGETS).map(target => target.version))].join(' / '),
    spdx: [...licences].join(' / '),
    text: [
      'FFmpeg is a separate program, spawned by Scenario Studio. It is not linked into it.',
      '',
      'The build differs per platform, and so do its terms:',
      ...terms,
      '',
      'Both families oblige us to offer FFmpeg’s corresponding sources, below. They are',
      'attached to every release of Scenario Studio alongside the installers, and each binary',
      'prints the configuration it was built with under `ffmpeg -buildconf`.',
    ].join('\n'),
    // One line per distinct archive: the targets do not all sit on the same version, nor on the
    // same builder.
    sources: FFMPEG_SOURCES()
      .map(archive => `ffmpeg ${archive.version}: ${archive.url}`)
      .join('\n'),
  }
}

/**
 * The typefaces the studio ships so that a 3D text has outlines to extrude without asking the
 * network. Not npm packages: they sit beside the renderer's bundle, and the Open Font License
 * asks that its terms travel with the files — which they do, in the very same folder.
 */
function fontLicences() {
  const folder = join(ROOT, 'src', 'renderer', 'public', 'fonts')

  return [
    ['Lato', 'Lato-OFL.txt', 'https://fonts.google.com/specimen/Lato'],
    ['IBM Plex Serif', 'IBMPlex-OFL.txt', 'https://fonts.google.com/specimen/IBM+Plex+Serif'],
    ['IBM Plex Mono', 'IBMPlex-OFL.txt', 'https://fonts.google.com/specimen/IBM+Plex+Mono'],
  ].map(([name, notice, sources]) => ({
    name,
    version: 'shipped with the application',
    spdx: 'OFL-1.1',
    text: readFileSync(join(folder, notice), 'utf8').trim(),
    sources,
  }))
}

/**
 * The same notice as the in-app window, as a file — for whoever reads the repository or the
 * release page rather than the installed application, and for the EULA to point at.
 */
function renderNotices(entries) {
  const summary = entries.map(entry => `| ${entry.name} | ${entry.version} | ${entry.spdx} |`)

  const sections = entries.map(entry =>
    [
      `## ${entry.name}`,
      '',
      `Version: ${entry.version}  `,
      `Licence: ${entry.spdx}`,
      ...(entry.sources ? ['', 'Corresponding sources:', '', '```', entry.sources, '```'] : []),
      '',
      '```',
      entry.text,
      '```',
    ].join('\n'),
  )

  return [
    '# Third-party notices',
    '',
    'Scenario Studio ships the software listed below, each under its own licence. This file is',
    'generated by `pnpm licences:collect` — edit the script, never the file.',
    '',
    'The terms below govern these components. They are not affected by the licence of Scenario',
    "Studio itself (LICENSE) nor by the application's terms of use (EULA.md).",
    '',
    '| Component | Version | Licence |',
    '| --- | --- | --- |',
    ...summary,
    '',
    ...sections,
    '',
  ].join('\n')
}

const licences = [ffmpegLicence(), ...fontLicences(), ...SHIPPED.map(collect)].sort((one, other) =>
  one.name.localeCompare(other.name),
)

writeFileSync(OUTPUT, `${JSON.stringify(licences, null, 2)}\n`)
console.log(`${licences.length} licences → src/shared/licences.json`)

writeFileSync(NOTICES, renderNotices(licences))
console.log(`${licences.length} licences → THIRD-PARTY-NOTICES.md`)

/** Refuses to leave a notice that would be wrong, rather than writing it and hoping. */
function refuse(offenders, why) {
  if (offenders.length === 0) return
  console.error(`${why}\n  ${offenders.map(entry => entry.name).join(', ')}`)
  process.exit(1)
}

// The offer says "unmodified", which a patch would quietly turn into a false statement — and
// under MPL a modified file must itself be published under the same terms.
//
// Read from `patches/` rather than the config: pnpm 10 moved `patchedDependencies` into
// `pnpm-workspace.yaml`, and this script has no YAML parser reachable. The folder is where the
// patch text lands either way, and pnpm escapes a scope's slash to `__` in the file name.
const patchFolder = join(ROOT, 'patches')
const patches = existsSync(patchFolder) ? readdirSync(patchFolder) : []
const isPatched = entry => patches.some(file => file.startsWith(entry.name.replace('/', '__')))

refuse(
  licences.filter(entry => !entry.text),
  'No licence text found for:',
)
refuse(
  licences.filter(entry => isCopyleft(entry.spdx) && !entry.sources),
  'Copyleft without a source offer — these terms require telling recipients where the source is:',
)
refuse(
  licences.filter(entry => isCopyleft(entry.spdx) && isPatched(entry)),
  'Patched copyleft dependency — publish the modified files under their own terms, then say so:',
)
