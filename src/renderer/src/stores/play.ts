import { create } from 'zustand'
import { NOT_PLAYING, type RuntimeReport } from '@shared/domain/gameRuntime'
import type { DomInputTarget } from '@game/host/domInput'
import { refToString } from '@shared/domain/ref'
import { loadRapierPhysics } from '@game/host/rapierPhysics'
import { loadQuickjsScripts } from '@game/host/quickjsScripts'
import type { PhysicsPort } from '@game/ports/physicsPort'
import type { ScriptModule, ScriptPort } from '@game/ports/scriptPort'
import { createScriptCompiler } from '@/engines/code/scriptCompiler'
import { getBridge } from '@/services/bridge'
import { animationFrames, startPlay, type PlaySession } from '@/game/playSession'
import { sceneEngineOf } from './sceneEngines'
import { sceneOf, useScenes } from './scenes'

export type PlayStoreState = {
  /** What each document's game says about itself. A document that is not playing has none. */
  reports: Record<string, RuntimeReport>
  start: (documentId: string, input: DomInputTarget) => void
  pause: (documentId: string) => void
  resume: (documentId: string) => void
  stop: (documentId: string) => void
}

/**
 * A running game per document.
 *
 * The sessions are held OUTSIDE the store, like the engines they draw through: a session holds a
 * world and a frame loop, and putting one into zustand would re-render every subscriber each time
 * a document started playing. What the screen reads is the report, which is plain data.
 */
const sessions = new Map<string, PlaySession>()

/**
 * 🛑 Documents whose engine is still loading, by GENERATION rather than by name. A stop followed
 * by a play, both while the WebAssembly is in flight, left the FIRST call installing the session
 * — bound to a viewport element the remount had already detached, so nothing answered a key.
 */
const starting = new Map<string, number>()
let generation = 0

export const usePlay = create<PlayStoreState>()(set => ({
  reports: {},

  start: (documentId, input) => {
    // No viewport, no game: the runtime draws through the engine that viewport owns.
    if (sessions.has(documentId) || starting.has(documentId) || !sceneEngineOf(documentId)) return

    generation += 1
    starting.set(documentId, generation)
    void begin(documentId, generation, input, report =>
      set(state => ({ reports: { ...state.reports, [documentId]: report } })),
    )
  },

  pause: documentId => sessions.get(documentId)?.pause(),
  resume: documentId => sessions.get(documentId)?.resume(),

  stop: documentId => {
    // Dropped from the waiting list too: a stop while the engine loads must not be overtaken by
    // the session it was cancelling.
    starting.delete(documentId)
    sessions.get(documentId)?.stop()
    sessions.delete(documentId)
    // Guarded: every viewport teardown calls this, playing or not, and an unconditional write
    // would re-render every subscriber for a document that was never played.
    set(state =>
      documentId in state.reports ? { reports: withoutReport(state.reports, documentId) } : state,
    )
  },
}))

/**
 * The engine first, the world second — the WebAssembly weighs 2,7 Mo and lands in 27 ms, which
 * is a frame nobody sees but not a wait a Play button may take synchronously.
 */
async function begin(
  documentId: string,
  token: number,
  input: DomInputTarget,
  onReport: (report: RuntimeReport) => void,
): Promise<void> {
  let physics: PhysicsPort | undefined
  let script: ScriptPort | undefined
  try {
    // Together: the two machines are independent, and one after the other would double the wait
    // before anything moves.
    ;[physics, script] = await Promise.all([loadRapierPhysics(), loadQuickjsScripts()])
  } catch {
    // Said by the session itself, on the game's own log: a game missing an engine still runs.
  }

  const modules = await compiled()
  const renderer = sceneEngineOf(documentId)
  // Stopped, overtaken by a later Play, or its viewport closed while the engines were loading.
  if (starting.get(documentId) !== token || !renderer) {
    physics?.dispose()
    script?.dispose()
    return
  }
  starting.delete(documentId)

  sessions.set(
    documentId,
    startPlay({
      documentId,
      renderer,
      editState: () => sceneOf(useScenes.getState(), documentId),
      input,
      frames: animationFrames(),
      physics,
      script,
      modules,
      onReport,
    }),
  )
}

/**
 * Every script the project holds, compiled.
 *
 * 🛑 The COMPILER is kept for the window, not the modules: what a Play must not do is parse nine
 * megabytes of TypeScript again for a file nobody touched — and a file that WAS touched has to
 * be read again, which is why the sources are asked for every time and the cache is keyed on
 * their digest.
 */
async function compiled(): Promise<readonly ScriptModule[]> {
  const files = (await getBridge()?.game.scripts()) ?? []
  if (files.length === 0) return []

  compiler ??= createScriptCompiler()
  const { modules, troubles } = await compiler.compile(
    files.map(file => ({
      script: refToString({ kind: 'script', path: file.path }),
      source: file.source,
    })),
  )
  for (const trouble of troubles) {
    // Refused at compile, and named: what the sandbox would otherwise throw halfway through.
    modules.push({ script: trouble.script, code: refusal(trouble.script, trouble) })
  }
  return modules
}

/**
 * A module that does nothing but SAY why it is not there, so an author sees the refusal on the
 * game's own log rather than a script that silently never ran.
 */
const refusal = (script: string, trouble: { message: string; line: number }): string =>
  `exports.default = defineScript({ onCreate() { game.log.error(${JSON.stringify(
    `${script}:${trouble.line} — cannot import ${trouble.message}`,
  )}) } })`

let compiler: ReturnType<typeof createScriptCompiler> | null = null

/** What a document's game says about itself, or the still report — never `undefined` on screen. */
export function playReportOf(state: PlayStoreState, documentId: string): RuntimeReport {
  return state.reports[documentId] ?? NOT_PLAYING
}

const withoutReport = (
  reports: Record<string, RuntimeReport>,
  documentId: string,
): Record<string, RuntimeReport> =>
  Object.fromEntries(Object.entries(reports).filter(([id]) => id !== documentId))
