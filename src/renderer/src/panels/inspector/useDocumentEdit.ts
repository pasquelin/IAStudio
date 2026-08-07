import { useMemo } from 'react'
import type { GestureProps } from '@/design/styles'
import type { Command } from '@/engines/core/history'
import type { DocumentStoreState } from '@/stores/document-store'

export type DocumentEdit<S> = {
  run: (command: Command<S>) => void
  /** Spread onto a field, which reports both ends of what the user did in one go. */
  gesture: Required<GestureProps>
}

/** Anything `createDocumentStore` returns — read at call time, never subscribed to. */
type Store<S> = { getState: () => DocumentStoreState<S> }

/**
 * Editing one document: a command to run, and the gesture that groups a drag into one history
 * entry. Read from the store at call time rather than subscribed to — the inspector re-renders
 * on every value a drag emits, and a bound action would be a new object on each of them.
 *
 * Generic over the store because a scene, a sequence and a take all need the same three calls,
 * and three copies of them would drift.
 */
export function useDocumentEdit<S>(store: Store<S>, documentId: string): DocumentEdit<S> {
  return useMemo(
    () => ({
      run: command => store.getState().runCommand(documentId, command),
      gesture: {
        onGestureStart: () => store.getState().beginGesture(documentId),
        onGestureEnd: () => store.getState().endGesture(documentId),
      },
    }),
    [store, documentId],
  )
}
