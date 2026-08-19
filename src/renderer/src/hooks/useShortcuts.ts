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
  /**
   * Which document this surface shows, for the commands a sender addresses by name — see
   * `publishCommand`. Those reach it in a background tab too; keys never do.
   */
  documentId?: string
  onCommand: (command: CommandId) => void
  /** Fires when the held set actually changes — never on a frame tick. */
  onMotionChange?: (held: Set<MotionId>) => void
  /**
   * Whether a flight is under way, and a flight OWNS its keys. Asked at the keystroke rather
   * than passed as state: it begins and ends on a mouse button, and rebuilding this effect
   * twice per gesture would drop whatever was held across it.
   */
  isFlying?: () => boolean
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
export function useShortcuts({
  scope,
  enabled,
  documentId,
  onCommand,
  onMotionChange,
  isFlying,
}: ShortcutsOptions): {
  heldMotion: RefObject<Set<MotionId>>
} {
  const heldMotion = useRef<Set<MotionId>>(new Set())
  const handlers = useLatest({ onCommand, onMotionChange, isFlying })

  /**
   * The same surface, reached the other way: the native menu fires a command outright rather
   * than a key, and on macOS it is the menu — never the window — that hears an accelerator it
   * declared. Both doors have to lead here, or a row of the menu does nothing.
   *
   * Its own effect, outside `enabled`: a command ADDRESSED to a document must reach it in a
   * background tab, which is the one thing a key must never do.
   */
  useEffect(
    () =>
      subscribeToCommands((command, to) => {
        if (commandDescriptor(command)?.scope !== scope) return
        if (to === null ? !enabled : to !== documentId) return
        handlers.current.onCommand(command)
      }),
    [scope, enabled, documentId, handlers],
  )

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
      if (!typing && motion) {
        // Holding a key repeats keydown; only a set that actually changed is worth reporting.
        if (!held.has(motion)) {
          held.add(motion)
          handlers.current.onMotionChange?.(held)
        }

        // A flight owns the key outright, and nothing downstream gets to see it: an arrow would
        // otherwise scroll whatever list the pointer left focused, and `S` would reach
        // `scene.scale` while it means "back". Only the modality tells the two apart.
        if (handlers.current.isFlying?.()) {
          event.preventDefault()
          event.stopPropagation()
          return
        }
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

    // Capture, so a flight takes its key before the focused element reads it: React attaches at
    // the root container, which reaches `window` only once every component has answered. Both
    // edges — a keyup swallowed on one of them leaves the camera flying for good.
    window.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('keyup', onKeyUp, true)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('keyup', onKeyUp, true)
      window.removeEventListener('blur', onBlur)
      release()
    }
  }, [enabled, scope, handlers])

  return { heldMotion }
}
