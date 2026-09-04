import { pathBaseNameOf, safeFileName, stemOf } from '@shared/domain/fileName'
import { escapeXml } from '@shared/domain/xmlText'
import { freeName } from '@shared/domain/otioz'
import { availableParallelism } from 'node:os'
import { gzip } from 'node:zlib'
import { boundedPool } from '@main/boundedPool'
import { compactGlbGeometry } from './glbGeometry'
import {
  EXPORTED_GAME_FILE,
  EXPORTED_GAME_VERSION,
  type ExportedGame,
  type ExportedAssetOverride,
  type GameExportOutcome,
  type GameExportRequest,
  type ScriptToExport,
  type SceneToExport,
} from '@shared/domain/gameExport'

/** An asset's bytes, and the name to file them under. */
export type ExportedAsset = {
  name: string
  bytes: Uint8Array
  /** SHA-256 recorded by the catalogue when it ingested the file. */
  hash?: string
}

export type GameExportPorts = {
  /**
   * The bytes those ids name, keyed by id. An id the catalogue has lost is simply absent.
   *
   * 🛑 The whole list at once: `better-sqlite3` is synchronous on the main process, and one query
   * per asset is the N+1 that `AssetQuery.ids` was written against.
   */
  assetFiles: (ids: readonly string[]) => Promise<ReadonlyMap<string, ExportedAsset>>
  /**
   * Every file of the runtime bundle, `runtime.js` first among them.
   *
   * 🛑 A FOLDER, not one file: the bundle splits — the physics and the sandbox are chunks `runtime.js`
   * imports by name — and a page shipped with the entry alone is a page that loads nothing.
   */
  runtime: () => Promise<readonly { name: string; body: Uint8Array }[]>
  /** Writes one file of the exported folder, at a path relative to its root. */
  write: (relative: string, body: string | Uint8Array) => Promise<void>
}

/** 🛑 What the folder holds, minus its name: only the caller knows where it put it. */
export type GameExportReport = Omit<GameExportOutcome, 'folder'>

/**
 * Writes a game that runs with no studio: the page, the bundle, the manifest and what they reach.
 *
 * Asset reachability is computed from the typed authoring state before it crosses IPC. The text
 * sweep remains only for callers from an older renderer that did not send that list.
 *
 * 🛑 Neither reads a SCRIPT: an asset a script names by id in its own source is not copied, and
 * 404s in the game. The sweep once caught some of those by accident; a renderer that sends the
 * list — every one of them today — skips it, so nothing catches them at all.
 */
export async function writeExportedGame(
  ports: GameExportPorts,
  request: GameExportRequest,
): Promise<GameExportReport> {
  const { scenes, scripts } = request
  const taken = new Set<string>()
  const assetResult = await prepareAssets(ports, request, taken)
  const content = await prepareContent(scenes, scripts, taken)
  const game = exportedGameOf(request, assetResult, content)
  const runtime = await ports.runtime()
  await writeGameFiles(ports, request, assetResult.writes, content, runtime, game)
  return {
    scenes: scenes.length,
    scripts: scripts.length,
    assets: Object.keys(assetResult.assets).length,
    missing: assetResult.missing,
  }
}

type AssetResult = {
  assets: Record<string, string>
  compressed: string[]
  missing: string[]
  writes: Promise<void>[]
}

type StoredScene = { scene: SceneToExport; stored: Awaited<ReturnType<typeof storedText>> }
type StoredScript = { script: ScriptToExport; stored: Awaited<ReturnType<typeof storedText>> }
type PreparedContent = {
  scenes: StoredScene[]
  scripts: StoredScript[]
  sceneFiles: Map<string, string>
  scriptFiles: Map<string, string>
  compressedScenes: Set<string>
  compressedScripts: Set<string>
}

async function prepareAssets(
  ports: GameExportPorts,
  request: GameExportRequest,
  taken: Set<string>,
): Promise<AssetResult> {
  const missing: string[] = []
  const assets: Record<string, string> = {}
  const compressed: string[] = []
  const writes: Promise<void>[] = []
  const contentPaths = new Map<string, { body: Uint8Array; path: string; compressed: boolean }[]>()
  const overrides = new Map(request.assetOverrides?.map(override => [override.id, override]) ?? [])
  const ids = assetIdsIn(request.scenes)
  const found = await ports.assetFiles(ids)
  for (const id of ids) {
    const file = found.get(id)
    if (!file) { missing.push(id); continue }
    await prepareAsset(id, file, overrides.get(id), { ports, taken, contentPaths, assets, compressed, writes })
  }
  return { assets, compressed, missing, writes }
}

type AssetPreparation = Pick<AssetResult, 'assets' | 'compressed' | 'writes'> & {
  ports: GameExportPorts
  taken: Set<string>
  contentPaths: Map<string, { body: Uint8Array; path: string; compressed: boolean }[]>
}

async function prepareAsset(
  id: string,
  file: ExportedAsset,
  override: ExportedAssetOverride | undefined,
  context: AssetPreparation,
): Promise<void> {
  const optimized = await optimizedAsset(overriddenAsset(file, override))
  const key = optimized === file && file.hash ? file.hash : `bytes:${optimized.bytes.byteLength}`
  const candidates = context.contentPaths.get(key) ?? []
  const shared = await matchingContent(candidates, optimized.bytes)
  if (shared) {
    context.assets[id] = shared.path
    if (shared.compressed) context.compressed.push(id)
    return
  }
  const zipped = await gzipBytes(optimized.bytes)
  const body = zipped.byteLength < optimized.bytes.byteLength ? zipped : optimized.bytes
  const suffix = body === zipped ? '.gz' : ''
  const name = freeName(`${safeFileName(optimized.name, 'asset')}${suffix}`, context.taken)
  context.taken.add(name)
  context.assets[id] = `assets/${name}`
  if (suffix) context.compressed.push(id)
  candidates.push({ body: optimized.bytes, path: context.assets[id], compressed: suffix.length > 0 })
  context.contentPaths.set(key, candidates)
  context.writes.push(context.ports.write(context.assets[id], body))
}

async function prepareContent(
  scenes: readonly SceneToExport[],
  scripts: readonly ScriptToExport[],
  taken: Set<string>,
): Promise<PreparedContent> {
  const compression = boundedPool(() => Math.max(1, availableParallelism() - 2))
  const storedScenes = await Promise.all(
    scenes.map(async scene => ({
      scene,
      stored: await compression.run(() => storedText(scene.content)),
    })),
  )
  const storedScripts = await Promise.all(
    scripts.map(async script => ({
      script,
      stored: await compression.run(() => storedText(script.code)),
    })),
  )
  const sceneFiles = new Map<string, string>()
  const compressedScenes = new Set<string>()
  for (const { scene, stored } of storedScenes) {
    const name = freeName(
      `${safeFileName(scene.id, 'scene')}.gltf${stored.compressed ? '.gz' : ''}`,
      taken,
    )
    taken.add(name)
    sceneFiles.set(scene.id, `scenes/${name}`)
    if (stored.compressed) compressedScenes.add(scene.id)
  }
  const scriptFiles = new Map<string, string>()
  const compressedScripts = new Set<string>()
  for (const { script, stored } of storedScripts) {
    const name = freeName(`${fileNameOf(script)}${stored.compressed ? '.gz' : ''}`, taken)
    taken.add(name)
    scriptFiles.set(script.script, name)
    if (stored.compressed) compressedScripts.add(script.script)
  }
  return {
    scenes: storedScenes, scripts: storedScripts, sceneFiles, scriptFiles,
    compressedScenes, compressedScripts,
  }
}

function exportedGameOf(
  request: GameExportRequest,
  assets: AssetResult,
  content: PreparedContent,
): ExportedGame {
  return {
    version: EXPORTED_GAME_VERSION,
    title: request.title,
    entryScene: request.entryScene,
    scenes: request.scenes.map(one => ({
      id: one.id,
      title: one.title,
      file: content.sceneFiles.get(one.id) ?? '',
      ...(content.compressedScenes.has(one.id) ? { compression: 'gzip' } : {}),
      ...(one.optimization ? { optimization: one.optimization } : {}),
    })),
    scripts: request.scripts.map(one => ({
      script: one.script,
      file: `scripts/${content.scriptFiles.get(one.script)}`,
      ...(content.compressedScripts.has(one.script) ? { compression: 'gzip' } : {}),
    })),
    assets: assets.assets,
    ...(assets.compressed.length > 0 ? { compressedAssets: assets.compressed } : {}),
    ...(request.modelAssets ? { modelAssets: request.modelAssets } : {}),
    ...(request.lossyOptimization ? { lossyOptimization: request.lossyOptimization } : {}),
  }
}

async function writeGameFiles(
  ports: GameExportPorts,
  request: GameExportRequest,
  assetWrites: readonly Promise<void>[],
  content: PreparedContent,
  runtime: readonly { name: string; body: Uint8Array }[],
  game: ExportedGame,
): Promise<void> {
  await Promise.all([
    ...assetWrites,
    ...content.scenes.map(({ scene, stored }) =>
      ports.write(content.sceneFiles.get(scene.id) ?? '', stored.body)),
    ...content.scripts.map(({ script, stored }) =>
      ports.write(`scripts/${content.scriptFiles.get(script.script)}`, stored.body),
    ),
    ...runtime.map(file => ports.write(file.name, file.body)),
    ports.write(EXPORTED_GAME_FILE, `${JSON.stringify(game, null, 2)}\n`),
    ports.write('index.html', pageFor(request.title)),
  ])
}

async function storedText(
  source: string,
): Promise<{ body: string | Uint8Array; compressed: boolean }> {
  const compressed = await gzipBytes(source)
  return compressed.byteLength < Buffer.byteLength(source)
    ? { body: compressed, compressed: true }
    : { body: source, compressed: false }
}

async function gzipBytes(source: string | Uint8Array): Promise<Uint8Array> {
  return await new Promise<Uint8Array>((resolve, reject) => {
    gzip(source, { level: 9 }, (error, bytes) => {
      if (error) reject(error)
      else resolve(bytes)
    })
  })
}

async function optimizedAsset(source: ExportedAsset): Promise<ExportedAsset> {
  if (!source.name.toLowerCase().endsWith('.glb')) return source
  const compact = compactGlbGeometry(source.bytes)
  if (compact === source.bytes) return source
  const [originalGzip, compactGzip] = await Promise.all([
    gzipBytes(source.bytes),
    gzipBytes(compact),
  ])
  const originalStoredBytes = Math.min(source.bytes.byteLength, originalGzip.byteLength)
  const compactStoredBytes = Math.min(compact.byteLength, compactGzip.byteLength)
  return compactStoredBytes < originalStoredBytes ? { ...source, bytes: compact } : source
}

function overriddenAsset(
  source: ExportedAsset,
  override: ExportedAssetOverride | undefined,
): ExportedAsset {
  return override
    ? { name: `${stemOf(source.name)}.${override.extension}`, bytes: override.bytes }
    : source
}

const COMPARISON_CHUNK_BYTES = 1024 * 1024

async function matchingContent(
  candidates: readonly { body: Uint8Array; path: string; compressed: boolean }[],
  wanted: Uint8Array,
): Promise<{ body: Uint8Array; path: string; compressed: boolean } | null> {
  for (const candidate of candidates) {
    if (candidate.body.byteLength !== wanted.byteLength) continue
    if (await sameBytes(candidate.body, wanted)) return candidate
  }
  return null
}

async function sameBytes(left: Uint8Array, right: Uint8Array): Promise<boolean> {
  for (let start = 0; start < left.byteLength; start += COMPARISON_CHUNK_BYTES) {
    const end = Math.min(start + COMPARISON_CHUNK_BYTES, left.byteLength)
    if (Buffer.compare(left.subarray(start, end), right.subarray(start, end)) !== 0) return false
    await new Promise<void>(resolve => setImmediate(resolve))
  }
  return true
}

/** Every asset a scene names, once, in the order they were met. */
function assetIdsIn(scenes: readonly SceneToExport[]): readonly string[] {
  const found = new Set<string>()
  for (const scene of scenes) {
    if (scene.assetIds) {
      for (const id of scene.assetIds) if (id) found.add(id)
      continue
    }
    for (const [, id] of scene.content.matchAll(/"assetId"\s*:\s*"([^"]+)"/g)) {
      if (id) found.add(id)
    }
  }
  return [...found]
}

/** A script is named by its path; the file beside the page keeps the name and loses the folders. */
const fileNameOf = (script: ScriptToExport): string => `${stemOf(pathBaseNameOf(script.script))}.js`

/**
 * The page. Plain and self-contained — a stylesheet beside it is one more file to lose.
 *
 * 🛑 SERVED, never opened by double-click: a module script and a `fetch` are both refused under
 * `file://`, and the failure is a black page. The banner says so rather than leaving it to be
 * discovered.
 */
const pageFor = (title: string): string => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeXml(title)}</title>
    <style>
      html, body { margin: 0; height: 100%; background: #000; overflow: hidden; }
      canvas { display: block; width: 100%; height: 100%; }
      #trouble { position: absolute; inset: 1rem; color: #fff; font: 14px system-ui; }
    </style>
  </head>
  <body>
    <canvas id="game"></canvas>
    <p id="trouble" hidden></p>
    <script type="module">
      import { startExportedGame } from './runtime.js'
      startExportedGame(document.getElementById('game')).catch(error => {
        const said = document.getElementById('trouble')
        said.hidden = false
        said.textContent = String(error)
      })
    </script>
  </body>
</html>
`
