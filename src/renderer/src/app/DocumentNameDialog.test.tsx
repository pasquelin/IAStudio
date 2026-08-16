import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { DocumentNameDialog } from './DocumentNameDialog'
import { mountedDocumentNamer, type DocumentNameRequest } from './document-name'

const HELD = [{ id: 'held', fileName: 'Niveau.scene' }]

/**
 * Asking the way `createDocumentIn` asks — through the module registry rather than through a
 * prop, because that is the whole point of the arrangement: the rail has no reference to this
 * component.
 */
function askFor(over?: Partial<DocumentNameRequest>): Promise<string | null> {
  const namer = mountedDocumentNamer()
  if (!namer) throw new Error('the dialog registered no namer')

  const request: DocumentNameRequest = {
    kind: 'scene',
    suggested: 'Sans titre 2',
    taken: HELD,
    ...over,
  }

  let answered: Promise<string | null> = Promise.resolve(null)
  act(() => {
    answered = namer(request)
  })
  return answered
}

const field = (): HTMLElement => screen.getByRole('textbox', { name: 'Nom du document' })

describe('DocumentNameDialog', () => {
  it('shows nothing until a document is being made', () => {
    render(<DocumentNameDialog />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  // Selected, and that is what keeps the gesture as short as it was: Enter takes the name as it
  // stands, and typing replaces it whole.
  it('opens on the proposed name, selected', () => {
    render(<DocumentNameDialog />)
    void askFor()

    const input = field()
    expect(input).toHaveValue('Sans titre 2')
    if (!(input instanceof HTMLInputElement)) throw new Error('the field is not an input')
    expect([input.selectionStart, input.selectionEnd]).toEqual([0, 'Sans titre 2'.length])
  })

  it('answers with the proposed name when it is taken as it stands', async () => {
    render(<DocumentNameDialog />)
    const answered = askFor()

    await userEvent.keyboard('{Enter}')

    await expect(answered).resolves.toBe('Sans titre 2')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('answers with the name that was typed, trimmed', async () => {
    render(<DocumentNameDialog />)
    const answered = askFor()

    await userEvent.clear(field())
    await userEvent.type(field(), '  Niveau 2  {Enter}')

    await expect(answered).resolves.toBe('Niveau 2')
  })

  /**
   * Refused where it is typed rather than at the disk: the first save would suffix it silently,
   * and a document called something its author did not write is what this dialog exists against.
   */
  it('refuses a name the project already holds, and says why', async () => {
    render(<DocumentNameDialog />)
    void askFor()

    await userEvent.clear(field())
    await userEvent.type(field(), 'Niveau')

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Le projet contient déjà un document de ce nom.',
    )
    expect(screen.getByRole('button', { name: 'Créer' })).toBeDisabled()
  })

  it('refuses a name no file can carry', async () => {
    render(<DocumentNameDialog />)
    void askFor()

    await userEvent.clear(field())
    await userEvent.type(field(), 'a/b')

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Ce nom contient un caractère qu’un nom de fichier ne peut pas porter.',
    )
  })

  // The same file name in another space is another document — `Niveau.scene` and `Niveau.img`
  // coexist on disk, and the space glyph already tells them apart on screen.
  it('takes a name held by a document of another kind', async () => {
    render(<DocumentNameDialog />)
    const answered = askFor({ kind: 'image' })

    await userEvent.clear(field())
    await userEvent.type(field(), 'Niveau{Enter}')

    await expect(answered).resolves.toBe('Niveau')
  })

  it('makes nothing when the dialog is dismissed', async () => {
    render(<DocumentNameDialog />)
    const answered = askFor()

    await userEvent.keyboard('{Escape}')

    await expect(answered).resolves.toBeNull()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('makes nothing when the creation is called off', async () => {
    render(<DocumentNameDialog />)
    const answered = askFor()

    await userEvent.click(screen.getByRole('button', { name: 'Annuler' }))

    await expect(answered).resolves.toBeNull()
  })

  /**
   * A second question is refused rather than shown: the first is on screen with a caret in it,
   * and answering it for the newcomer would make a document nobody named.
   */
  it('refuses a second request while one is on screen', async () => {
    render(<DocumentNameDialog />)
    const first = askFor()
    const second = askFor({ suggested: 'Sans titre 3' })

    await expect(second).resolves.toBeNull()
    expect(field()).toHaveValue('Sans titre 2')

    await userEvent.keyboard('{Enter}')
    await expect(first).resolves.toBe('Sans titre 2')
  })

  // The surfaces behind bind bare letters: typing a name must not arm a tool or split a clip.
  it('keeps what is typed off the window behind it', async () => {
    const typed: string[] = []
    render(
      <div onKeyDown={event => typed.push(event.key)}>
        <DocumentNameDialog />
      </div>,
    )
    void askFor()

    await userEvent.type(field(), 'v')

    expect(typed).toEqual([])
  })
})
