import { useEffect } from 'react'
import { getBridge } from '@/services/bridge'
import { useAssistant } from '@/stores/assistant'
import { useAssistantChoices } from './useAssistantChoices'

/**
 * Asks the door in front what it reads in one go, and re-asks whenever another one takes over.
 *
 * Before a turn rather than from its frames: what one wants to know before typing is the bound,
 * and a composer that learns it from a turn has nothing to show until one has run.
 */
export function useAssistantDoor(): void {
  const { value } = useAssistantChoices()
  const noteDoor = useAssistant(state => state.noteDoor)

  useEffect(() => {
    const bridge = getBridge()
    // Nothing SERVES is not a door that names no window: the composer says nothing rather than
    // announcing an unknown window for a door that is not there.
    if (!bridge || value === null) {
      noteDoor(undefined)
      return
    }

    let alive = true
    const askTheDoor = async (): Promise<void> => {
      try {
        const answered = await bridge.assistant.window()
        if (alive) noteDoor(answered)
      } catch {
        // A door that cannot answer for its own bound is one whose window is unknown, which is
        // what the composer then says — rather than a ratio against a number nobody read.
        if (alive) noteDoor(null)
      }
    }

    void askTheDoor()
    return () => {
      alive = false
    }
  }, [value, noteDoor])
}
