import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_BINDINGS, DEFAULT_MOTION } from '@shared/domain/shortcut'
import { commandFor, conflicts, motionFor, useKeymap } from './keymap'

describe('keymap store', () => {
  beforeEach(() => {
    useKeymap.setState({ bindings: { ...DEFAULT_BINDINGS }, motion: { ...DEFAULT_MOTION } })
  })

  /**
   * Zustand merges a persisted store one level deep, so a table stored before a command
   * existed comes back without it — and `shortcutLabel(undefined)` throws on the first render
   * of the toolbar that shows it.
   */
  it('completes a persisted table with the commands it predates', () => {
    localStorage.setItem(
      'scenario-studio:keymap',
      JSON.stringify({ version: 1, state: { bindings: { 'scene.rotate': 'KeyX' }, motion: {} } }),
    )
    useKeymap.persist.rehydrate()

    const { bindings, motion } = useKeymap.getState()
    expect(bindings['scene.select']).toBe(DEFAULT_BINDINGS['scene.select'])
    expect(bindings['sequence.playPause']).toBe(DEFAULT_BINDINGS['sequence.playPause'])
    expect(bindings['scene.rotate']).toBe('KeyX')
    expect(motion.forward).toBe(DEFAULT_MOTION.forward)
    localStorage.removeItem('scenario-studio:keymap')
  })

  it('drops a remap of a command this build no longer knows', () => {
    localStorage.setItem(
      'scenario-studio:keymap',
      JSON.stringify({ version: 1, state: { bindings: { 'scene.teleport': 'KeyT' } } }),
    )
    useKeymap.persist.rehydrate()

    expect(commandFor(useKeymap.getState(), 'KeyT')).toBeNull()
    localStorage.removeItem('scenario-studio:keymap')
  })

  it('resolves a signature to its command', () => {
    expect(commandFor(useKeymap.getState(), 'KeyG')).toBe('scene.translate')
  })

  it('resolves nothing for an unbound signature', () => {
    expect(commandFor(useKeymap.getState(), 'KeyP')).toBeNull()
  })

  it('resolves a signature to its motion', () => {
    expect(motionFor(useKeymap.getState(), 'KeyW')).toBe('forward')
  })

  it('follows a rebound command and drops the old signature', () => {
    useKeymap.getState().rebind('scene.translate', 'KeyT')
    expect(commandFor(useKeymap.getState(), 'KeyT')).toBe('scene.translate')
    expect(commandFor(useKeymap.getState(), 'KeyG')).toBeNull()
  })

  it('reports no conflict on the defaults', () => {
    expect(conflicts(useKeymap.getState())).toEqual([])
  })

  it('reports both commands when a rebind collides', () => {
    useKeymap.getState().rebind('scene.frame', 'KeyG')
    expect(conflicts(useKeymap.getState()).sort()).toEqual(['scene.frame', 'scene.translate'])
  })

  it('gives the defaults back on reset', () => {
    useKeymap.getState().rebind('scene.translate', 'KeyT')
    useKeymap.getState().reset()
    expect(useKeymap.getState().bindings).toEqual(DEFAULT_BINDINGS)
  })
})
