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
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

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
  'mediabunny',
  'pixi.js',
  'three',
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
  'react-toastify',
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
 * program. Its terms travel with the binary in `resources/ffmpeg/NOTICE.txt`, and the version
 * is read from the binary itself when it is there.
 */
function ffmpegLicence() {
  const noticeFile = join(ROOT, 'resources', 'ffmpeg', 'NOTICE.txt')
  const name = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'
  const binary = join(ROOT, 'resources', 'ffmpeg', name)
  const notice = existsSync(noticeFile) ? readFileSync(noticeFile, 'utf8') : null

  let version = 'shipped with the application'
  if (existsSync(binary)) {
    const first = execFileSync(binary, ['-version'], { encoding: 'utf8' }).split('\n')[0]
    version = first.replace(/^ffmpeg version /, '').split(' ')[0]
  }

  return {
    name: 'FFmpeg',
    version,
    spdx: notice?.match(/Licence: (.+)/)?.[1] ?? 'LGPL-2.1-or-later',
    text:
      notice?.trim() ??
      'Fetch it with `pnpm ffmpeg:fetch` to record the exact terms of the shipped build.',
    sources: 'https://ffmpeg.org/download.html',
  }
}

const licences = [ffmpegLicence(), ...SHIPPED.map(collect)].sort((one, other) =>
  one.name.localeCompare(other.name),
)

writeFileSync(OUTPUT, `${JSON.stringify(licences, null, 2)}\n`)
console.log(`${licences.length} licences → src/shared/licences.json`)

const missing = licences.filter(entry => !entry.text)
if (missing.length > 0) {
  console.error(`No licence text found for: ${missing.map(entry => entry.name).join(', ')}`)
  process.exit(1)
}
