import { describe, expect, it } from 'vitest'
import { scriptProps } from './scriptProps'

const wrote = (props: string): string =>
  `import { defineScript } from '@studio'\nexport default defineScript({\n  props: { ${props} },\n  onUpdate() {},\n})`

describe('the settings a script declares', () => {
  it('reads a field per declared setting, typed by its default', () => {
    const held = scriptProps(wrote("speed: 4, friendly: true, name: 'Bob'"))

    expect(held.map(one => [one.field.key, one.field.kind, one.fallback])).toEqual([
      ['speed', 'number', 4],
      ['friendly', 'boolean', true],
      ['name', 'text', 'Bob'],
    ])
  })

  it('reads a negative number, which the parser sees as an expression', () => {
    expect(scriptProps(wrote('gravity: -9.81'))[0]?.fallback).toBe(-9.81)
  })

  /** 🛑 Left out rather than guessed at: an editor must not invent a default nobody wrote. */
  it('leaves out what is not a plain value', () => {
    const held = scriptProps(wrote('speed: 4, target: someEntity(), shape: { x: 1 }'))

    expect(held.map(one => one.field.key)).toEqual(['speed'])
  })

  it('answers nothing for a script that declares none', () => {
    expect(scriptProps('export default defineScript({ onUpdate() {} })')).toEqual([])
  })

  /** Read before it has ever run: a script that would throw is still inspectable. */
  it('reads a script whose body would fail', () => {
    const held = scriptProps(
      'export default defineScript({ props: { speed: 2 }, onUpdate() { throw new Error("no") } })',
    )

    expect(held.map(one => one.field.key)).toEqual(['speed'])
  })
})
