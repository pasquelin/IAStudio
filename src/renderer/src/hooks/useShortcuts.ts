import { useEffect, useRef, type RefObject } from 'react'
import { signatureOf, type CommandId, type MotionId } from '@shared/domain/shortcut'
import { commandFor, motionFor, useKeymap } from '@/stores/keymap'

export type ShortcutsOptions = {
  /** A document only listens while it is the visible tab. */
  enabled: boolean
  onCommand: (command: CommandId) => void
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
 * Commands fire once on press; motions are held and read every frame by the renderer, which is
 * why they come back as a mutable ref rather than state — a set that changes sixty times a
 * second must not re-render anything.
 */
export function useShortcuts({ enabled, onCommand }: ShortcutsOptions): {
  heldMotion: RefObject<Set<MotionId>>
} {
  const heldMotion = useRef<Set<MotionId>>(new Set())
  const handler = useRef(onCommand)

  // Kept in an effect rather than assigned while rendering: a ref written during render is
  // read by the listener that the effect below never re-subscribes.
  useEffect(() => {
    handler.current = onCommand
  }, [onCommand])

  useEffect(() => {
    const held = heldMotion.current
    if (!enabled) {
      held.clear()
      return
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (isTyping(event.target)) return
      const signature = signatureOf(event)
      const keymap = useKeymap.getState()

      const motion = motionFor(keymap, signature)
      if (motion) held.add(motion)

      const command = commandFor(keymap, signature)
      if (!command) return
      event.preventDefault()
      handler.current(command)
    }

    const onKeyUp = (event: KeyboardEvent) => {
      const motion = motionFor(useKeymap.getState(), signatureOf(event))
      if (motion) held.delete(motion)
    }

    // The window losing focus never delivers the keyup: without this the camera would keep
    // flying after an ⌘Tab.
    const onBlur = () => held.clear()

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
      held.clear()
    }
  }, [enabled])

  return { heldMotion }
}
