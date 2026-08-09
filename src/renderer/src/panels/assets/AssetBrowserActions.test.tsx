import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Project } from '@shared/domain/project'
import { DEFAULT_COLLECTION_STATE } from '@/helpers/collection-state'
import { TOOLTIP_ID } from '@/helpers/tooltip'
import { useAssets } from '@/stores/assets'
import { useMedia } from '@/stores/media'
import { useProject } from '@/stores/project'
import { useCloud } from '@/stores/cloud'
import { useSelection } from '@/stores/selection'
import { AssetBrowserActions } from './AssetBrowserActions'

const PROJECT: Project = {
  path: '/tmp/project',
  manifest: { version: 1, name: 'Project', createdAt: '', updatedAt: '' },
}

// The count and the import button, on the tool window's own title bar.
describe('AssetBrowserActions', () => {
  beforeEach(() => {
    useAssets.setState({ items: [], collection: DEFAULT_COLLECTION_STATE })
    useProject.setState({ project: null })
    useMedia.setState({ progress: {}, capabilities: { ffmpeg: true } })
  })

  // 500 px of bar in a 320 px column header shrank the panel's title to nothing and pushed its
  // own close button out of the frame.
  it('keeps the title row to what fits it: a count and an import button', () => {
    render(<AssetBrowserActions />)

    expect(screen.queryByLabelText('Rechercher…')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Importer un média')).toBeInTheDocument()
  })

  it('imports a media file into the open project', async () => {
    const importMedia = vi.fn(async () => undefined)
    useProject.setState({ project: PROJECT })
    useMedia.setState({ importMedia })
    render(<AssetBrowserActions />)

    await userEvent.click(screen.getByRole('button', { name: /Importer un média/ }))

    expect(importMedia).toHaveBeenCalledOnce()
  })

  it('offers no import while no project is open, since there is no catalogue to link into', () => {
    render(<AssetBrowserActions />)
    expect(screen.getByRole('button', { name: /Importer un média/ })).toBeDisabled()
  })

  // The studio ships its own encoder, so this is the developer's copy missing, never the user's
  // install: it states what will not happen, and asks for nothing.
  it('says what is unavailable when the encoder is missing', () => {
    useMedia.setState({ capabilities: { ffmpeg: false } })
    render(<AssetBrowserActions />)

    const notice = screen.getByRole('img', { name: /Préparation vidéo indisponible/ })
    // `muted` is the tone of the settled states — an amber glyph in a row of grey ones is the
    // only thing left saying this one is worth reading.
    expect(notice.className).toContain('text-warning')
  })

  /**
   * The sentence left the band for a tooltip, so these attributes ARE the change: a test that
   * only reads the accessible name stays green through the very regression it guards. And the
   * row is a panel's top edge — a tooltip opening upward leaves the panel, as the close button
   * beside it already knew.
   */
  it('carries its sentence to the eye through the shared tooltip, opening below the row', () => {
    useMedia.setState({ capabilities: { ffmpeg: false } })
    render(<AssetBrowserActions />)

    const notice = screen.getByRole('img', { name: /Préparation vidéo indisponible/ })
    expect(notice).toHaveAttribute('data-tooltip-id', TOOLTIP_ID)
    expect(notice).toHaveAttribute('data-tooltip-place', 'bottom')
    expect(notice).toHaveAttribute(
      'data-tooltip-content',
      expect.stringContaining('Préparation vidéo'),
    )
  })

  // A tooltip that only opens under a pointer leaves the sighted keyboard user with no way to
  // learn why the waveforms stopped coming — the sentence used to be on screen unconditionally.
  it('lets a keyboard reach the sentence, since nothing else shows it', async () => {
    useMedia.setState({ capabilities: { ffmpeg: false } })
    render(<AssetBrowserActions />)

    await userEvent.tab()

    expect(screen.getByRole('img', { name: /Préparation vidéo indisponible/ })).toHaveFocus()
  })

  it('says nothing of the encoder while ffmpeg answers', () => {
    render(<AssetBrowserActions />)
    expect(screen.queryByRole('img', { name: /Préparation vidéo/ })).not.toBeInTheDocument()
  })
})

describe('sending the selection to the library', () => {
  beforeEach(() => {
    useAssets.setState({ items: [], collection: DEFAULT_COLLECTION_STATE })
    useProject.setState({ project: PROJECT })
    useMedia.setState({ progress: {}, capabilities: { ffmpeg: true } })
    useCloud.getState().clear()
    useSelection.getState().clear()
  })

  it('cannot send when nothing is selected', () => {
    render(<AssetBrowserActions />)
    expect(screen.getByRole('button', { name: /Envoyer/ })).toBeDisabled()
  })

  it('sends exactly what is selected', async () => {
    const push = vi.fn(() => Promise.resolve())
    useCloud.setState({ push })
    useSelection.getState().selectAssets(['a', 'b'])

    render(<AssetBrowserActions />)
    await userEvent.click(screen.getByRole('button', { name: /Envoyer/ }))

    expect(push).toHaveBeenCalledWith(['a', 'b'])
  })

  it('cannot send while a run is under way', () => {
    useSelection.getState().selectAssets(['a'])
    useCloud.setState({ busy: true })

    render(<AssetBrowserActions />)
    expect(screen.getByRole('button', { name: /Envoyer/ })).toBeDisabled()
  })

  it('cannot send what is not an asset', () => {
    // A clip or a track is a selection too, and neither has a file to upload.
    useSelection.getState().selectClip('clip_1', 'doc_1')

    render(<AssetBrowserActions />)
    expect(screen.getByRole('button', { name: /Envoyer/ })).toBeDisabled()
  })
})
