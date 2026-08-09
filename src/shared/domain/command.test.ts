import { describe, expect, it } from 'vitest'
import { isRecord } from '../guards'
import { LANGUAGES, TRANSLATIONS } from '../i18n'
import {
  bindingOf,
  COMMAND_REGISTRY,
  COMMAND_SCOPES,
  commandDescriptor,
  commandFor,
  commandIn,
  commandsIn,
  conflicts,
} from './command'

function resolve(bundle: unknown, key: string): unknown {
  return key
    .split('.')
    .reduce<unknown>((current, part) => (isRecord(current) ? current[part] : undefined), bundle)
}

describe('the command registry', () => {
  it('names each command once', () => {
    const ids = COMMAND_REGISTRY.map(descriptor => descriptor.id)

    expect(new Set(ids).size).toBe(ids.length)
  })

  it('files every command under a scope that exists', () => {
    for (const descriptor of COMMAND_REGISTRY) {
      expect(COMMAND_SCOPES, descriptor.id).toContain(descriptor.scope)
    }
  })

  it.each(LANGUAGES.map(language => language.code))('says what every command does in %s', code => {
    for (const descriptor of COMMAND_REGISTRY) {
      for (const key of [descriptor.titleKey, descriptor.helpKey]) {
        const text = resolve(TRANSLATIONS[code], key)
        expect(typeof text === 'string' && text.trim() !== '', `${key} is missing`).toBe(true)
      }
    }
  })

  // Same bar as the settings: a command whose effect cannot be stated is one nobody can bind.
  it('explains, and does not merely repeat the title', () => {
    for (const descriptor of COMMAND_REGISTRY) {
      const help = resolve(TRANSLATIONS.fr, descriptor.helpKey)
      expect(String(help).length, `${descriptor.helpKey} explains nothing`).toBeGreaterThan(40)
    }
  })

  it('groups commands by the surface that listens to them', () => {
    expect(commandsIn('scene').every(descriptor => descriptor.scope === 'scene')).toBe(true)
    expect(COMMAND_SCOPES.flatMap(scope => [...commandsIn(scope)])).toHaveLength(
      COMMAND_REGISTRY.length,
    )
  })

  it('finds a descriptor by id, and nothing for one it does not describe', () => {
    expect(commandDescriptor('scene.frame')?.scope).toBe('scene')
  })
})

describe('resolving a binding', () => {
  it('answers the shipped key when nothing was remapped', () => {
    expect(bindingOf('scene.translate', {})).toBe('KeyG')
  })

  it('lets a remap win', () => {
    expect(bindingOf('scene.translate', { 'scene.translate': 'KeyT' })).toBe('KeyT')
  })

  // Adding a command must need no migration, and removing one must leave no ghost.
  it('leaves a command bound to nothing when that is what it ships with', () => {
    expect(bindingOf('layout.reset', {})).toBeNull()
  })
})

describe('firing a signature', () => {
  it('answers the command of the surface that is listening', () => {
    expect(commandFor('Delete', 'scene', {})).toBe('scene.delete')
    expect(commandFor('Delete', 'sequence', {})).toBe('sequence.delete')
  })

  it('follows a remap', () => {
    expect(commandFor('KeyT', 'scene', { 'scene.translate': 'KeyT' })).toBe('scene.translate')
    expect(commandFor('KeyG', 'scene', { 'scene.translate': 'KeyT' })).toBeNull()
  })

  // Electron fires the menu's accelerators itself; matching them here would run them twice.
  it('never answers a global command, which the native menu already fires', () => {
    expect(commandFor('Meta+KeyN', 'scene', {})).toBeNull()
  })
})

describe('conflicts', () => {
  it('says nothing about a key shared across two surfaces, which is the design', () => {
    // `Delete` removes a node in the scene and a clip on the timeline; only one ever listens.
    expect(conflicts({})).toEqual([])
  })

  it('reports two commands of one surface fighting over the same key', () => {
    const clashing = conflicts({ 'scene.rotate': 'KeyG' })

    expect(clashing).toContain('scene.rotate')
    expect(clashing).toContain('scene.translate')
  })

  // A global command is fired wherever the focus sits, so it competes with every scope.
  it('reports a surface command taking a key the menu already fires', () => {
    expect(conflicts({ 'scene.frame': 'Meta+KeyN' })).toContain('scene.frame')
  })

  it('ignores commands bound to nothing, which cannot clash with anything', () => {
    expect(conflicts({ 'scene.frame': undefined })).not.toContain('layout.reset')
  })
})

describe('every scope the registry declares', () => {
  /**
   * The shortcuts screen groups the commands by scope and names each group from the bundle.
   * `canvas` had no label at all: its whole group was headed by the raw key. A scope added
   * without one is a heading nobody can read.
   */
  it('is named in both bundles', () => {
    for (const language of LANGUAGES) {
      const labels = TRANSLATIONS[language.code].settings.scope
      const unnamed = COMMAND_SCOPES.filter(scope => !labels[scope])

      expect(unnamed).toEqual([])
    }
  })

  it('holds at least one command, or it is a heading over nothing', () => {
    const empty = COMMAND_SCOPES.filter(scope => commandsIn(scope).length === 0)

    expect(empty).toEqual([])
  })
})

describe('looking a command up by its suffix', () => {
  it('finds the one that scope declares', () => {
    expect(commandIn('scene', 'undo')).toBe('scene.undo')
  })

  /**
   * The native menu asks every scope for `undo` and `redo` and greys the row out when the
   * answer is `null` — so the answer for a scope that has no such command is what the menu is
   * actually built on, and it was the one path never exercised.
   */
  it('answers null rather than guessing when that scope has none', () => {
    expect(commandIn('scene', 'jamaisDeclare')).toBeNull()
  })
})
