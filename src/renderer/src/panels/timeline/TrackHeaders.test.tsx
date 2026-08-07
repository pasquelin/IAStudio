import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { canUndo } from '@/engines/core/history'
import { sequenceWith, trackFixture } from '@/engines/timeline/timeline-fixtures'
import type { Track } from '@/engines/timeline/timeline-state'
import { historyOf, sequenceOf, useSequences } from '@/stores/sequences'
import { useTimelineView } from '@/stores/timeline-view'
import { TrackHeaders } from './TrackHeaders'

const trackOf = (id: string): Track | undefined =>
  sequenceOf(useSequences.getState(), 'doc-1').tracks.find(track => track.id === id)

describe('TrackHeaders', () => {
  beforeEach(() => {
    useTimelineView.setState({ viewports: {} })
    useSequences.setState({
      states: {
        'doc-1': sequenceWith([trackFixture('V1', 'video'), trackFixture('A1', 'audio')]),
      },
      histories: {},
    })
  })

  it('names one row per track', () => {
    render(<TrackHeaders documentId="doc-1" />)

    expect(screen.getByText('V1')).toBeInTheDocument()
    expect(screen.getByText('A1')).toBeInTheDocument()
  })

  it('gives each row the height its track carries', () => {
    useSequences.setState({
      states: { 'doc-1': sequenceWith([trackFixture('V1', 'video', [], { height: 90 })]) },
    })
    render(<TrackHeaders documentId="doc-1" />)

    expect(screen.getByTestId('track-header-V1')).toHaveStyle({ height: '90px' })
  })

  it('mutes a track from its own row', async () => {
    render(<TrackHeaders documentId="doc-1" />)
    await userEvent.click(screen.getByRole('button', { name: /Rendre muette la piste V1/ }))

    expect(trackOf('V1')?.muted).toBe(true)
  })

  it('solos and locks a track from its own row', async () => {
    render(<TrackHeaders documentId="doc-1" />)
    await userEvent.click(screen.getByRole('button', { name: /Écouter seule la piste A1/ }))
    await userEvent.click(screen.getByRole('button', { name: /Verrouiller la piste A1/ }))

    expect(trackOf('A1')).toMatchObject({ solo: true, locked: true })
  })

  it('keeps mute off the undo stack, because it is how one works and not what one made', async () => {
    render(<TrackHeaders documentId="doc-1" />)
    await userEvent.click(screen.getByRole('button', { name: /Rendre muette la piste V1/ }))

    expect(canUndo(historyOf(useSequences.getState(), 'doc-1'))).toBe(false)
  })

  it('renames a track on double-click, and that one is undoable', async () => {
    render(<TrackHeaders documentId="doc-1" />)

    await userEvent.dblClick(screen.getByText('V1'))
    await userEvent.clear(screen.getByLabelText('Nom de la piste'))
    await userEvent.type(screen.getByLabelText('Nom de la piste'), 'Wide shot{Enter}')

    expect(trackOf('V1')?.name).toBe('Wide shot')
    expect(canUndo(historyOf(useSequences.getState(), 'doc-1'))).toBe(true)
  })

  it('keeps the old name when the edit is abandoned', async () => {
    render(<TrackHeaders documentId="doc-1" />)

    await userEvent.dblClick(screen.getByText('V1'))
    await userEvent.type(screen.getByLabelText('Nom de la piste'), 'discarded{Escape}')

    expect(trackOf('V1')?.name).toBe('V1')
  })

  it('follows the vertical scroll, so a row never drifts from the clips it names', () => {
    useTimelineView.setState({
      viewports: { 'doc-1': { scale: 1 / 1_000_000, offset: 0, scrollTop: 30 } },
    })
    render(<TrackHeaders documentId="doc-1" />)

    expect(screen.getByTestId('track-header-V1').parentElement).toHaveStyle({
      transform: 'translateY(-30px)',
    })
  })
})
