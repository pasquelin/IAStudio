// SPDX-License-Identifier: MIT
import { useEffect } from 'react'
import { useSettings } from '@/stores/settings'

export type GamepadNavigationState = {
  next: boolean
  previous: boolean
  confirm: boolean
  back: boolean
}

const RESTING: GamepadNavigationState = {
  next: false,
  previous: false,
  confirm: false,
  back: false,
}
const FOCUSABLE = [
  'button:not(:disabled)',
  'input:not(:disabled)',
  'textarea:not(:disabled)',
  'select:not(:disabled)',
  'a[href]',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function freshlyPressed(
  current: GamepadNavigationState,
  previous: GamepadNavigationState,
  key: keyof GamepadNavigationState,
): boolean {
  return current[key] && !previous[key]
}

function focusBy(offset: number): void {
  const controls = Array.from(document.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(isVisible)
  if (controls.length === 0) return
  const current = controls.indexOf(
    document.activeElement instanceof HTMLElement ? document.activeElement : document.body,
  )
  const next = current < 0 ? 0 : (current + offset + controls.length) % controls.length
  controls[next]?.focus()
}

function isVisible(element: HTMLElement): boolean {
  if (element instanceof HTMLInputElement && element.type === 'hidden') return false
  let current: HTMLElement | null = element
  while (current) {
    const style = getComputedStyle(current)
    if (
      current.hidden ||
      current.inert ||
      current.getAttribute('aria-hidden') === 'true' ||
      style.display === 'none' ||
      style.visibility === 'hidden'
    )
      return false
    current = current.parentElement
  }
  return true
}

export function applyGamepadNavigation(
  current: GamepadNavigationState,
  previous: GamepadNavigationState,
): void {
  if (freshlyPressed(current, previous, 'next')) focusBy(1)
  if (freshlyPressed(current, previous, 'previous')) focusBy(-1)
  if (freshlyPressed(current, previous, 'confirm') && document.activeElement instanceof HTMLElement)
    document.activeElement.click()
  if (freshlyPressed(current, previous, 'back') && document.activeElement instanceof HTMLElement)
    document.activeElement.blur()
}

function navigationState(gamepads: readonly (Gamepad | null)[]): GamepadNavigationState {
  return gamepads.reduce<GamepadNavigationState>(
    (state, gamepad) => ({
      next:
        state.next ||
        gamepad?.buttons[13]?.pressed === true ||
        gamepad?.buttons[15]?.pressed === true ||
        (gamepad?.axes[0] ?? 0) > 0.5 ||
        (gamepad?.axes[1] ?? 0) > 0.5,
      previous:
        state.previous ||
        gamepad?.buttons[12]?.pressed === true ||
        gamepad?.buttons[14]?.pressed === true ||
        (gamepad?.axes[0] ?? 0) < -0.5 ||
        (gamepad?.axes[1] ?? 0) < -0.5,
      confirm: state.confirm || gamepad?.buttons[0]?.pressed === true,
      back: state.back || gamepad?.buttons[1]?.pressed === true,
    }),
    RESTING,
  )
}

export function useGamepadNavigation(): void {
  const enabled = useSettings(state => state.settings.input.gamepadNavigation)

  useEffect(() => {
    if (!enabled || typeof navigator.getGamepads !== 'function') return
    let previous = RESTING
    let frame = requestAnimationFrame(function poll() {
      const current = navigationState(Array.from(navigator.getGamepads()))
      applyGamepadNavigation(current, previous)
      previous = current
      frame = requestAnimationFrame(poll)
    })
    return () => cancelAnimationFrame(frame)
  }, [enabled])
}
