import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Asset } from '@shared/domain/asset'
import type { Job } from '@shared/domain/job'
import { addClip } from '@/engines/timeline/commands'
import { clipFixture, sequenceWith, trackFixture } from '@/engines/timeline/timeline-fixtures'
import { useAssets } from '@/stores/assets'
import { useDocuments } from '@/stores/documents'
import { useJobs } from '@/stores/jobs'
import { useModels } from '@/stores/models'
import { sequenceOf, useSequences } from '@/stores/sequences'
import { useSelection } from '@/stores/selection'
import { useTools } from '@/stores/tools'
import { Inspector } from './Inspector'

const asset = (overrides: Partial<Asset> = {}): Asset => ({
  id: 'asset-1',
  name: 'nappe.wav',
  type: 'audio',
  location: 'local',
  tags: [],
  createdAt: '2026-08-07T10:00:00.000Z',
  ...overrides,
})

const job: Job = {
  id: 'job-1',
  modelId: 'eleven-music-v2',
  label: 'ElevenLabs Music v2',
  status: 'succeeded',
  progress: 1,
  createdAt: '2026-08-07T10:00:00.000Z',
  assetIds: ['asset-1'],
}

function openSequence(): void {
  useDocuments.setState({
    documents: {
      'doc-1': { id: 'doc-1', kind: 'sequence', title: 'Montage', workspace: 'video' },
    },
    activeId: 'doc-1',
  })
  useSequences.setState({
    states: {
      'doc-1': sequenceWith([trackFixture('V1', 'video'), trackFixture('A1', 'audio')]),
    },
    histories: {},
  })
}

describe('Inspector', () => {
  beforeEach(() => {
    useSelection.setState({ selection: { kind: 'none' } })
    useAssets.setState({ items: [asset()] })
    useJobs.setState({ jobs: [], bodies: {} })
    useDocuments.setState({ documents: {}, activeId: null })
    useSequences.setState({ states: {}, histories: {} })
  })

  it('asks for a selection when there is none', () => {
    render(<Inspector />)
    expect(screen.getByText(/Sélectionnez un élément/)).toBeInTheDocument()
  })

  it('reads out the asset that was selected', () => {
    useSelection.getState().selectAssets(['asset-1'])
    render(<Inspector />)

    expect(screen.getByText('nappe.wav')).toBeInTheDocument()
    expect(screen.getByText('Audio')).toBeInTheDocument()
  })

  it('summarises a multiple selection rather than detailing the first of it', () => {
    useAssets.setState({ items: [asset(), asset({ id: 'asset-2', name: 'pad.wav' })] })
    useSelection.getState().selectAssets(['asset-1', 'asset-2'])
    render(<Inspector />)

    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.queryByText('nappe.wav')).not.toBeInTheDocument()
  })

  it('shows the prompt behind a generated asset, whole', () => {
    useAssets.setState({ items: [asset({ jobId: 'job-1' })] })
    useJobs.setState({ jobs: [job], bodies: { 'job-1': { prompt: 'une nappe très douce' } } })
    useSelection.getState().selectAssets(['asset-1'])
    render(<Inspector />)

    expect(screen.getByText('une nappe très douce')).toBeInTheDocument()
    expect(screen.getByText('ElevenLabs Music v2')).toBeInTheDocument()
  })

  it('shows no generation block for an imported file', () => {
    useSelection.getState().selectAssets(['asset-1'])
    render(<Inspector />)

    expect(screen.queryByText('Génération')).not.toBeInTheDocument()
  })

  it('arms the generator with the parameters behind the asset, and brings it up', async () => {
    useAssets.setState({ items: [asset({ jobId: 'job-1' })] })
    useJobs.setState({ jobs: [job], bodies: { 'job-1': { prompt: 'x', guidance: 7 } } })
    useSelection.getState().selectAssets(['asset-1'])
    useTools.setState({ open: {} })
    render(<Inspector />)

    await userEvent.click(screen.getByRole('button', { name: /Régénérer/ }))

    const models = useModels.getState()
    expect(models.selected.image).toBe('eleven-music-v2')
    expect(models.preset.image).toEqual({ prompt: 'x', guidance: 7 })
    expect(useTools.getState().open.right?.primary).toBe('generator')
  })

  it('reads out the clip the montage has selected', () => {
    openSequence()
    useSequences
      .getState()
      .runCommand(
        'doc-1',
        addClip('A1', clipFixture('clip-1', 0, 2_000_000, { assetId: 'asset-1' })),
      )
    useSelection.getState().selectClip()
    render(<Inspector />)

    expect(screen.getByText('nappe.wav')).toBeInTheDocument()
    expect(screen.getByLabelText('Fondu d’entrée')).toBeInTheDocument()
  })

  it('offers a gain on a sound clip and none on a picture clip', () => {
    openSequence()
    useSequences
      .getState()
      .runCommand(
        'doc-1',
        addClip('V1', clipFixture('clip-1', 0, 2_000_000, { assetId: 'asset-1' })),
      )
    useSelection.getState().selectClip()
    render(<Inspector />)

    expect(screen.queryByLabelText('Gain')).not.toBeInTheDocument()
  })

  it('writes a fade back as an undoable command', async () => {
    openSequence()
    useSequences
      .getState()
      .runCommand(
        'doc-1',
        addClip('A1', clipFixture('clip-1', 0, 2_000_000, { assetId: 'asset-1' })),
      )
    useSelection.getState().selectClip()
    render(<Inspector />)

    const field = screen.getByLabelText('Fondu d’entrée')
    await userEvent.clear(field)
    await userEvent.type(field, '0.5{Enter}')

    expect(sequenceOf(useSequences.getState(), 'doc-1').tracks[1]?.clips[0]?.fadeIn).toBe(500_000)
  })

  it('reads out the track that was selected', () => {
    openSequence()
    useSelection.getState().selectTrack('A1')
    render(<Inspector />)

    expect(screen.getByText('A1')).toBeInTheDocument()
    // The same control as the header column, so the same accessible name.
    expect(screen.getByRole('button', { name: /Rendre muette la piste A1/ })).toBeInTheDocument()
  })

  it('falls back to the empty state when the selected track is gone', () => {
    openSequence()
    useSelection.getState().selectTrack('nope')
    render(<Inspector />)

    expect(screen.getByText(/Sélectionnez un élément/)).toBeInTheDocument()
  })
})
