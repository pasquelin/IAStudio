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
import { PYTHON as INTERPRETER_VERSION } from './fetch-engine.mjs'
import { sourceArchives as FFMPEG_SOURCES, TARGETS as FFMPEG_TARGETS } from './fetch-ffmpeg.mjs'
import { VAD as STT_VAD } from './fetch-stt.mjs'
// A `.ts` from a `.mjs`: Node 24 strips the types on the way in. Worth the novelty here — the
// rule that decides who owes a source offer must be the one the tests check, not a twin of it,
// and the same goes for the list of what is shipped.
import { isCopyleft, NO_VERSION } from '../src/shared/domain/licence.ts'
import { SHIPPED } from '../src/main/shippedPackages.ts'
import { BUILD_ONLY_PYTHON, ENGINE_PACKAGE, INTERPRETER } from '../src/main/pythonPackages.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

/** Written by `collect-python-licences.mjs` from a materialised environment, and committed. */
const PYTHON_LICENCES = join(ROOT, 'engine', 'licences.json')
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
      'FFmpeg is a separate program, spawned by IA Studio. It is not linked into it.',
      '',
      'The build differs per platform, and so do its terms:',
      ...terms,
      '',
      'Both families oblige us to offer FFmpeg’s corresponding sources, below. They are',
      'attached to every release of IA Studio alongside the installers, and each binary',
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
 * What the AI side ships, or points at, that npm does not describe.
 *
 * The addon is collected like any package; these are not packages. The detector sits in
 * `resources/stt/`, fetched by `pnpm stt:fetch`. ONNX Runtime is inside the platform packages
 * of sherpa-onnx as four dynamic libraries, and it is Microsoft's, not theirs — a notice that
 * named only sherpa-onnx would attribute their work to someone else.
 *
 * The two models are listed although they are downloaded rather than shipped: their licences ask
 * for attribution wherever the work is used, and the texts are offered by link because that is
 * what those licences themselves ask for.
 *
 * The catalogue half is READ from `localModels.json`, which ADR-20 § E asks for: a model added
 * there can no longer ship without its notice. Importing `catalogue.ts` still cannot be done —
 * this file strips types and resolves no `@shared/` alias — but the manifests are plain JSON.
 */
/** How every catalogue model arrives, said once — a third one adds a TEXT, not this paragraph. */
const FETCHED_ON_REQUEST = [
  'It is NOT shipped with the application: it is fetched on request into the user data folder,',
  'against a published digest, and removed from the model manager.',
].join('\n')

/** A card listed before any engine can open it: the catalogue names a publisher, nothing is pulled. */
const LISTED_NOT_FETCHED = [
  'No engine in this studio opens these weights yet: they are listed so the choice',
  'is visible. Nothing is fetched until a runtime can actually run them.',
].join('\n')

/**
 * What is true of ONE model and of no other: who holds the copyright, and what its own components
 * were read to be. Keyed by manifest id, so a model with nothing particular to say needs no line.
 */
const MODEL_NOTES = {
  'sana-600m-1024': [
    'Copyright NVIDIA Corporation and the Sana authors.',
    '',
    'THE DOWNLOAD CARRIES MORE THAN ONE LICENCE, measured on 2026-08-22. Its text encoder is a',
    'Gemma 2 model: text_encoder/config.json names google/gemma-2-2b-it, and the 5.2 GB it',
    'weighs are governed by the Gemma Terms of Use rather than by Apache-2.0.',
    'Full terms: https://ai.google.dev/gemma/terms',
  ],
  'sana-1600m-1024': ['Copyright NVIDIA Corporation and the Sana authors.'],
  'sana15-1-6b': ['Copyright NVIDIA Corporation and the Sana authors.'],
  'ssd-1b': [
    'Copyright Segmind.',
    '',
    'Its components, read on 2026-08-22: two CLIP text encoders and a VAE, none of whose',
    'configuration names an upstream repository. SSD-1B is published by Segmind as a distillation',
    'of Stable Diffusion XL 1.0, whose own weights are released under CreativeML Open RAIL++-M.',
  ],
  'qwen-image': ['Copyright Alibaba Group and the Qwen authors.'],
  'qwen-image-edit': ['Copyright Alibaba Group and the Qwen authors.'],
  'cogvideox-2b': ['Copyright the CogVideoX authors, Zhipu AI.'],
  'wan21-t2v-1-3b': [
    'Copyright Alibaba Group and the Wan authors.',
    '',
    'Its UMT5 text encoder is 22.7 GB of the 28.9 this weighs — read on 2026-08-22.',
  ],
  'wan22-ti2v-5b': ['Copyright Alibaba Group and the Wan authors.'],
  'wan21-i2v-14b-480p': ['Copyright Alibaba Group and the Wan authors.'],
  'mochi-1-preview': ['Copyright Genmo.'],
  'acestep-v15-xl-base': ['Copyright the ACE-Step authors.'],
  'acestep-v15-xl-turbo': ['Copyright the ACE-Step authors.'],
  'acestep-v15-xl-sft': ['Copyright the ACE-Step authors.'],
  'shap-e': [
    'Copyright OpenAI. Its text encoder is a CLIP model — text_encoder/config.json names',
    'openai/clip-vit-large-patch14, whose repository card states no licence of its own.',
    '',
    'This download carries `.bin` tensors, which the studio otherwise refuses: Shap-E publishes',
    'its renderer in that form alone. What still guards it: torch has refused to unpickle by',
    'default since 2.6, and every file above is pinned to a digest.',
  ],
  instantmesh: [
    'Copyright Tencent ARC Lab and the InstantMesh authors.',
    '',
    'THE DOWNLOAD CARRIES MORE THAN ONE ORIGIN, read on 2026-08-23. Apache-2.0 covers the two',
    'TencentARC files — the reconstruction checkpoint and the white-background unet. The other',
    'seventeen are sudo-ai/zero123plus-v1.2, whose repository card states no licence of its own.',
    '',
    'The unet lands under `unet/`, where the six-view pipeline reads it: the studio fetches the',
    'base unet of zero123plus not at all, rather than 3.4 GB it would overwrite on load.',
  ],
  lgm: [
    'Copyright the LGM authors, and Ashawkey for the published weights.',
    '',
    'THE DOWNLOAD CARRIES MORE THAN ONE ORIGIN, read on 2026-08-23. MIT covers the splatter',
    'checkpoint alone; the four-view stage is ashawkey/imagedream-ipmv-diffusers, published under',
    'OpenRAIL, and it is fourteen of the fifteen files above.',
    '',
    'What LGM writes is a 3D Gaussian cloud, not a mesh: the step that turns one into the other',
    'is a rasterizer whose licence forbids commercial use, and it is not fetched or shipped.',
  ],
  panfusion: [
    'The files fetched are Stable Diffusion 1.5 (CreativeML Open RAIL-M). PanFusion publishes a',
    'Lightning checkpoint this studio cannot open. Generation uses MultiDiffusion circular padding.',
  ],
  mvdiffusion: [
    'The files fetched are Stable Diffusion 1.5 (CreativeML Open RAIL-M). MVDiffusion publishes a',
    'Dropbox Lightning checkpoint this studio cannot open. Generation uses MultiDiffusion.',
  ],
  diffusion360: [
    'Copyright the Diffusion360 authors. The files fetched are the published sd-base pipeline',
    '(Apache-2.0). They include `.bin` tensors, the same reservation as Shap-E: torch has refused',
    'to unpickle by default since 2.6, and every file above is pinned to a digest.',
  ],
  unipano: [
    'The files fetched are Stable Diffusion 1.5 (CreativeML Open RAIL-M). UniPano publishes no',
    'weights. Generation uses MultiDiffusion circular padding.',
  ],
  'controlnet-canny-sdxl': [
    'Copyright the xinsir authors. A control network run BESIDE a base model, never alone.',
  ],
  'ip-adapter-sdxl': [
    'Copyright Tencent AI Lab. Adapter weights grafted onto a base model, never alone.',
    '',
    'Only the SDXL set is fetched: the repository ships four adapters and two image encoders,',
    'for two model families.',
  ],
  'mmaudio-small-44k': ['Copyright the MMAudio authors.'],
  'mmaudio-medium-44k': ['Copyright the MMAudio authors.'],
  'mmaudio-large-44k': ['Copyright the MMAudio authors.'],
  'trellis2-4b': ['Copyright Microsoft.'],
  triposr: ['Copyright Stability AI and Tripo AI.'],
  'shap-e-img2img': [
    'Copyright OpenAI. Same renderer, and the same `.bin` reservation as Shap-E above.',
  ],
  craftsman3d: ['Copyright the CraftsMan3D authors.'],
  triposg: ['Copyright VAST AI Research and Tripo.'],
}

/**
 * One notice per catalogue entry, read off the manifests rather than retyped beside them.
 *
 * The dictation model is NOT here — it lives in `dictation.ts` and keeps its own block above.
 */
function catalogueLicences() {
  const path = join(ROOT, 'src', 'shared', 'domain', 'localModels.json')
  const catalogue = JSON.parse(readFileSync(path, 'utf8'))

  return Object.values(catalogue)
    .flat()
    .filter(model => model.loader === 'diffusers' || model.loader === 'plugin')
    .map(model => ({
      name: model.name,
      spdx: model.licence,
      text: [
        model.files.length === 0
          ? `${model.summary}.`
          : `${model.summary}, one of the models the studio generates with on this machine.`,
        model.files.length === 0 ? LISTED_NOT_FETCHED : FETCHED_ON_REQUEST,
        '',
        ...(MODEL_NOTES[model.id] ?? []),
        '',
        `Licensed under ${model.licence}. Full terms: ${model.licenceUrl}`,
        ...(model.licenceStatus === 'non-commercial'
          ? ['', 'NON-COMMERCIAL ONLY. These weights may not be used in a commercial project.']
          : []),
      ].join('\n'),
      sources: model.source,
    }))
}

function modelLicences() {
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
    ...qwenLicences(),
    ...pythonLicences(),
    ...catalogueLicences(),
  ]
}

/**
 * The Python side, which npm cannot see at all — the third source § F.4 of the engine spec named.
 *
 * `uv.lock` carries names and versions and NO licence, so the licence comes from
 * `src/main/pythonPackages.ts` and the version from the lock. A package in the lock that neither
 * list classifies makes `python-licences.test.ts` go red, which is what asks for the decision.
 */
/** What a licence column says for a package whose metadata states none. Never a version word. */
const UNSTATED_LICENCE = 'unstated'

function pythonLicences() {
  const read = existsSync(PYTHON_LICENCES) ? JSON.parse(readFileSync(PYTHON_LICENCES, 'utf8')) : {}

  const interpreter = {
    name: INTERPRETER.name,
    version: INTERPRETER_VERSION,
    spdx: INTERPRETER.spdx,
    text: [
      'The interpreter the local AI engine runs on. It IS in the installer, beside ffmpeg.',
      '',
      `Copyright ${INTERPRETER.holder}. Licensed under ${INTERPRETER.spdx}.`,
      `Source: ${INTERPRETER.source}`,
    ].join('\n'),
    sources: INTERPRETER.source,
  }

  const packages = Object.entries(read)
    .filter(([name]) => !BUILD_ONLY_PYTHON.includes(name) && name !== ENGINE_PACKAGE)
    .map(([name, entry]) => ({
      name,
      version: entry.version ?? NO_VERSION,
      // NOT `NO_VERSION`, which reads "shipped with the application" — a sentence about a
      // version, printed in the licence column of a package whose metadata states none.
      spdx: entry.spdx ?? UNSTATED_LICENCE,
      text: [
        'Part of the environment a local generation runs in. It is NOT shipped with the',
        'application: it is fetched on first use, and removed with the engine.',
        '',
        `Licensed under ${entry.spdx ?? 'a licence its metadata does not state'}.`,
        ...(entry.home ? [`Source: ${entry.home}`] : []),
      ].join('\n'),
      ...(entry.home ? { sources: entry.home } : {}),
    }))

  return [interpreter, ...packages]
}

/**
 * The assistant's models, one notice per catalogue entry. Apache-2.0 asks for the notice wherever
 * the work is used, and these are downloaded rather than shipped — the licence travels all the same.
 *
 * Spelled from the same list the catalogue holds, so a fifth entry cannot ship without its line:
 * `catalogue.test.ts` confronts `shippedModels()` with what this writes.
 */
function qwenLicences() {
  const sizes = ['0.5B', '1.5B', '7B', '14B']

  return sizes.map(size => ({
    name: `Qwen2.5 ${size} Instruct`,
    version: 'Q4_K_M',
    spdx: 'Apache-2.0',
    text: [
      `The language model the assistant runs on when it runs on this machine, in its ${size} size.`,
      'It is NOT shipped with the application: it is fetched on request into the user data folder,',
      'against a published digest, and removed from the model manager.',
      '',
      'Copyright the Qwen team, Alibaba Cloud. Licensed under the Apache License, Version 2.0.',
      'Full terms: https://www.apache.org/licenses/LICENSE-2.0',
    ].join('\n'),
    sources: `https://huggingface.co/Qwen/Qwen2.5-${size}-Instruct-GGUF`,
  }))
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
    'IA Studio ships the software listed below, each under its own licence. This file is',
    'generated by `pnpm licences:collect` — edit the script, never the file.',
    '',
    // One entry, not a pre-broken pair: split across two, the product's name sat astride the join
    // and no rename could reach it. The line break belongs to the rendering, not to the source.
    "The terms below govern these components. They are not affected by the licence of IA Studio itself (LICENSE) nor by the application's terms of use (EULA.md).",
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
  ...modelLicences(),
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
