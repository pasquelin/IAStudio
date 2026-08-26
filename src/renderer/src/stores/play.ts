import { create } from 'zustand'
import { NOT_PLAYING, type RuntimeReport } from '@shared/domain/gameRuntime'
import type { DomInputTarget } from '@game/host/domInput'
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

export const usePlay = create<PlayStoreState>()(set => ({
  reports: {},

  start: (documentId, input) => {
    const renderer = sceneEngineOf(documentId)
    // No viewport, no game: the runtime draws through the engine that viewport owns.
    if (!renderer || sessions.has(documentId)) return

    sessions.set(
      documentId,
      startPlay({
        documentId,
        renderer,
        editState: () => sceneOf(useScenes.getState(), documentId),
        input,
        frames: animationFrames(),
        onReport: report => set(state => ({ reports: { ...state.reports, [documentId]: report } })),
      }),
    )
  },

  pause: documentId => sessions.get(documentId)?.pause(),
  resume: documentId => sessions.get(documentId)?.resume(),

  stop: documentId => {
    sessions.get(documentId)?.stop()
    sessions.delete(documentId)
    set(state => ({ reports: withoutReport(state.reports, documentId) }))
  },
}))

/** What a document's game says about itself, or the still report — never `undefined` on screen. */
export function playReportOf(state: PlayStoreState, documentId: string): RuntimeReport {
  return state.reports[documentId] ?? NOT_PLAYING
}

const withoutReport = (
  reports: Record<string, RuntimeReport>,
  documentId: string,
): Record<string, RuntimeReport> =>
  Object.fromEntries(Object.entries(reports).filter(([id]) => id !== documentId))
