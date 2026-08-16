import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setWindowLanguage } from '@main/window/language'
import type { AskUser } from './document-dialogs'
import { askUseOccupiedFolder } from './project-dialogs'

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

// The button arrangement — cancel first, and on both the default and the dismissal — belongs to
// `askConfirm` and is checked with it. What is this question's own is the wording.
describe('asking before laying a project into an occupied folder', () => {
  it('goes ahead only on the confirming button', async () => {
    await expect(askUseOccupiedFolder(asking(1).ask, 'Reel')).resolves.toBe(true)
    await expect(askUseOccupiedFolder(asking(0).ask, 'Reel')).resolves.toBe(false)
  })

  it('names the folder it is about to write in', async () => {
    const { ask, shown } = asking(0)
    await askUseOccupiedFolder(ask, 'Bande-annonce')

    expect(shown[0]?.message).toContain('Bande-annonce')
    expect(shown[0]?.message).not.toContain('{{folder}}')
  })

  // Nothing already in the folder is touched, and the dialog has to say so — the question is
  // otherwise read as "may I replace what is here".
  it('says what will happen to what is already there', async () => {
    const { ask, shown } = asking(0)
    await askUseOccupiedFolder(ask, 'Reel')

    expect(shown[0]?.detail).toContain('nothing already there is changed or moved')
  })

  it('speaks the language the windows speak', async () => {
    setWindowLanguage('fr')
    const { ask, shown } = asking(0)
    await askUseOccupiedFolder(ask, 'Reel')

    expect(shown[0]?.buttons).toEqual(['Annuler', 'Installer ici'])
  })
})
