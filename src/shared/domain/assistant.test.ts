import { describe, expect, it } from 'vitest'
import { isRecord } from '../guards'
import { LANGUAGES, TRANSLATIONS } from '../i18n'
import {
  ACTION_COMMITMENTS,
  ACTION_REFUSALS,
  ACTION_REGISTRY,
  assistantAction,
  commitmentOfCommand,
  needsConfirmation,
  refusalKey,
} from './assistant'
import { COMMAND_REGISTRY, type CommandId } from './command'

function resolve(bundle: unknown, key: string): unknown {
  return key
    .split('.')
    .reduce<unknown>((current, part) => (isRecord(current) ? current[part] : undefined), bundle)
}

const KEYS_OF = (): readonly string[] =>
  ACTION_REGISTRY.flatMap(action => [
    action.titleKey,
    action.descriptionKey,
    ...action.fields.map(field => field.labelKey),
  ])

describe('the action registry', () => {
  it('names each action once', () => {
    const names = ACTION_REGISTRY.map(action => action.name)

    expect(new Set(names).size).toBe(names.length)
  })

  it.each(LANGUAGES.map(language => language.code))('says what every action does in %s', code => {
    for (const key of KEYS_OF()) {
      const text = resolve(TRANSLATIONS[code], key)
      expect(typeof text === 'string' && text.trim() !== '', `${key} is missing`).toBe(true)
    }
  })

  /**
   * Same bar as the commands, and for a sharper reason: this sentence is the whole of what the
   * model is told about an action before it picks one. A title repeated back explains nothing,
   * and the wrong action gets chosen on the strength of it.
   */
  it('explains, and does not merely repeat the title', () => {
    for (const action of ACTION_REGISTRY) {
      const description = resolve(TRANSLATIONS.fr, action.descriptionKey)
      expect(
        String(description).length,
        `${action.descriptionKey} explains nothing`,
      ).toBeGreaterThan(40)
    }
  })

  it('files every action under a commitment that exists', () => {
    for (const action of ACTION_REGISTRY) {
      expect(ACTION_COMMITMENTS, action.name).toContain(action.commitment)
    }
  })

  it('finds an action by name, and answers null for one nothing declares', () => {
    expect(assistantAction('workspace.open')?.name).toBe('workspace.open')
    expect(assistantAction('workspace.explode')).toBeNull()
  })

  it('offers only values a field accepts, when it closes the set', () => {
    for (const action of ACTION_REGISTRY) {
      for (const field of action.fields) {
        if (field.options) expect(field.options.length, `${field.key}`).toBeGreaterThan(0)
      }
    }
  })

  it('lets a command be named only if the registry declares it', () => {
    const ids: readonly string[] = COMMAND_REGISTRY.map(descriptor => descriptor.id)
    const offered = assistantAction('command.run')?.fields[0]?.options ?? []

    expect(offered).toHaveLength(ids.length)
    for (const id of offered) expect(ids, id).toContain(id)
  })
})

describe('what an action engages', () => {
  it('asks before anything that outlives the window, and not otherwise', () => {
    expect(needsConfirmation('none')).toBe(false)
    expect(needsConfirmation('asset')).toBe(true)
    expect(needsConfirmation('credits')).toBe(true)
  })

  /**
   * Command by command rather than by sampling, because this is the one level derived instead of
   * declared. The five that upload are the five the canvas prepares an edit from; every other
   * command in the registry moves the view, arms a tool, or edits a document that can undo it.
   */
  it.each(COMMAND_REGISTRY.map(descriptor => descriptor.id))('rates %s', id => {
    const uploads: readonly CommandId[] = [
      'canvas.regenerate',
      'canvas.cutout',
      'canvas.enlarge',
      'canvas.vectorize',
      'canvas.extend',
    ]

    expect(commitmentOfCommand(id)).toBe(uploads.includes(id) ? 'asset' : 'none')
  })

  it.each(LANGUAGES.map(language => language.code))('says why it refused, in %s', code => {
    for (const refusal of ACTION_REFUSALS) {
      const text = resolve(TRANSLATIONS[code], refusalKey(refusal))
      expect(typeof text === 'string' && text.trim() !== '', refusal).toBe(true)
    }
  })

  it('never spends credits through a command', () => {
    // Submitting is its own action, and the only one that reaches for the user's balance. A
    // command that started billing would slip past the estimate the assistant is meant to quote.
    for (const descriptor of COMMAND_REGISTRY) {
      expect(commitmentOfCommand(descriptor.id), descriptor.id).not.toBe('credits')
    }
  })
})
