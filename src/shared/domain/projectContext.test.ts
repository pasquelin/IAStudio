import { describe, expect, it } from 'vitest'
import type { FieldDescriptor } from './model'
import {
  bodyWithContext,
  composedContext,
  contextPictures,
  droppedCards,
  withAuthoredPrompt,
  CONTEXT_BODY_MAX,
  CONTEXT_COMPOSED_MAX,
  CONTEXT_TITLE_MAX,
  sentLength,
  type ContextCard,
} from './projectContext'

const card = (fields: Partial<ContextCard>): ContextCard => ({
  id: 'one',
  title: 'World',
  body: 'A forest',
  active: true,
  pictures: [],
  ...fields,
})

const PROMPT: FieldDescriptor = {
  key: 'prompt',
  kind: 'longText',
  label: 'Prompt',
  required: true,
  promptSpark: true,
}

const PICTURE: FieldDescriptor = { key: 'image', kind: 'image', label: 'Image', required: false }

describe('composing what a project is about', () => {
  it('joins the cards that are on, and leaves the others aside', () => {
    const composed = composedContext([
      card({ id: 'a', title: 'World', body: 'A medieval forest' }),
      card({ id: 'b', title: 'Look', body: 'Oil paint', active: false }),
      card({ id: 'c', title: 'Avoid', body: 'Concrete' }),
    ])

    expect(composed).toContain('World: A medieval forest')
    expect(composed).toContain('Avoid: Concrete')
    expect(composed).not.toContain('Oil paint')
  })

  /**
   * 🛑 The field accepts a body of `CONTEXT_BODY_MAX`, so one written to the brim must travel. It
   * did not: the newline was charged to the first block too, and the card missed by one character
   * while the panel said « 0 / 600 » about text plainly on screen.
   */
  it('sends a card written to the brim, title and all', () => {
    const brim = card({ title: 'x'.repeat(CONTEXT_TITLE_MAX), body: 'y'.repeat(CONTEXT_BODY_MAX) })

    expect(composedContext([brim])).toContain('y'.repeat(CONTEXT_BODY_MAX))
    expect(sentLength([brim])).toBeLessThanOrEqual(CONTEXT_COMPOSED_MAX)
    expect(droppedCards([brim])).toBe(0)
  })

  /** The counter reads this, and it must not include the fixed line the cards are put under. */
  it('measures the cards, not the heading above them', () => {
    expect(sentLength([card({ title: 'World', body: 'A forest' })])).toBe('World: A forest'.length)
  })

  it('says nothing at all when every card is off', () => {
    expect(composedContext([card({ active: false })])).toBe('')
  })

  it('drops a whole card rather than half of one when the bound is reached', () => {
    const long = 'x'.repeat(CONTEXT_COMPOSED_MAX)
    const composed = composedContext([
      card({ id: 'a', title: 'Long', body: long }),
      card({ id: 'b', title: 'Short', body: 'Rain' }),
    ])

    expect(composed).not.toContain('Rain')
    expect(composed).not.toContain('x')
  })

  /**
   * The bound is silent otherwise: a card left on that reaches no model is the defect the panel
   * exists to prevent, and the character counter alone cannot say it.
   */
  it('counts the cards left on that do not travel', () => {
    // Fits with a handful of characters to spare, so the short card behind it is what is dropped.
    const nearly = 'x'.repeat(CONTEXT_COMPOSED_MAX - 10)

    expect(
      droppedCards([
        card({ id: 'a', title: 'Long', body: nearly }),
        card({ id: 'b', title: 'Short', body: 'Rain' }),
        card({ id: 'c', title: 'Off', body: 'Snow', active: false }),
      ]),
    ).toBe(1)

    expect(droppedCards([card({})])).toBe(0)
  })

  it('lists the pictures the cards on pin, once each', () => {
    expect(
      contextPictures([
        card({ id: 'a', pictures: ['one', 'two'] }),
        card({ id: 'b', pictures: ['two', 'three'] }),
        card({ id: 'c', pictures: ['four'], active: false }),
      ]),
    ).toEqual(['one', 'two', 'three'])
  })
})

describe('adding it to what is about to be generated', () => {
  it('puts what was written first and the context under it', () => {
    const { body, authored } = bodyWithContext({ prompt: 'a house' }, [PROMPT], 'World: A forest')

    expect(body.prompt).toBe('a house\n\nWorld: A forest')
    expect(authored).toEqual({ written: 'a house', sent: 'a house\n\nWorld: A forest' })
  })

  it('leaves a model with no prompt field of its own untouched', () => {
    const { body, authored } = bodyWithContext({ image: 'asset-1' }, [PICTURE], 'World: A forest')

    expect(body).toEqual({ image: 'asset-1' })
    expect(authored).toBeNull()
  })

  it('adds nothing to a prompt nobody wrote', () => {
    const { body, authored } = bodyWithContext({ prompt: '  ' }, [PROMPT], 'World: A forest')

    expect(body).toEqual({ prompt: '  ' })
    expect(authored).toBeNull()
  })
})

describe('what the catalogue keeps', () => {
  it('gives a recipe back the prompt as it was written, wherever the API echoed it', () => {
    const sent = 'a house\n\nWorld: A forest'

    expect(
      withAuthoredPrompt(
        { modelId: 'm', modelLabel: 'M', prompt: sent, params: { prompt: sent, seed: 3 } },
        { written: 'a house', sent },
      ),
    ).toEqual({
      modelId: 'm',
      modelLabel: 'M',
      prompt: 'a house',
      params: { prompt: 'a house', seed: 3 },
    })
  })
})
