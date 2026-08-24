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
import type { AssetRowModel } from './rows'
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

const localRow = (one: Asset): AssetRowModel => ({ id: one.id, from: 'local', asset: one })

describe('what a row of the shelf opens onto', () => {
  beforeEach(() => {
    useLayouts.setState({ activeWorkspace: 'image', home: false })
    useSelection.setState({ selection: { kind: 'none' } })
    useAssets.setState({ items: [asset()] })
    useJobs.setState({ jobs: [], bodies: {} })
    useDocuments.setState({ documents: {}, activeId: null })
  })

  /**
   * A library line has no file on this side and a running job has no asset yet: neither has any
   * of this to say, and the shelf draws the chevron on nothing rather than opening onto a blank.
   */
  it('draws nothing at all for a row the catalogue does not hold', () => {
    const { container } = render(
      <AssetDetails row={{ id: 'remote-1', from: 'remote', asset: { id: 'remote-1' } as never }} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('reads the asset out', () => {
    render(<AssetDetails row={localRow(asset())} />)

    expect(screen.getByText('pad.wav')).toBeInTheDocument()
    expect(screen.getByText('Audio')).toBeInTheDocument()
  })

  it('shows the prompt behind a generated asset, whole', () => {
    useJobs.setState({ jobs: [job], bodies: { 'job-1': { prompt: 'a very soft pad' } } })
    render(<AssetDetails row={localRow(asset({ jobId: 'job-1' }))} />)

    expect(screen.getByText('a very soft pad')).toBeInTheDocument()
    expect(screen.getByText('ElevenLabs Music v2')).toBeInTheDocument()
  })

  it('shows no generation block for an imported file', () => {
    render(<AssetDetails row={localRow(asset())} />)

    expect(screen.queryByText('Génération')).not.toBeInTheDocument()
  })

  it('arms the generator with the parameters behind the asset, and brings it up', async () => {
    useJobs.setState({ jobs: [job], bodies: { 'job-1': { prompt: 'x', guidance: 7 } } })
    useTools.setState({ arrangements: arrangedFor('image', { open: {} }) })
    render(<AssetDetails row={localRow(asset({ jobId: 'job-1' }))} />)

    await userEvent.click(screen.getByRole('button', { name: /Régénérer/ }))

    const models = useModels.getState()
    expect(models.selected[aiRoleId('image', 'txt2img')]).toBe('eleven-music-v2')
    expect(models.preset[aiRoleId('image', 'txt2img')]).toEqual({ prompt: 'x', guidance: 7 })
    expect(arrangementOf(useTools.getState(), 'image').open.left?.primary).toBe('generator')
  })
})
