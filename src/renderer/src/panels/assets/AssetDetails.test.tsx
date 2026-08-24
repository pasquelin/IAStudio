import { aiRoleId } from '@shared/domain/aiRole'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Asset } from '@shared/domain/asset'
import type { Job } from '@shared/domain/job'
import { job as jobOf } from '@/stores/job-fixtures'
import { useAssets } from '@/stores/assets'
import { useDocuments } from '@/stores/documents'
import { useJobs } from '@/stores/jobs'
import { useModels } from '@/stores/models'
import { useLayouts } from '@/stores/layouts'
import { useSelection } from '@/stores/selection'
import { arrangedFor } from '@/stores/tool-fixtures'
import { arrangementOf, useTools } from '@/stores/tools'
import { AssetDetails } from './AssetDetails'

const asset = (overrides: Partial<Asset> = {}): Asset => ({
  id: 'asset-1',
  name: 'pad.wav',
  type: 'audio',
  location: 'local',
  tags: [],
  createdAt: '2026-08-07T10:00:00.000Z',
  ...overrides,
})

const job: Job = jobOf({
  id: 'job-1',
  targetId: 'eleven-music-v2',
  label: 'ElevenLabs Music v2',
  status: 'succeeded',
  assetIds: ['asset-1'],
})

describe('what the shelf has picked, read out under the shelf', () => {
  beforeEach(() => {
    useLayouts.setState({ activeWorkspace: 'image', home: false })
    useSelection.setState({ selection: { kind: 'none' } })
    useAssets.setState({ items: [asset()] })
    useJobs.setState({ jobs: [], bodies: {} })
    useDocuments.setState({ documents: {}, activeId: null })
  })

  /**
   * Nothing rather than an empty state, and it is the whole reason this lives under the list
   * instead of in the inspector: a placeholder here would take height from the shelf on every
   * project where nothing is picked.
   */
  it('draws nothing at all while nothing is picked', () => {
    const { container } = render(<AssetDetails />)
    expect(container).toBeEmptyDOMElement()
  })

  it('reads out the asset that was selected', () => {
    useSelection.getState().selectAssets(['asset-1'])
    render(<AssetDetails />)

    expect(screen.getByText('pad.wav')).toBeInTheDocument()
    expect(screen.getByText('Audio')).toBeInTheDocument()
  })

  it('summarises a multiple selection rather than detailing the first of it', () => {
    useAssets.setState({ items: [asset(), asset({ id: 'asset-2', name: 'pad.wav' })] })
    useSelection.getState().selectAssets(['asset-1', 'asset-2'])
    render(<AssetDetails />)

    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.queryByText('pad.wav')).not.toBeInTheDocument()
  })

  it('shows the prompt behind a generated asset, whole', () => {
    useAssets.setState({ items: [asset({ jobId: 'job-1' })] })
    useJobs.setState({ jobs: [job], bodies: { 'job-1': { prompt: 'a very soft pad' } } })
    useSelection.getState().selectAssets(['asset-1'])
    render(<AssetDetails />)

    expect(screen.getByText('a very soft pad')).toBeInTheDocument()
    expect(screen.getByText('ElevenLabs Music v2')).toBeInTheDocument()
  })

  it('shows no generation block for an imported file', () => {
    useSelection.getState().selectAssets(['asset-1'])
    render(<AssetDetails />)

    expect(screen.queryByText('Génération')).not.toBeInTheDocument()
  })

  it('arms the generator with the parameters behind the asset, and brings it up', async () => {
    useAssets.setState({ items: [asset({ jobId: 'job-1' })] })
    useJobs.setState({ jobs: [job], bodies: { 'job-1': { prompt: 'x', guidance: 7 } } })
    useSelection.getState().selectAssets(['asset-1'])
    useTools.setState({ arrangements: arrangedFor('image', { open: {} }) })
    render(<AssetDetails />)

    await userEvent.click(screen.getByRole('button', { name: /Régénérer/ }))

    const models = useModels.getState()
    expect(models.selected[aiRoleId('image', 'txt2img')]).toBe('eleven-music-v2')
    expect(models.preset[aiRoleId('image', 'txt2img')]).toEqual({ prompt: 'x', guidance: 7 })
    expect(arrangementOf(useTools.getState(), 'image').open.left?.primary).toBe('generator')
  })
})
