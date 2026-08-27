import { refused, type ActionOutcome } from '@shared/domain/assistant'
import { activeSceneId, useDocuments } from '@/stores/documents'
import { playReportOf, usePlay } from '@/stores/play'
import { sceneEngineOf } from '@/stores/sceneEngines'
import type { ActionHandlers } from './actionHandler'
import { numberOf } from './actionInputs'

/**
 * A game being PLAYED, driven from outside the window — the loop of the plan's § 16.4.
 *
 * 🛑 Every one of them answers AT ONCE. A `play.start` that waited for a frame would hold an MCP
 * client for as long as the WebAssembly takes to land, and the whole point of the loop is that a
 * model starts a game, reads what went wrong, repairs it and starts again without blocking.
 */

/** The scene in front, or the one reason there is none to play. */
function playing(): string | ActionOutcome {
  const documentId = activeSceneId(useDocuments.getState())
  if (documentId === null) return refused('wrongSurface')
  // The runtime draws through the engine a viewport owns: with none, a game would run unseen.
  if (!sceneEngineOf(documentId)) return refused('wrongSurface', 'no viewport draws this scene')
  return documentId
}

const missed = (held: string | ActionOutcome): held is ActionOutcome => typeof held !== 'string'

export const PLAY_HANDLERS: ActionHandlers = {
  'play.start': () => {
    const documentId = playing()
    if (missed(documentId)) return documentId

    usePlay.getState().start(documentId)
    // The state as it is NOW, which is `edit` until the engines land: said rather than waited
    // for, and `runtime.report` is what a client reads a moment later.
    return {
      ok: true,
      data: { documentId, state: playReportOf(usePlay.getState(), documentId).state },
    }
  },

  'play.stop': () => {
    const documentId = playing()
    if (missed(documentId)) return documentId

    usePlay.getState().stop(documentId)
    return { ok: true }
  },

  'play.pause': () => {
    const documentId = playing()
    if (missed(documentId)) return documentId

    // 🛑 A start answers before its engines land, so there is a window where no session exists.
    // Said rather than swallowed: a model told « paused » would step a world still running.
    if (!usePlay.getState().pause(documentId)) return refused('badInput', 'no game is running yet')
    return { ok: true, data: { state: playReportOf(usePlay.getState(), documentId).state } }
  },

  'play.resume': () => {
    const documentId = playing()
    if (missed(documentId)) return documentId

    if (!usePlay.getState().resume(documentId)) return refused('badInput', 'no game is running')
    return { ok: true, data: { state: playReportOf(usePlay.getState(), documentId).state } }
  },

  'play.step': input => {
    const documentId = playing()
    if (missed(documentId)) return documentId

    const ran = usePlay.getState().step(documentId, numberOf(input, 'steps') ?? 1)
    // Nothing ran is not nothing happened: only a PAUSED game steps, and a game whose engines
    // are still landing is not one at all. Both are said, because they are repaired differently.
    if (ran === 0) {
      const state = playReportOf(usePlay.getState(), documentId).state
      return refused('badInput', state === 'edit' ? 'no game is running' : 'the game is not paused')
    }
    return { ok: true, data: { steps: ran, ...readingOf(documentId) } }
  },

  'runtime.report': () => {
    const documentId = playing()
    if (missed(documentId)) return documentId

    return { ok: true, data: readingOf(documentId) }
  },

  'runtime.errors': () => {
    const documentId = playing()
    if (missed(documentId)) return documentId

    // 🛑 ADDRESSABLE, which is what closes the loop: the script's own reference and the line an
    // editor opens. A message alone would send a model reading every file it wrote.
    return { ok: true, data: { errors: playReportOf(usePlay.getState(), documentId).errors } }
  },
}

/** What a game says about itself, without the two lists a reader asks for separately. */
function readingOf(documentId: string): Record<string, unknown> {
  const report = playReportOf(usePlay.getState(), documentId)
  return {
    state: report.state,
    tick: report.tick,
    fps: report.fps,
    frameMs: report.frameMs,
    entities: report.entities,
    errors: report.errors.length,
    logs: report.logs.slice(-20),
  }
}
