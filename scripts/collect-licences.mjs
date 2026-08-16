/**
 * Collects the licence of everything the studio redistributes into `src/shared/licences.json`,
 * which the Help ▸ Licences window reads, and into `THIRD-PARTY-NOTICES.md` for readers of the
 * repository and the release page.
 *
 * What is shipped is `SHIPPED`, and why it is a list rather than a query is written there.
 * `licence.test.ts` fails if a runtime dependency is added without landing in it, and
 * `main/licences.test.ts` fails if one of its names is no longer declared in the manifest.
 *
 * The texts themselves are read from `node_modules`, never copied by hand — a version bump
 * brings its own wording.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { sourceArchives as FFMPEG_SOURCES, TARGETS as FFMPEG_TARGETS } from './fetch-ffmpeg.mjs'
import { VAD as STT_VAD } from './fetch-stt.mjs'
// A `.ts` from a `.mjs`: Node 24 strips the types on the way in. Worth the novelty here — the
// rule that decides who owes a source offer must be the one the tests check, not a twin of it,
// and the same goes for the list of what is shipped.
import { isCopyleft, NO_VERSION } from '../src/shared/domain/licence.ts'
import { SHIPPED } from '../src/main/shipped-packages.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUTPUT = join(ROOT, 'src', 'shared', 'licences.json')
const NOTICES = join(ROOT, 'THIRD-PARTY-NOTICES.md')

/** `pnpm patch` keys these by `name@version`; the offer is about the package, so the name is enough. */
const PATCHED = new Set(
  Object.keys(
    JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).pnpm?.patchedDependencies ?? {},
  ).map(spec => spec.split('@').slice(0, -1).join('@')),
)

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
  // npm also allows the `user/repo` shorthand, which is not something a recipient can open. Left
  // undefined so the copyleft guard below catches it rather than shipping an unusable offer.
  if (!/^https?:\/\//.test(url)) return undefined

  return url
}

function collect(name) {
  const root = packageRoot(name)
  if (!root) throw new Error(`${name} is not installed — run pnpm install first`)

  const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
  const spdx = typeof manifest.license === 'string' ? manifest.license : 'UNKNOWN'
  const entry = { name, version: manifest.version, spdx, text: licenceText(root) }

  if (!isCopyleft(spdx)) return entry

  // Read rather than asserted: the offer says we ship this very version untouched, and a patched
  // dependency would make that false — silently, in a legal notice.
  const sources = repository(manifest)
  return PATCHED.has(name) ? { ...entry, sources } : { ...entry, sources, unmodified: true }
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
    // No version: a typeface file carries none, and the window says so in the reader's language.
    spdx: 'OFL-1.1',
    text: readFileSync(join(folder, notice), 'utf8').trim(),
    sources,
  }))
}

/**
 * What dictation ships that npm does not describe.
 *
 * The addon is collected like any package; these two are not packages. The detector sits in
 * `resources/stt/`, fetched by `pnpm stt:fetch`. ONNX Runtime is inside the platform packages
 * of sherpa-onnx as four dynamic libraries, and it is Microsoft's, not theirs — a notice that
 * named only sherpa-onnx would attribute their work to someone else.
 *
 * The recognition model is listed although it is downloaded by the user rather than shipped:
 * CC-BY-4.0 asks for attribution wherever the work is used, and the licence text is offered by
 * link because that is what that licence itself asks for.
 */
function dictationLicences() {
  return [
    {
      name: 'ONNX Runtime',
      version: '1.27.0',
      spdx: 'MIT',
      text: [
        'ONNX Runtime is redistributed inside the sherpa-onnx platform packages, as the',
        'dynamic libraries the recognition addon loads.',
        '',
        'Copyright (c) Microsoft Corporation. Licensed under the MIT License.',
        'Full terms: https://github.com/microsoft/onnxruntime/blob/main/LICENSE',
      ].join('\n'),
      sources: 'https://github.com/microsoft/onnxruntime',
    },
    {
      name: 'Silero VAD',
      version: STT_VAD.version,
      spdx: STT_VAD.licence,
      text: [
        'Silero VAD decides when someone is speaking. It ships beside the application, in',
        'resources/stt/, and is read by the recognition engine rather than executed.',
        '',
        `Full terms: ${STT_VAD.source}/blob/master/LICENSE`,
      ].join('\n'),
      sources: STT_VAD.source,
    },
    {
      name: 'Parakeet TDT 0.6b v3',
      version: 'int8',
      spdx: 'CC-BY-4.0',
      text: [
        'The speech recognition model dictation uses. It is NOT shipped with the application:',
        'it is downloaded on first use into the user data folder, and can be removed from',
        'there. It is listed here because CC-BY-4.0 asks for attribution wherever the work is',
        'used, shipped or not.',
        '',
        'Created by NVIDIA, as part of the NeMo toolkit, and converted to ONNX by the',
        'sherpa-onnx project.',
        '',
        'Full terms: https://creativecommons.org/licenses/by/4.0/legalcode',
      ].join('\n'),
      sources: 'https://huggingface.co/nvidia/parakeet-tdt-0.6b-v3',
    },
  ]
}

/**
 * The same notice as the in-app window, as a file — for whoever reads the repository or the
 * release page rather than the installed application, and for the EULA to point at.
 */
function renderNotices(entries) {
  const summary = entries.map(
    entry => `| ${entry.name} | ${entry.version ?? NO_VERSION} | ${entry.spdx} |`,
  )

  const sections = entries.map(entry =>
    [
      `## ${entry.name}`,
      '',
      `Version: ${entry.version ?? NO_VERSION}  `,
      `Licence: ${entry.spdx}`,
      ...(entry.sources
        ? [
            '',
            entry.unmodified ? 'Corresponding sources, unmodified:' : 'Corresponding sources:',
            '',
            '```',
            entry.sources,
            '```',
          ]
        : []),
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

const licences = [
  ffmpegLicence(),
  ...fontLicences(),
  ...dictationLicences(),
  ...SHIPPED.map(collect),
].sort((one, other) => one.name.localeCompare(other.name))

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
// patch text lands either way, and pnpm escapes a scope's slash to `__` in the file name. Anchored
// on what follows the name, or `react-dom@18.patch` would convict a package named `react`.
const patchFolder = join(ROOT, 'patches')
const patches = existsSync(patchFolder) ? readdirSync(patchFolder) : []
const isPatched = entry => {
  const stem = entry.name.replace('/', '__')
  return patches.some(file => file === `${stem}.patch` || file.startsWith(`${stem}@`))
}

// Before writing, not after: a run that exits 1 having already overwritten both files leaves the
// very claim it refuses on disk, one `git add` away from shipping.
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

writeFileSync(OUTPUT, `${JSON.stringify(licences, null, 2)}\n`)
console.log(`${licences.length} licences → src/shared/licences.json`)

writeFileSync(NOTICES, renderNotices(licences))
console.log(`${licences.length} licences → THIRD-PARTY-NOTICES.md`)
