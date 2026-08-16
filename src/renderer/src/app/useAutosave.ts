import { useEffect } from 'react'
import { useSettings } from '@/stores/settings'
import { autosaveOpenDocuments } from './document-io'

/**
 * How long between two passes.
 *
 * A round number the help text can name, and long enough that a save is never what the user is
 * waiting on: capturing a scene costs milliseconds, and thirty seconds of work is the most this
 * can cost anyone.
 */
export const AUTOSAVE_INTERVAL_MS = 30_000

/**
 * Writes open documents back on their own, so a crash costs at most half a minute of work.
 *
 * On a timer rather than on each edit: what a document holds changes on every stroke of a
 * pointer, and a save armed by each of them would either fire constantly or need a notion of
 * "done editing" that no editor here has. A pass that finds nothing modified writes nothing, so
 * the idle cost is one predicate per open tab.
 *
 * Mounted by the window that holds documents, once. Turning the setting off clears the timer
 * rather than leaving one that does nothing — a timer nobody can see is a thing to be sure of.
 */
export function useAutosave(): void {
  const enabled = useSettings(state => state.settings.general.autosave)

  useEffect(() => {
    if (!enabled) return

    const timer = setInterval(() => void autosaveOpenDocuments(), AUTOSAVE_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [enabled])
}
