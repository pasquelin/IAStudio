// SPDX-License-Identifier: MIT

import { describe, expect, it } from 'vitest'
import STUDIO_TYPES from './studio.d.ts?raw'
import { KERNEL } from '../script/kernel'
import type { ScriptHook } from '../script/frame'
import { STUDIO_HOOKS } from './studioApi'

const STEP_HOOKS: readonly ScriptHook[] = ['onCreate', 'onStart', 'onUpdate', 'onLateUpdate']

/** The text between two markers, which is how a block is read out of either file. */
const between = (text: string, from: string, to: string): string => {
  const start = text.indexOf(from)
  expect(start, `missing: ${from}`).toBeGreaterThanOrEqual(0)
  const end = text.indexOf(to, start + from.length)
  expect(end, `missing: ${to}`).toBeGreaterThan(start)
  return text.slice(start + from.length, end)
}

/** The keys an object literal of the kernel binds — `info: function`, `float: draw`. */
const bound = (block: string): Set<string> =>
  new Set([...block.matchAll(/^\s+(\w+): /gm)].map(match => match[1] ?? ''))

/** The members a declaration writes — `get(…)`, `log: {`, `readonly id: string`. */
const written = (block: string): Set<string> =>
  new Set([...block.matchAll(/^\s+(?:readonly )?(\w+)[(:?]/gm)].map(match => match[1] ?? ''))

/**
 * 🛑 The half a typecheck cannot see. `studio.d.ts` is what an author's editor believes, and the
 * kernel ships as TEXT — so a member declared on one side and missing on the other is a promise
 * broken at runtime, with the compiler green on both sides of it.
 */
describe('what a script is told it may call', () => {
  it.each([
    {
      surface: 'game',
      built: () => bound(between(KERNEL, 'globalThis.game = {', '\n  }\n\n  function selfOf')),
      declared: () => written(between(STUDIO_TYPES, 'export const game: {', '\n  }\n\n  /**')),
    },
    {
      surface: 'self',
      built: () =>
        bound(between(KERNEL, 'function selfOf(entity, held) {', '\n  }\n\n  function has')),
      declared: () =>
        written(between(STUDIO_TYPES, 'export type Self = {', '\n  }\n\n  /** The step')),
    },
  ])('declares exactly what the sandbox builds on $surface', ({ built, declared }) => {
    const inside = built()
    const written = declared()

    expect(inside.size).toBeGreaterThan(4)
    expect([...inside].filter(name => !written.has(name))).toEqual([])
    expect([...written].filter(name => !inside.has(name))).toEqual([])
  })

  /**
   * Every hook an author can write is one something drives, and the reverse. The step's four come
   * from `ScriptHook`; the rest are named INSIDE the kernel, which is where they are dispatched.
   */
  it('declares exactly the hooks something drives', () => {
    const declared = [...STUDIO_TYPES.matchAll(/^\s{4}(on\w+)\?\(/gm)].map(match => match[1] ?? '')
    const byEvent = [...KERNEL.matchAll(/^\s+\w+: '(on\w+)',$/gm)].map(match => match[1] ?? '')
    const byName = [...KERNEL.matchAll(/call\('(on\w+)'/g)].map(match => match[1] ?? '')

    expect([...declared].sort()).toEqual([...STUDIO_HOOKS].sort())
    expect([...STUDIO_HOOKS].sort()).toEqual(
      [...new Set([...STEP_HOOKS, ...byEvent, ...byName])].sort(),
    )
  })

  it('names the top-level things the sandbox puts on the global', () => {
    for (const name of ['defineScript', 'game']) {
      expect(KERNEL).toContain(`globalThis.${name} =`)
      expect(STUDIO_TYPES).toContain(name)
    }
  })
})
