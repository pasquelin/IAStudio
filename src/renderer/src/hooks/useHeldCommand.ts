import { useEffect } from 'react'
import type { CommandId } from '@shared/domain/command'
import { heldCommandFor } from '@shared/domain/command'
import { signatureOf } from '@shared/domain/shortcut'
import { IS_MAC } from '@/helpers/platform'
import { currentOverrides } from '@/stores/bindings'
import { useLatest } from './useLatest'

/** `KeyboardEvent.key` of the four modifiers, whichever side of the keyboard they came from. */
const MODIFIER_KEYS: ReadonlySet<string> = new Set(['Alt', 'Control', 'Meta', 'Shift'])

/**
 * A command that is held rather than tapped — dictation, and anything later that works the same
 * way. Mounted once by the shell rather than by each surface: five documents listening would
 * report one press five times, and the surfaces above already share this module's guards.
 *
 * Held commands are matched across scopes and are never claimed by the native menu, which has
 * no release to report — see `heldCommandFor`.
 */
export function useHeldCommand(
  command: CommandId,
  enabled: boolean,
  onChange: (held: boolean) => void,
): void {
  const handler = useLatest(onChange)

  useEffect(() => {
    if (!enabled) return

    // The physical key the chord started on. A release is recognised by it rather than by
    // rebuilding the signature — see `releases`.
    let pressed: string | null = null

    let down = false
    const set = (held: boolean) => {
      if (down === held) return
      down = held
      handler.current(held)
    }

    const matches = (event: KeyboardEvent) =>
      heldCommandFor(signatureOf(event, IS_MAC), currentOverrides()) === command

    // No typing guard, on either edge: a held command carries a modifier and exists to be used
    // from inside a field — and a key pressed outside one and released inside it still has to
    // be let go, or dictation would stay on with nothing holding it.
    const onKeyDown = (event: KeyboardEvent) => {
      if (!matches(event)) return
      event.preventDefault()
      pressed = event.code
      set(true)
    }

    /**
     * Whether this release ends the chord: the key it started on coming up, or any modifier —
     * since a held command always carries one.
     *
     * Not `matches(event)`, which rebuilds the signature from the modifiers as they stand at
     * that instant. Letting go of ⌥ before D — which is what a hand does — sends `keyup` for D
     * with `altKey: false`, signature `KeyD`, matching nothing. The microphone stayed open, and
     * `down` stayed `true`, so every later press was ignored: the shortcut was dead until the
     * window lost focus.
     */
    const releases = (event: KeyboardEvent) =>
      event.code === pressed || MODIFIER_KEYS.has(event.key)

    const onKeyUp = (event: KeyboardEvent) => {
      if (!releases(event)) return
      pressed = null
      set(false)
    }

    // The window losing focus never delivers the keyup — the same hole the motions have.
    const onBlur = () => {
      pressed = null
      set(false)
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
      set(false)
    }
  }, [command, enabled, handler])
}
