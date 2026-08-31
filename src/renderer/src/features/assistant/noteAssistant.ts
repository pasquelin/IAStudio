import type { WindowNote } from '@shared/domain/assistantNote'
import { traceFailure } from '@/services/diagnostics'
import { getBridge } from '@/services/bridge'

/**
 * Writes down what the chain just did — to the MAIN, which holds the journal and the log.
 *
 * 🛑 Fire and forget: this is called between two actions of a plan, so a chain that waited on the
 * disk would run at the journal's pace. Swallowed with a word rather than bare — an unhandled
 * rejection kills the process since Node 15.
 */
export function noteAssistant(note: WindowNote): void {
  void getBridge()
    ?.assistant.note(note)
    .catch(reason => traceFailure('shell.dropped', 'assistant note', reason))
}
