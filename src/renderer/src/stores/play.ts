import { create } from 'zustand'
import { NOT_PLAYING, type RuntimeReport } from '@shared/domain/gameRuntime'
import type { DomInputTarget } from '@game/host/domInput'
import { orElse } from '@shared/promises'
import { loadRapierPhysics } from '@game/host/rapierPhysics'
import { loadQuickjsScripts } from '@game/host/quickjsScripts'
import type { ScriptModule } from '@game/ports/scriptPort'
import {
  createScriptCompiler,
  type ScriptCompiler,
  type ScriptTrouble,
} from '@/engines/code/scriptCompiler'
import { animationFrames, startPlay, type PlaySession } from '@/game/playSession'
import { codeFilesOf, useCode } from './code'
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
 * The engines first, the world second — the WebAssembly weighs 2,7 Mo and lands in 27 ms, which is
 * a frame nobody sees but not a wait a Play button may take synchronously.
 */
async function begin(
  documentId: string,
  token: number,
  input: DomInputTarget,
  onReport: (report: RuntimeReport) => void,
): Promise<void> {
  // All three together, and each failing on its own: the machines are independent, and reading
  // the project's scripts off the disk fits entirely under the time a WebAssembly takes to land.
  const [physics, script, compiled] = await Promise.all([
    orElse(loadRapierPhysics(), undefined),
    orElse(loadQuickjsScripts(), undefined),
    // 🛑 Guarded like the other two: a rejection here left `starting` holding the document, and
    // the Play button then did NOTHING until its viewport unmounted.
    orElse(scriptsOfProject(), NO_SCRIPTS),
  ])

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
      modules: compiled.modules,
      troubles: compiled.troubles,
      onReport,
    }),
  )
}

/**
 * 🛑 The COMPILER is kept for the window, not the modules: a Play must not parse nine megabytes of
 * TypeScript again for a file nobody touched, and a file that WAS touched has to be read again.
 */
let compiler: ScriptCompiler | null = null

type CompiledScripts = { modules: readonly ScriptModule[]; troubles: readonly ScriptTrouble[] }

const NO_SCRIPTS: CompiledScripts = { modules: [], troubles: [] }

async function scriptsOfProject(): Promise<CompiledScripts> {
  // 🛑 Through the EDITOR's own reading, never a second walk of the disk: what a Play compiles
  // has to be what the screen shows, or an author watches the script from before their last
  // keystroke run — without a word.
  await useCode.getState().reload()
  const files = codeFilesOf(useCode.getState())
  if (files.length === 0) return NO_SCRIPTS

  compiler ??= createScriptCompiler()
  return await compiler.compile(files.map(file => ({ script: file.script, source: file.source })))
}

/** What a document's game says about itself, or the still report — never `undefined` on screen. */
export function playReportOf(state: PlayStoreState, documentId: string): RuntimeReport {
  return state.reports[documentId] ?? NOT_PLAYING
}

const withoutReport = (
  reports: Record<string, RuntimeReport>,
  documentId: string,
): Record<string, RuntimeReport> =>
  Object.fromEntries(Object.entries(reports).filter(([id]) => id !== documentId))
