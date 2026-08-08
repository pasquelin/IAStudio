import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Project } from '@shared/domain/project'
import { DEFAULT_COLLECTION_STATE } from '@/helpers/collection-state'
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
