import { describe, expect, it } from 'vitest'
import { assistantAction, ACTION_REGISTRY } from './assistant'
import { MEMORY_WORTH, type MemoryRule } from './memoryWorth'
import { MEMORY_IMPORTANCE_MAX, MEMORY_IMPORTANCE_MIN, MEMORY_TYPES } from './assistantMemory'

const ruled = Object.entries(MEMORY_WORTH).filter(
  (entry): entry is [string, NonNullable<MemoryRule>] => entry[1] !== null,
)

describe('what each action leaves behind', () => {
  /** The compiler already refuses a missing entry; this refuses one that names no action. */
  it('answers for every action of the registry and for nothing else', () => {
    expect(Object.keys(MEMORY_WORTH).filter(name => assistantAction(name) === null)).toEqual([])
    expect(
      ACTION_REGISTRY.filter(action => !(action.name in MEMORY_WORTH)).map(one => one.name),
    ).toEqual([])
  })

  /**
   * 🛑 A rule naming a field its action does not declare reads `undefined` for ever, and nothing
   * else in the studio would say so — the action runs, the memory is never written.
   */
  it('reads no field an action does not declare', () => {
    const wrong = ruled.flatMap(([name, rule]) => {
      const declared = new Set(assistantAction(name)?.fields.map(field => field.key))
      return rule.reads.filter(key => !declared.has(key)).map(key => `${name} reads ${key}`)
    })

    expect(wrong).toEqual([])
  })

  it('draws a type and an importance the domain admits', () => {
    const drawn = ruled.flatMap(([, rule]) => {
      const made = rule.draft(Object.fromEntries(rule.reads.map(key => [key, 'something'])))
      return made === null ? [] : [made]
    })

    expect(drawn).toHaveLength(ruled.length)
    for (const one of drawn) {
      expect(MEMORY_TYPES).toContain(one.type)
      expect(one.importance).toBeGreaterThanOrEqual(MEMORY_IMPORTANCE_MIN)
      expect(one.importance).toBeLessThanOrEqual(MEMORY_IMPORTANCE_MAX)
    }
  })

  /** Nothing at all rather than a memory saying nothing: the field it needed was empty. */
  it('draws nothing when what it reads is absent', () => {
    for (const [, rule] of ruled) expect(rule.draft({})).toBeNull()
  })

  /** The example the lot is measured by: a script leaves a trace, moving a node leaves none. */
  it('remembers a script written, and nothing about a node moved', () => {
    const written = MEMORY_WORTH['script.write']?.draft({ path: 'Scripts/Cam.ts' })

    expect(written).toMatchObject({
      type: 'script',
      values: { path: 'Scripts/Cam.ts' },
      refs: [{ kind: 'file', ref: 'Scripts/Cam.ts' }],
    })
    expect(MEMORY_WORTH['node.transform']).toBeNull()
  })
})
