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
import { animationFrames } from '@/game/frameDriver'
import { startPlay, type PlaySession, type SceneLookup } from '@/game/playSession'
import type { SceneState } from '@/engines/scene/sceneState'
import { codeFilesOf, useCode } from './code'
import { documentById, sceneDocumentNamed, useDocuments } from './documents'
import { sceneEngineOf } from './sceneEngines'
import { loadSceneSource, montageSceneOf } from './sceneSources'
import { sceneOf, useScenes } from './scenes'

export type PlayStoreState = {
  /** What each document's game says about itself. A document that is not playing has none. */
  reports: Record<string, RuntimeReport>
  /**
   * `input` is what the keyboard and pointer are read off. Optional, and its absence is not a
   * degraded mode but a DIFFERENT caller: a model driving the game from outside the window has
   * no element to hand over, and a game nobody presses a key in still runs.
   */
  start: (documentId: string, input?: DomInputTarget) => void
  /** Whether there WAS a game to pause: one whose engines are still landing has no session. */
  pause: (documentId: string) => boolean
  resume: (documentId: string) => boolean
  /** Runs that many fixed steps on a PAUSED game and answers how many ran. */
  step: (documentId: string, steps: number) => number
  /** Sends a running game to another scene. Whether there WAS one to send. */
  loadScene: (documentId: string, scene: string, fade: number) => boolean
  stop: (documentId: string) => void
}

/** Ran on the session when there is one, and says whether there WAS one. */
const held = (session: PlaySession | undefined, run: (one: PlaySession) => void): boolean => {
  if (!session) return false
  run(session)
  return true
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
    // A target of its own when none was handed over: `createDomInput` attaches listeners, and
    // one that nothing dispatches to is a game where no key is ever down.
    void begin(documentId, generation, input ?? new EventTarget(), report =>
      set(state => ({ reports: { ...state.reports, [documentId]: report } })),
    )
  },

  // 🛑 Answered rather than swallowed: a game whose engines are still landing has no session,
  // and a caller told « paused » that was not is one that steps a world running under it.
  pause: documentId => held(sessions.get(documentId), one => one.pause()),
  resume: documentId => held(sessions.get(documentId), one => one.resume()),
  step: (documentId, steps) => sessions.get(documentId)?.step(steps) ?? 0,
  loadScene: (documentId, scene, fade) =>
    held(sessions.get(documentId), one => one.loadScene(scene, fade)),

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
    orElse(compiledScripts(), NO_SCRIPTS),
  ])

  // 🛑 The scenes this one goes TO, read while the engines are still landing: a fade that has to
  // wait for a file is a fade that stalls on black, and the timeline names them in advance.
  for (const scene of scenesAhead(sceneOf(useScenes.getState(), documentId))) sceneNamed(scene)

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
      sceneNamed,
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

/**
 * Whether that text would compile, said the way a fault is — or nothing when it would.
 *
 * 🛑 Through the WORKER, never `transpile` in place: the compiler is nine megabytes of parsing
 * and the thread it runs on is the one that draws — invariant 6. The digest cache is the same
 * one a Play reads, so what is checked here is not parsed again a moment later.
 */
export async function scriptTrouble(script: string, source: string): Promise<ScriptTrouble | null> {
  compiler ??= createScriptCompiler()
  return (await compiler.compile([{ script, source }])).troubles[0] ?? null
}

/**
 * Every script of the project, transpiled once. Shared with the EXPORT, which needs the same
 * thing: a compiler built per call leaks a worker and repays nine megabytes of parsing.
 */
export async function compiledScripts(): Promise<CompiledScripts> {
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

/**
 * Another scene of the project, by the title a game names it with or by its id.
 *
 * 🛑 The open TAB wins when there is one: reading the disk alone would load the level as it was
 * before the author's last save.
 */
function sceneNamed(scene: string): SceneLookup {
  const documentId = sceneDocumentNamed(scene)
  const copy = montageSceneOf(documentId)
  if (copy) return { state: copy, document: documentId }

  // The project holds no SCENE under that name: a name to repair, not a file to wait for.
  if (documentById(useDocuments.getState(), documentId)?.kind !== 'scene') return 'unknown'

  void loadSceneSource(documentId)
  return 'reading'
}

/** Which other scenes this one's timeline goes to. What a Play reads ahead of being asked. */
function scenesAhead(state: SceneState): readonly string[] {
  const named = (state.animation.transitions ?? []).flatMap(one => one.scene ?? [])
  return [...new Set(named)]
}
