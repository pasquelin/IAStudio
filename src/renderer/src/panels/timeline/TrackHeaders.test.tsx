import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { canUndo } from '@/engines/core/history'
import { sequenceWith, trackFixture } from '@/engines/timeline/timeline-fixtures'
import type { Track } from '@/engines/timeline/timeline-state'
import { sequenceHistoryOf, sequenceOf, useSequences } from '@/stores/sequences'
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

    expect(canUndo(sequenceHistoryOf(useSequences.getState(), 'doc-1'))).toBe(false)
  })

  it('renames a track on double-click, and that one is undoable', async () => {
    render(<TrackHeaders documentId="doc-1" />)

    await userEvent.dblClick(screen.getByText('V1'))
    await userEvent.clear(screen.getByLabelText('Nom de la piste'))
    await userEvent.type(screen.getByLabelText('Nom de la piste'), 'Wide shot{Enter}')

    expect(trackOf('V1')?.name).toBe('Wide shot')
    expect(canUndo(sequenceHistoryOf(useSequences.getState(), 'doc-1'))).toBe(true)
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
  it('removes a track from its own menu', async () => {
    render(<TrackHeaders documentId="doc-1" />)
    await userEvent.click(screen.getByRole('button', { name: /Actions de la piste V1/ }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Supprimer la piste' }))

    expect(trackOf('V1')).toBeUndefined()
  })

  it('moves a track down its stack from the same menu', async () => {
    render(<TrackHeaders documentId="doc-1" />)
    await userEvent.click(screen.getByRole('button', { name: /Actions de la piste V1/ }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Descendre la piste' }))

    const ids = sequenceOf(useSequences.getState(), 'doc-1').tracks.map(track => track.id)
    expect(ids).toEqual(['A1', 'V1'])
  })

  it('offers no way up on the first row, and none down on the last', async () => {
    render(<TrackHeaders documentId="doc-1" />)
    await userEvent.click(screen.getByRole('button', { name: /Actions de la piste V1/ }))

    expect(screen.getByRole('menuitem', { name: 'Monter la piste' })).toBeDisabled()
    expect(screen.getByRole('menuitem', { name: 'Descendre la piste' })).toBeEnabled()
  })
  it('moves a track up its stack from the same menu', async () => {
    render(<TrackHeaders documentId="doc-1" />)
    await userEvent.click(screen.getByRole('button', { name: /Actions de la piste A1/ }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Monter la piste' }))

    const ids = sequenceOf(useSequences.getState(), 'doc-1').tracks.map(track => track.id)
    expect(ids).toEqual(['A1', 'V1'])
  })

  it('opens the same three rows on a right-click', async () => {
    render(<TrackHeaders documentId="doc-1" />)
    fireEvent.contextMenu(screen.getByTestId('track-header-V1'))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Supprimer la piste' }))

    expect(trackOf('V1')).toBeUndefined()
  })

  describe('dragged by its grip', () => {
    const grip = (name: string): HTMLElement =>
      screen.getByRole('button', { name: `Déplacer la piste ${name}` })

    /**
     * The gesture listens on the window — see `TimelineRow`, which says why it has to. `buttons`
     * is part of the move: one carrying none is how a release out of sight is found out about.
     */
    const dragTo = (clientY: number): void => {
      fireEvent.pointerMove(window, { clientY, buttons: 1 })
    }
    const drop = (): void => {
      fireEvent.pointerUp(window)
    }

    const ids = (): (string | undefined)[] =>
      sequenceOf(useSequences.getState(), 'doc-1').tracks.map(track => track.id)

    it('moves the track through the stack', () => {
      render(<TrackHeaders documentId="doc-1" />)

      fireEvent.pointerDown(grip('V1'), { clientY: 0 })
      dragTo(60)
      drop()

      expect(ids()).toEqual(['A1', 'V1'])
    })

    // A drag across the stack is one thing the user did: without the gesture it lands as one
    // entry per step, and ⌘Z gives the stack back a row at a time.
    it('costs one entry in the history, however many rows it crossed', () => {
      render(<TrackHeaders documentId="doc-1" />)
      const before = sequenceHistoryOf(useSequences.getState(), 'doc-1').past.length

      fireEvent.pointerDown(grip('V1'), { clientY: 0 })
      dragTo(60)
      dragTo(120)
      drop()

      expect(sequenceHistoryOf(useSequences.getState(), 'doc-1').past).toHaveLength(before + 1)
    })

    // Held against the end of the stack, the drag banks nothing — otherwise bringing the pointer
    // back where it started would spend those steps the other way, and the track would climb.
    it('writes nothing at all when there is nowhere to go', () => {
      render(<TrackHeaders documentId="doc-1" />)

      fireEvent.pointerDown(grip('A1'), { clientY: 0 })
      dragTo(60)
      dragTo(0)
      drop()

      expect(ids()).toEqual(['V1', 'A1'])
      expect(sequenceHistoryOf(useSequences.getState(), 'doc-1').past).toHaveLength(0)
    })
  })

  /**
   * The rename field sits inside the header, so this row's own menu would take a press meant for
   * the native clipboard one — and `preventDefault` is what keeps Chromium from ever asking the
   * main process for it (`main/window/context-menu.ts`).
   */
  it('leaves a right-click in the rename field to the native menu', async () => {
    render(<TrackHeaders documentId="doc-1" />)
    await userEvent.dblClick(screen.getByText('V1'))

    const raised = fireEvent.contextMenu(screen.getByRole('textbox'))

    expect(raised).toBe(true)
    expect(screen.queryByRole('menuitem')).not.toBeInTheDocument()
  })
})
