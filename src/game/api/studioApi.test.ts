// SPDX-License-Identifier: MIT

import { describe, expect, it } from 'vitest'
import STUDIO_TYPES from './studio.d.ts?raw'
import { KERNEL } from '../script/kernel'
import type { ScriptHook } from '../script/frame'

/** Generic since a script's `props` are typed by what it declares — the marker follows. */
const SELF_OPENS = 'export type Self<P = Record<string, unknown>> = {'

/** What a fixed step drives, spelled out so the declaration is compared against something. */
const STEP_HOOKS: readonly ScriptHook[] = ['onCreate', 'onStart', 'onUpdate', 'onLateUpdate']

/** The text between two markers, which is how a block is read out of either file. */
const between = (text: string, from: string, to: string): string => {
  const start = text.indexOf(from)
  expect(start, `missing: ${from}`).toBeGreaterThanOrEqual(0)
  const end = text.indexOf(to, start + from.length)
  expect(end, `missing: ${to}`).toBeGreaterThan(start)
  return text.slice(start + from.length, end)
}

/**
 * 🛑 Every member as a PATH — `events.emit`, not `emit`.
 *
 * Flat names let a member move between groups unseen: `game.emit` and `game.events.emit` are the
 * same name, and one of them throws at runtime. Measured on a mutation, which is why this reads
 * the nesting off the indentation rather than the names alone.
 */
function paths(block: string, member: (line: string) => string | null): Set<string> {
  const held = new Set<string>()
  const open: { depth: number; name: string }[] = []

  for (const line of block.split('\n')) {
    const depth = /^ */.exec(line)?.[0].length ?? 0
    while (open.length > 0 && depth <= (open.at(-1)?.depth ?? 0)) open.pop()

    const inside = open.map(one => one.name)
    const grouped = GROUP.exec(line)?.[1]
    if (grouped !== undefined) {
      held.add([...inside, grouped].join('.'))
      open.push({ depth, name: grouped })
      continue
    }
    const name = member(line)
    if (name !== null) held.add([...inside, name].join('.'))
  }
  return held
}

/** A line opening a nested object, on either side: `log: {`. */
const GROUP = /^\s+(?:readonly )?(\w+): \{\s*$/

/** A kernel object literal: `info: function (…)`, `float: draw`, `id: entity.entity`. */
const built = (block: string): Set<string> =>
  paths(block, line => /^\s+(\w+): (?!\{\s*$)/.exec(line)?.[1] ?? null)

/** A declaration: `get(…)`, `readonly id: string`, `pointer: { … }` on one line. */
const declared = (block: string): Set<string> =>
  paths(block, line => /^\s+(?:readonly )?(\w+)(?:\(|\??: (?!\{\s*$))/.exec(line)?.[1] ?? null)

/**
 * 🛑 The half a typecheck cannot see. `studio.d.ts` is what an author's editor believes, and the
 * kernel ships as TEXT — a member on one side and not the other breaks at runtime, green on both.
 */
describe('what a script is told it may call', () => {
  it.each([
    {
      surface: 'game',
      inside: () => built(between(KERNEL, 'globalThis.game = {', '\n  }\n\n  function selfOf')),
      written: () => declared(between(STUDIO_TYPES, 'export const game: {', '\n  }\n\n  /**')),
    },
    {
      surface: 'self',
      inside: () =>
        built(between(KERNEL, 'function selfOf(entity, held) {', '\n  }\n\n  function has')),
      written: () => declared(between(STUDIO_TYPES, SELF_OPENS, '\n  }\n\n  /** The step')),
    },
    {
      surface: 'ctx',
      inside: () =>
        built(between(KERNEL, 'function contextOf(frame) {', '\n  }\n\n  // The line an editor')),
      written: () =>
        declared(between(STUDIO_TYPES, 'export type Context = {', '\n  }\n\n  /** What an event')),
    },
  ])(
    'declares exactly what the sandbox builds on $surface, nesting included',
    ({ inside, written }) => {
      const there = inside()
      const said = written()

      expect(there.size).toBeGreaterThan(2)
      expect([...there].filter(name => !said.has(name)).sort()).toEqual([])
      expect([...said].filter(name => !there.has(name)).sort()).toEqual([])
    },
  )

  /** Every hook an author can write is one something drives, and the reverse. */
  it('declares exactly the hooks something drives', () => {
    const written = [...STUDIO_TYPES.matchAll(/^\s{4}(on\w+)\?\(/gm)].map(match => match[1] ?? '')
    const byEvent = [...KERNEL.matchAll(/^\s+\w+: '(on\w+)',$/gm)].map(match => match[1] ?? '')
    const byName = [...KERNEL.matchAll(/call\('(on\w+)'/g)].map(match => match[1] ?? '')

    expect([...written].sort()).toEqual([...new Set([...STEP_HOOKS, ...byEvent, ...byName])].sort())
  })

  it('names the top-level things the sandbox puts on the global', () => {
    for (const name of ['defineScript', 'game']) {
      expect(KERNEL).toContain(`globalThis.${name} =`)
      expect(STUDIO_TYPES).toContain(name)
    }
  })
})
