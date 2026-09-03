import { pathBaseNameOf, safeFileName, stemOf } from '@shared/domain/fileName'
import { escapeXml } from '@shared/domain/xmlText'
import { freeName } from '@shared/domain/otioz'
import {
  EXPORTED_GAME_FILE,
  EXPORTED_GAME_VERSION,
  type ExportedGame,
  type GameExportOutcome,
  type GameExportRequest,
  type ScriptToExport,
  type SceneToExport,
} from '@shared/domain/gameExport'

/** An asset's bytes, and the name to file them under. */
export type ExportedAsset = { name: string; bytes: Uint8Array }

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
 * 🛑 Two known edges of the textual `"assetId"` sweep. It copies a scene's SKYBOX, which
 * `buildGameScene` does not draw, so an `.exr` ships for nothing. And it does not read a SCRIPT:
 * an asset a script names by id in its own source is not copied, and 404s in the game.
 */
export async function writeExportedGame(
  ports: GameExportPorts,
  request: GameExportRequest,
): Promise<GameExportReport> {
  const { scenes, scripts } = request
  const missing: string[] = []
  const assets: Record<string, string> = {}
  // 🛑 Two rows may name one file — `checker.png` twice, from two folders — and the second would
  // overwrite the first without a word. The same rule a montage bundle already follows.
  const taken = new Set<string>()

  const ids = assetIdsIn(scenes)
  const found = await ports.assetFiles(ids)
  const assetWrites: Promise<void>[] = []
  for (const id of ids) {
    const file = found.get(id)
    if (!file) {
      missing.push(id)
      continue
    }

    const name = freeName(safeFileName(file.name, 'asset'), taken)
    taken.add(name)
    assets[id] = `assets/${name}`
    assetWrites.push(ports.write(assets[id], file.bytes))
  }

  // 🛑 Through `safeFileName` and deduplicated: an id comes from the WINDOW over IPC, so `../../x`
  // would be written wherever it pointed, and two ids cleaning to one name would overwrite each
  // other in silence.
  const files = new Map<string, string>()
  for (const scene of scenes) {
    const name = freeName(`${safeFileName(scene.id, 'scene')}.gltf`, taken)
    taken.add(name)
    files.set(scene.id, `scenes/${name}`)
  }

  const named = new Map<string, string>()
  for (const script of scripts) {
    const name = freeName(fileNameOf(script), taken)
    taken.add(name)
    named.set(script.script, name)
  }

  const game: ExportedGame = {
    version: EXPORTED_GAME_VERSION,
    title: request.title,
    entryScene: request.entryScene,
    scenes: scenes.map(one => ({ id: one.id, title: one.title, file: files.get(one.id) ?? '' })),
    scripts: scripts.map(one => ({ script: one.script, file: `scripts/${named.get(one.script)}` })),
    assets,
  }

  // Names are allocated above, in order, because `freeName` is pure; only the writing is
  // independent, and a hundred assets paid two syscalls each strictly one after another.
  const runtime = await ports.runtime()
  await Promise.all([
    ...assetWrites,
    ...scenes.map(scene => ports.write(files.get(scene.id) ?? '', scene.content)),
    ...scripts.map(script => ports.write(`scripts/${named.get(script.script)}`, script.code)),
    ...runtime.map(file => ports.write(file.name, file.body)),
    ports.write(EXPORTED_GAME_FILE, `${JSON.stringify(game, null, 2)}\n`),
    ports.write('index.html', pageFor(request.title)),
  ])

  return {
    scenes: scenes.length,
    scripts: scripts.length,
    assets: Object.keys(assets).length,
    missing,
  }
}

/** Every asset a scene names, once, in the order they were met. */
function assetIdsIn(scenes: readonly SceneToExport[]): readonly string[] {
  const found = new Set<string>()
  for (const scene of scenes) {
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
