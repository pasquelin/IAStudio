import { describe, expect, it, vi } from 'vitest'
import type { FieldDescriptor } from '@shared/domain/model'
import type { ContextCard } from '@shared/domain/projectContext'
import { createPromptContext } from './promptContext'

const PROMPT: FieldDescriptor = {
  key: 'prompt',
  kind: 'longText',
  label: 'Prompt',
  required: true,
  promptSpark: true,
}

const CARD: ContextCard = {
  id: 'one',
  title: 'World',
  body: 'A medieval forest',
  active: true,
  pictures: [],
}

const TARGET = { id: 'model_1' }

function contextOf(overrides: Partial<Parameters<typeof createPromptContext>[0]> = {}) {
  return createPromptContext({
    cards: () => Promise.resolve([CARD]),
    fieldsOf: () => Promise.resolve([PROMPT]),
    log: vi.fn(),
    ...overrides,
  })
}

describe('what a generation carries from its project', () => {
  it('joins the context to the prompt the model declares', async () => {
    const { body, authored } = await contextOf()({ prompt: 'a house' }, TARGET, 'apply')

    expect(body.prompt).toContain('a house')
    expect(body.prompt).toContain('World: A medieval forest')
    expect(authored?.written).toBe('a house')
  })

  it('leaves the shot alone when it asked to be left alone', async () => {
    const { body, authored } = await contextOf()({ prompt: 'a house' }, TARGET, 'skip')

    expect(body).toEqual({ prompt: 'a house' })
    expect(authored).toBeNull()
  })

  /**
   * A generation somebody is paying for must not die on a preference. Every way this can fail —
   * an unreadable file, a model withdrawn from the catalogue, a project closed in between — comes
   * back as the body untouched and one line in the journal.
   */
  it('sends the form as it stands rather than failing, when the context cannot be read', async () => {
    const log = vi.fn()
    const context = contextOf({ cards: () => Promise.reject(new Error('unreadable')), log })

    const { body, authored } = await context({ prompt: 'a house' }, TARGET, 'apply')

    expect(body).toEqual({ prompt: 'a house' })
    expect(authored).toBeNull()
    expect(log).toHaveBeenCalled()
  })
})
