// SPDX-License-Identifier: MIT
import { useCallback, useEffect, useRef, useState } from 'react'
import type { GamepadControl } from '@shared/domain/inputMap'
import { GAMEPAD_AXES, GAMEPAD_BUTTONS } from '@game/runtime/inputMaps'

/** Below this a resting stick still drifts and a trigger still reads a few hundredths. */
const PRESSED = 0.6

export type InputCapture = {
  /** Whether a control is being waited on right now — the button says so while it is true. */
  capturing: boolean
  /** Waits for the next key. Answers a `KeyboardEvent.code`; Escape gives up. */
  captureKey: (taken: (code: string) => void) => void
  /** Waits for the next gamepad control pushed past its rest, on any standard controller. */
  captureGamepadControl: (taken: (control: GamepadControl) => void) => void
  /** Gives up without binding anything. */
  cancel: () => void
}

/**
 * 🛑 « Press the key you want » rather than typing `ShiftLeft` into a text field, which is what
 * the expert editor asked for and what nobody knows by heart. The exported game's controls menu
 * has done this since it shipped; this is the same gesture, in the studio.
 */
export function useInputCapture(): InputCapture {
  const [capturing, setCapturing] = useState(false)
  // Held in refs, not in state: the listener is attached once and must see the latest taker.
  const keyTaker = useRef<((code: string) => void) | null>(null)
  const padTaker = useRef<((control: GamepadControl) => void) | null>(null)
  const polling = useRef(0)

  const stop = useCallback((): void => {
    keyTaker.current = null
    padTaker.current = null
    if (polling.current !== 0) cancelAnimationFrame(polling.current)
    polling.current = 0
    setCapturing(false)
  }, [])

  useEffect(() => {
    if (!capturing) return
    const onKeyDown = (event: KeyboardEvent): void => {
      // The capture eats the key: Space on the armed button would otherwise press it again.
      event.preventDefault()
      const take = keyTaker.current
      stop()
      if (event.code !== 'Escape') take?.(event.code)
    }
    window.addEventListener('keydown', onKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true })
  }, [capturing, stop])

  const captureKey = useCallback((taken: (code: string) => void): void => {
    keyTaker.current = taken
    setCapturing(true)
  }, [])

  const captureGamepadControl = useCallback(
    (taken: (control: GamepadControl) => void): void => {
      padTaker.current = taken
      setCapturing(true)
      const look = (): void => {
        const pushed = pushedControl()
        if (pushed === null) {
          polling.current = requestAnimationFrame(look)
          return
        }
        const take = padTaker.current
        stop()
        take?.(pushed)
      }
      polling.current = requestAnimationFrame(look)
    },
    [stop],
  )

  // Escape hatch for a panel closed mid-capture: the frame loop must not outlive the editor.
  useEffect(() => stop, [stop])

  return { capturing, captureKey, captureGamepadControl, cancel: stop }
}

/** The first control of any connected standard controller pushed past rest, or nothing. */
function pushedControl(): GamepadControl | null {
  if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') return null
  for (const gamepad of navigator.getGamepads()) {
    if (!gamepad || gamepad.mapping !== 'standard') continue
    const button = gamepad.buttons.findIndex(one => one.value > PRESSED)
    if (button >= 0 && GAMEPAD_BUTTONS[button] !== undefined) return GAMEPAD_BUTTONS[button]
    const axis = gamepad.axes.findIndex(value => Math.abs(value) > PRESSED)
    if (axis >= 0 && GAMEPAD_AXES[axis] !== undefined) return GAMEPAD_AXES[axis]
  }
  return null
}
