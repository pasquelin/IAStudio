import { useCallback } from 'react'
import { useDictation as useDictationStore } from '@/stores/dictation'
import { useSettings } from '@/stores/settings'
import { useHeldCommand } from './useHeldCommand'

/**
 * The push-to-talk key, heard once for the whole window.
 *
 * Mounted by the shell rather than by a panel: dictation writes wherever the caret is, so it
 * belongs to the window and not to whichever surface happens to be open. What holding and
 * releasing mean is the store's business — see `setHeld`.
 */
export function useDictationShortcut(): void {
  const enabled = useSettings(state => state.settings.dictation.enabled)
  const setHeld = useDictationStore(state => state.setHeld)

  useHeldCommand(
    'app.dictate',
    enabled,
    useCallback(held => void setHeld(held), [setHeld]),
  )
}
