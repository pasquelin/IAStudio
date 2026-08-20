import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DocumentDescriptor } from '@shared/domain/document'
import type { NamedDocumentPlace, NewDocumentAsk } from '@shared/domain/newDocument'
import { installFakeBridge } from '@/services/fakeBridge'
import { useDocuments } from '@/stores/documents'
import { NewDocumentWindow } from './NewDocumentWindow'

const ASK: NewDocumentAsk = {
  kind: 'scene',
  folder: 'documents',
  suggested: 'Scène 1',
  projectName: 'One',
  open: [],
}

const stored = (fileName: string): DocumentDescriptor => ({
  id: fileName,
  kind: 'scene',
  workspace: '3d',
  title: fileName.replace(/\.gltf$/, ''),
  path: `documents/${fileName}`,
})

const answer = vi.fn<(place: NamedDocumentPlace | null) => Promise<void>>()

function open(ask: NewDocumentAsk | null, onDisk: DocumentDescriptor[] = []): void {
  installFakeBridge({
    newDocument: { request: () => Promise.resolve(ask), answer: place => answer(place) },
    documents: { list: () => Promise.resolve(onDisk) },
  })
}

describe('NewDocumentWindow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    answer.mockResolvedValue(undefined)
    useDocuments.setState({ documents: {}, stored: [] })
  })

  it('opens on the suggested name, selected, with its extension beside it', async () => {
    open(ASK)
    render(<NewDocumentWindow />)

    const field = await screen.findByRole('textbox')
    expect(field).toHaveValue('Scène 1')
    expect(field).toHaveFocus()
    expect(screen.getByText('.gltf')).toBeInTheDocument()
  })

  it('answers with the name and the folder', async () => {
    open(ASK)
    render(<NewDocumentWindow />)

    const field = await screen.findByRole('textbox')
    await userEvent.clear(field)
    await userEvent.type(field, 'Niveau{Enter}')

    expect(answer).toHaveBeenCalledWith({ title: 'Niveau', folder: 'documents' })
  })

  // Closing the window says the same thing, and the main process answers `null` for both.
  it('answers nothing when the creation is called off', async () => {
    open(ASK)
    render(<NewDocumentWindow />)

    await userEvent.click(await screen.findByRole('button', { name: 'Annuler' }))

    expect(answer).toHaveBeenCalledWith(null)
  })

  it('answers nothing on Escape', async () => {
    open(ASK)
    render(<NewDocumentWindow />)

    await userEvent.type(await screen.findByRole('textbox'), '{Escape}')

    expect(answer).toHaveBeenCalledWith(null)
  })

  // Refused where it is typed: a name the folder already holds would be quietly suffixed by the
  // first save, and a document called something its author did not write is the outcome to avoid.
  it('refuses a name the folder already holds', async () => {
    open(ASK, [stored('Niveau.gltf')])
    render(<NewDocumentWindow />)

    const field = await screen.findByRole('textbox')
    await userEvent.clear(field)
    await userEvent.type(field, 'Niveau')

    await screen.findByRole('alert')
    expect(screen.getByRole('button', { name: 'Créer' })).toBeDisabled()
  })

  // The tabs the studio holds, which no folder listing can answer for.
  it('refuses a name only an open tab holds', async () => {
    open({ ...ASK, open: [stored('Brouillon.gltf')] })
    render(<NewDocumentWindow />)

    const field = await screen.findByRole('textbox')
    await userEvent.clear(field)
    await userEvent.type(field, 'Brouillon')

    await screen.findByRole('alert')
    expect(screen.getByRole('button', { name: 'Créer' })).toBeDisabled()
  })

  it('shows nothing to fill in when nothing was asked', async () => {
    open(null)
    render(<NewDocumentWindow />)

    await screen.findByText('Nouveau document')
    expect(screen.queryByRole('textbox')).toBeNull()
  })
})
