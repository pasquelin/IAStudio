import type { TurnPort } from '@/engines/canvas/commands'
import { canvasHost } from './canvasHosts'

/**
 * The pixels of a document-wide turn, driven by the command rather than by its caller. Same line
 * as `pixelPort`: the state says the frame turned, the engine turns what is in it, and the two
 * halves stay together through undo and redo.
 *
 * The engine is resolved at call time and not captured: an undo can land long after the one that
 * applied the turn was replaced, and the current one holds the textures.
 */
export function turnPort(documentId: string): TurnPort {
  return { turn: clockwise => canvasHost(documentId)?.turnQuarter(clockwise) }
}
