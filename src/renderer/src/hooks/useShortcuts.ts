import { type CommandId, type CommandScope } from '@shared/domain/command'
import { copiesText, type MotionId, signatureOf } from '@shared/domain/shortcut'
import { useEffect, useRef, type RefObject } from 'react'
import { commandDescriptor, commandFor, heldCommandFor } from '@shared/domain/command'
import { subscribeToCommands } from '@/services/command-bus'
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

function holdsText(): boolean {
  const selection = window.getSelection()
  return selection !== null && !selection.isCollapsed
}

/** Whether a command is heard where the focus currently sits — see `whileTyping`. */
function reaches(command: CommandId, target: EventTarget | null): boolean {
  return !isTyping(target) || commandDescriptor(command)?.whileTyping === true
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
      if (!command || (copiesText(signature) && holdsText())) return
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
  }, [enabled, scope])

  return { heldMotion }
}

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
  const handler = useRef(onChange)

  useEffect(() => {
    handler.current = onChange
  }, [onChange])

  useEffect(() => {
    if (!enabled) return

    let down = false
    const set = (held: boolean) => {
      if (down === held) return
      down = held
      handler.current(held)
    }

    const matches = (event: KeyboardEvent) =>
      heldCommandFor(signatureOf(event), currentOverrides()) === command

    const onKeyDown = (event: KeyboardEvent) => {
      if (!matches(event) || !reaches(command, event.target)) return
      event.preventDefault()
      set(true)
    }

    // Matched on the key alone, without `reaches`: a key pressed outside a field and released
    // inside one still has to be let go, or dictation would stay on with nothing holding it.
    const onKeyUp = (event: KeyboardEvent) => {
      if (matches(event)) set(false)
    }

    // The window losing focus never delivers the keyup — the same hole the motions have.
    const onBlur = () => set(false)

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
      set(false)
    }
  }, [command, enabled])
}
