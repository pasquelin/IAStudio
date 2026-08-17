import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setWindowLanguage } from '@main/window/language'
import { askCloseChoice, askDeleteDocument, type AskUser } from './documentDialogs'

type Shown = Parameters<AskUser>[0]

const asking = (answer: number) => {
  const shown: Shown[] = []
  const ask: AskUser = options => {
    shown.push(options)
    return Promise.resolve(answer)
  }
  return { ask, shown }
}

beforeEach(() => {
  vi.clearAllMocks()
  setWindowLanguage('en')
})

describe('asking about unsaved work', () => {
  it('reads each button as the choice it stands for', async () => {
    await expect(askCloseChoice(asking(0).ask, 'Level')).resolves.toBe('save')
    await expect(askCloseChoice(asking(1).ask, 'Level')).resolves.toBe('discard')
    await expect(askCloseChoice(asking(2).ask, 'Level')).resolves.toBe('cancel')
  })

  // Escape must never be read as consent to throw work away.
  it('makes cancel the answer a dismissed dialog gives back', async () => {
    const { ask, shown } = asking(2)
    await askCloseChoice(ask, 'Level')

    expect(shown[0]?.cancelId).toBe(2)
    expect(shown[0]?.buttons[shown[0].cancelId]).toBe('Cancel')
  })

  // Return is struck at a dialog nobody read; it must land on the answer that loses nothing.
  it('defaults to saving', async () => {
    const { ask, shown } = asking(0)
    await askCloseChoice(ask, 'Level')

    expect(shown[0]?.defaultId).toBe(0)
    expect(shown[0]?.buttons[0]).toBe('Save')
  })

  it('names the document being closed', async () => {
    const { ask, shown } = asking(2)
    await askCloseChoice(ask, 'Set dressing')

    expect(shown[0]?.message).toContain('Set dressing')
    expect(shown[0]?.message).not.toContain('{{title}}')
  })

  it('speaks the language the windows speak', async () => {
    setWindowLanguage('fr')
    const { ask, shown } = asking(2)
    await askCloseChoice(ask, 'Niveau')

    expect(shown[0]?.buttons).toEqual(['Enregistrer', 'Ne pas enregistrer', 'Annuler'])
  })
})

describe('asking before deleting a document', () => {
  it('deletes only on the delete button', async () => {
    await expect(askDeleteDocument(asking(1).ask, 'Level')).resolves.toBe(true)
    await expect(askDeleteDocument(asking(0).ask, 'Level')).resolves.toBe(false)
  })

  // Irreversible: neither Return nor Escape may reach the destructive answer.
  it('puts cancel on both the default and the dismissal', async () => {
    const { ask, shown } = asking(0)
    await askDeleteDocument(ask, 'Level')

    expect(shown[0]?.defaultId).toBe(0)
    expect(shown[0]?.cancelId).toBe(0)
    expect(shown[0]?.buttons[0]).toBe('Cancel')
  })

  it('names the document being deleted', async () => {
    const { ask, shown } = asking(0)
    await askDeleteDocument(ask, 'Set dressing')

    expect(shown[0]?.message).toContain('Set dressing')
  })
})
