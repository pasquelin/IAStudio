import { describe, expect, it } from 'vitest'
import type { ActionField } from './assistantAction'
import {
  COMPONENT_TYPES,
  COMPONENTS,
  componentValueOf,
  descriptorOf,
  isComponentType,
  newComponent,
  withComponentField,
} from './componentRegistry'

describe('what the studio knows about a component', () => {
  /**
   * One default per field, and no default naming a field that does not exist. Both directions:
   * a missing default leaves an inspector row empty, and a stray one writes a key into the
   * document that no form will ever show again.
   */
  it('describes exactly the fields it hands defaults for', () => {
    for (const descriptor of Object.values(COMPONENTS)) {
      expect(descriptor.fields.map(field => field.key).sort()).toEqual(
        Object.keys(descriptor.defaults).sort(),
      )
    }
  })

  it('names a type it holds, and refuses anything else', () => {
    expect(isComponentType('Health')).toBe(true)
    expect(isComponentType('Wings')).toBe(false)
    expect(isComponentType(7)).toBe(false)
    expect(COMPONENT_TYPES).toContain('Health')
  })

  it('makes one at its defaults, wearing its own type', () => {
    expect(newComponent('Health')).toEqual({ ...descriptorOf('Health').defaults, type: 'Health' })
  })

  /**
   * An inspector form and an MCP call both hand over whatever they were given. A key nobody
   * declared would ride into the document and out of it for ever, invisible to every surface.
   */
  it('writes a field it declares, and drops one it does not', () => {
    const health = newComponent('Health')

    expect(withComponentField(health, 'current', 3).current).toBe(3)
    expect(withComponentField(health, 'stamina', 3)).toEqual(health)
  })
})

describe('the word a client sent, read as the field declares it', () => {
  const fieldOf = (key: string): ActionField => {
    const field = [...descriptorOf('Movement').fields, ...descriptorOf('Health').fields].find(
      one => one.key === key,
    )
    if (!field) throw new Error(`no field ${key}`)
    return field
  }

  it('reads a number, and refuses one the field would not hold', () => {
    expect(componentValueOf(fieldOf('speed'), '2.5')).toBe(2.5)
    expect(componentValueOf(fieldOf('speed'), '-1')).toBeNull()
    expect(componentValueOf(fieldOf('speed'), 'beaucoup')).toBeNull()
  })

  /** Without this an axis of `north` reaches the document, the file, and no system at all. */
  it('reads only a value the choice offers', () => {
    expect(componentValueOf(fieldOf('axis'), 'x')).toBe('x')
    expect(componentValueOf(fieldOf('axis'), 'north')).toBeNull()
  })

  it('reads a switch by its two words, and nothing else', () => {
    const flag: ActionField = { key: 'on', kind: 'boolean', labelKey: 'x', required: true }

    expect(componentValueOf(flag, 'true')).toBe(true)
    expect(componentValueOf(flag, 'false')).toBe(false)
    expect(componentValueOf(flag, 'oui')).toBeNull()
  })
})
