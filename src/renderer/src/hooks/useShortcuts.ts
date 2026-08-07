import { type CommandId, type CommandScope } from '@shared/domain/command'
import { type MotionId, signatureOf } from '@shared/domain/shortcut'
import { useEffect, useRef, type RefObject } from 'react'
import { commandFor } from '@shared/domain/command'
import { currentOverrides, motionFor } from '@/stores/bindings'

export type ShortcutsOptions = {
  /** Which surface is listening: the same key means different things on each. */
  scope: CommandScope
  /** A document only listens while it is the visible tab. */
  enabled: boolean
  onCommand: (command: CommandId) => void
  /** Fires when the held set actually changes — never on a frame tick. */
  onMotionChange?: (held: Set<MotionId>) => void
}

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  )
}

/**
 * Commands fire once on press; motions are held, and reported only when the set changes.
 *
 * Pushing on change rather than letting the consumer poll every frame is what keeps an idle
 * viewport idle: a `requestAnimationFrame` loop that only reads a set nobody touched still
 * wakes the CPU sixty times a second.
 *
 * The set is also exposed as a mutable ref, for a consumer that already runs a loop and would
 * rather read it than be called.
 */
export function useShortcuts({ scope, enabled, onCommand, onMotionChange }: ShortcutsOptions): {
  heldMotion: RefObject<Set<MotionId>>
} {
  const heldMotion = useRef<Set<MotionId>>(new Set())
  const handlers = useRef({ onCommand, onMotionChange })

  // Kept in an effect rather than assigned while rendering: a ref written during render is
  // read by the listener that the effect below never re-subscribes.
  useEffect(() => {
    handlers.current = { onCommand, onMotionChange }
  }, [onCommand, onMotionChange])

  useEffect(() => {
    const held = heldMotion.current
    const release = () => {
      if (held.size === 0) return
      held.clear()
      handlers.current.onMotionChange?.(held)
    }

    if (!enabled) {
      release()
      return
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (isTyping(event.target)) return
      const signature = signatureOf(event)
      const motion = motionFor(signature)
      // Holding a key repeats keydown; only a set that actually changed is worth reporting.
      if (motion && !held.has(motion)) {
        held.add(motion)
        handlers.current.onMotionChange?.(held)
      }

      const command = commandFor(signature, scope, currentOverrides())
      if (!command) return
      event.preventDefault()
      // A held key repeats keydown. Space is held far more readily than ⌘Z, and a transport
      // toggled thirty times a second is a strobe, not a shortcut.
      if (!event.repeat) handlers.current.onCommand(command)
    }

    const onKeyUp = (event: KeyboardEvent) => {
      const motion = motionFor(signatureOf(event))
      if (motion && held.delete(motion)) handlers.current.onMotionChange?.(held)
    }

    // The window losing focus never delivers the keyup: without this the camera would keep
    // flying after an ⌘Tab.
    const onBlur = release

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
      release()
    }
  }, [enabled, scope])

  return { heldMotion }
}
