/**
 * Collects the licence of everything the studio redistributes into `src/shared/licences.json`,
 * which the Help ▸ Licences window reads.
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
import { SOURCES as FFMPEG_SOURCES, TARGETS as FFMPEG_TARGETS } from './fetch-ffmpeg.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUTPUT = join(ROOT, 'src', 'shared', 'licences.json')

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
  'react-tooltip',
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

function collect(name) {
  const root = packageRoot(name)
  if (!root) throw new Error(`${name} is not installed — run pnpm install first`)

  const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
  const spdx = typeof manifest.license === 'string' ? manifest.license : 'UNKNOWN'

  return { name, version: manifest.version, spdx, text: licenceText(root) }
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
      'The GPL builds oblige us to offer FFmpeg’s corresponding sources, below.',
    ].join('\n'),
    sources: FFMPEG_SOURCES,
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

const licences = [ffmpegLicence(), ...fontLicences(), ...SHIPPED.map(collect)].sort((one, other) =>
  one.name.localeCompare(other.name),
)

writeFileSync(OUTPUT, `${JSON.stringify(licences, null, 2)}\n`)
console.log(`${licences.length} licences → src/shared/licences.json`)

const missing = licences.filter(entry => !entry.text)
if (missing.length > 0) {
  console.error(`No licence text found for: ${missing.map(entry => entry.name).join(', ')}`)
  process.exit(1)
}
