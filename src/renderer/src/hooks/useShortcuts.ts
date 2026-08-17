import { useEffect, useRef, type RefObject } from 'react'
import {
  commandDescriptor,
  commandFor,
  type CommandId,
  type CommandScope,
} from '@shared/domain/command'
import { copiesText, type MotionId, signatureOf } from '@shared/domain/shortcut'
import { isTyping } from '@/helpers/typing'
import { subscribeToCommands } from '@/services/commandBus'
import { currentOverrides, motionFor } from '@/stores/bindings'
import { useLatest } from './useLatest'

export type ShortcutsOptions = {
  /** Which surface is listening: the same key means different things on each. */
  scope: CommandScope
  /** A document only listens while it is the visible tab. */
  enabled: boolean
  onCommand: (command: CommandId) => void
  /** Fires when the held set actually changes — never on a frame tick. */
  onMotionChange?: (held: Set<MotionId>) => void
}

function holdsText(): boolean {
  const selection = window.getSelection()
  return selection !== null && !selection.isCollapsed
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
  const handlers = useLatest({ onCommand, onMotionChange })

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
      const typing = isTyping(event.target)
      const signature = signatureOf(event)
      const motion = motionFor(signature)
      // Holding a key repeats keydown; only a set that actually changed is worth reporting.
      if (!typing && motion && !held.has(motion)) {
        held.add(motion)
        handlers.current.onMotionChange?.(held)
      }

      // A field keeps every command, and the lookup is skipped rather than thrown away: ⌘E would
      // flatten a layer while its name is being typed, and the ⌘Z reflex would undo the typing
      // rather than the merge. `commandFor` walks the whole registry, on every keystroke typed.
      if (typing) return

      const command = commandFor(signature, scope, currentOverrides())
      if (!command) return
      if (copiesText(signature) && holdsText()) return
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

    // The same surface, reached the other way: the native menu fires a command outright rather
    // than a key, and on macOS it is the menu — never the window — that hears an accelerator it
    // declared. Both doors have to lead here, or a row of the menu does nothing.
    const stopBus = subscribeToCommands(command => {
      if (commandDescriptor(command)?.scope === scope) handlers.current.onCommand(command)
    })

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      stopBus()
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
      release()
    }
  }, [enabled, scope, handlers])

  return { heldMotion }
}
