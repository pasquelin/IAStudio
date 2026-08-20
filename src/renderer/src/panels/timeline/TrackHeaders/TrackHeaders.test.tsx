import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StrictMode } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'
import { canUndo } from '@/engines/core/history'
import { sequenceWith, trackFixture } from '@/engines/timeline/timeline-fixtures'
import { DEFAULT_TRACK_HEIGHT, type Track } from '@/engines/timeline/timelineState'
import { useSelection } from '@/stores/selection'
import { sequenceHistoryOf, sequenceOf, sequenceStore, useSequences } from '@/stores/sequences'
import { useTimelineView } from '@/stores/timelineView'
import { TrackHeaders } from './TrackHeaders'

const trackOf = (id: string): Track | undefined =>
  sequenceOf(useSequences.getState(), 'doc-1').tracks.find(track => track.id === id)

const installTracks = (tracks: readonly Track[]): void => {
  useSequences.setState({ states: { 'doc-1': sequenceWith([...tracks]) }, histories: {} })
}

/**
 * Always under `StrictMode`, and written once so no case can be added without it.
 *
 * It is the subject of the drag block below, not a detail of its setup: the window runs under it
 * (`main.tsx`) and `render` does not, and StrictMode is what makes React replay the effects of a
 * row it RELOCATED — which descending IS. Rendered plainly, the drag tests go green on exactly
 * the defect they exist for.
 */
const headers = (): ReturnType<typeof render> =>
  render(<TrackHeaders documentId="doc-1" />, { wrapper: StrictMode })

describe('TrackHeaders', () => {
  beforeEach(() => {
    useTimelineView.setState({ viewports: {} })
    // The selection is one store for the whole window: a case that picks a track leaves it picked
    // for the next one, which then reads an answer it never asked for.
    useSelection.getState().clear()
    installTracks([trackFixture('V1', 'video'), trackFixture('A1', 'audio')])
  })

  it('names one row per track', () => {
    headers()

    expect(screen.getByText('V1')).toBeInTheDocument()
    expect(screen.getByText('A1')).toBeInTheDocument()
  })

  /** The pendant of the same case in `AnimationHeaders.test.tsx` — see there for what it holds. */
  it('announces itself as the tracks of the montage, not as the rows of the animation', () => {
    headers()

    expect(screen.getByRole('list', { name: 'Pistes du montage' })).toBeInTheDocument()
  })

  it('gives each row the height its track carries', () => {
    installTracks([trackFixture('V1', 'video', [], { height: 90 })])
    headers()

    expect(screen.getByTestId('track-header-V1')).toHaveStyle({ height: '90px' })
  })

  it('mutes a track from its own row', async () => {
    headers()
    await userEvent.click(screen.getByRole('button', { name: /Rendre muette la piste V1/ }))

    expect(trackOf('V1')?.muted).toBe(true)
  })

  it('solos and locks a track from its own row', async () => {
    headers()
    await userEvent.click(screen.getByRole('button', { name: /Écouter seule la piste A1/ }))
    await userEvent.click(screen.getByRole('button', { name: /Verrouiller la piste A1/ }))

    expect(trackOf('A1')).toMatchObject({ solo: true, locked: true })
  })

  it('keeps mute off the undo stack, because it is how one works and not what one made', async () => {
    headers()
    await userEvent.click(screen.getByRole('button', { name: /Rendre muette la piste V1/ }))

    expect(canUndo(sequenceHistoryOf(useSequences.getState(), 'doc-1'))).toBe(false)
  })

  it('renames a track on double-click, and that one is undoable', async () => {
    headers()

    await userEvent.dblClick(screen.getByText('V1'))
    await userEvent.clear(screen.getByLabelText('Nom de la piste'))
    await userEvent.type(screen.getByLabelText('Nom de la piste'), 'Wide shot{Enter}')

    expect(trackOf('V1')?.name).toBe('Wide shot')
    expect(canUndo(sequenceHistoryOf(useSequences.getState(), 'doc-1'))).toBe(true)
  })

  // The field commits the original name on Escape rather than nothing at all, so an abandoned
  // edit that reached the command would cost a ⌘Z that undoes a rename nobody made.
  it('keeps the old name when the edit is abandoned, and costs nothing to undo', async () => {
    headers()

    await userEvent.dblClick(screen.getByText('V1'))
    await userEvent.type(screen.getByLabelText('Nom de la piste'), 'discarded{Escape}')

    expect(trackOf('V1')?.name).toBe('V1')
    expect(canUndo(sequenceHistoryOf(useSequences.getState(), 'doc-1'))).toBe(false)
  })

  // The order `forgetDocument` closes in: the store drops the document, and only THEN is the
  // panel unmounted — so the field's own cleanup commits after the document is gone.
  it('does not put a closed document back in the store when the field is torn out', async () => {
    const view = headers()

    await userEvent.dblClick(screen.getByText('V1'))
    await userEvent.type(screen.getByLabelText('Nom de la piste'), 'Ambience')

    useSequences.getState().drop('doc-1')
    view.unmount()

    expect(sequenceStore.hasState(useSequences.getState(), 'doc-1')).toBe(false)
  })

  it('follows the vertical scroll, so a row never drifts from the clips it names', () => {
    useTimelineView.setState({
      viewports: { 'doc-1': { scale: 1 / 1_000_000, offset: 0, scrollTop: 30 } },
    })
    headers()

    expect(screen.getByTestId('track-header-V1').parentElement).toHaveStyle({
      transform: 'translateY(-30px)',
    })
  })
  it('removes a track from its own menu', async () => {
    headers()
    await userEvent.click(screen.getByRole('button', { name: /Actions de la piste V1/ }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Supprimer la piste' }))

    expect(trackOf('V1')).toBeUndefined()
  })

  it('moves a track down its stack from the same menu', async () => {
    headers()
    await userEvent.click(screen.getByRole('button', { name: /Actions de la piste V1/ }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Descendre la piste' }))

    const ids = sequenceOf(useSequences.getState(), 'doc-1').tracks.map(track => track.id)
    expect(ids).toEqual(['A1', 'V1'])
  })

  it('offers no way up on the first row, and none down on the last', async () => {
    headers()
    await userEvent.click(screen.getByRole('button', { name: /Actions de la piste V1/ }))

    expect(screen.getByRole('menuitem', { name: 'Monter la piste' })).toBeDisabled()
    expect(screen.getByRole('menuitem', { name: 'Descendre la piste' })).toBeEnabled()
  })
  it('moves a track up its stack from the same menu', async () => {
    headers()
    await userEvent.click(screen.getByRole('button', { name: /Actions de la piste A1/ }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Monter la piste' }))

    const ids = sequenceOf(useSequences.getState(), 'doc-1').tracks.map(track => track.id)
    expect(ids).toEqual(['A1', 'V1'])
  })

  it('opens the same three rows on a right-click', async () => {
    headers()
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
      headers()

      fireEvent.pointerDown(grip('V1'), { clientY: 0 })
      dragTo(DEFAULT_TRACK_HEIGHT)
      drop()

      expect(ids()).toEqual(['A1', 'V1'])
    })

    // A drag across the stack is one thing the user did: without the gesture it lands as one
    // entry per step, and ⌘Z gives the stack back a row at a time.
    it('costs one entry in the history, however many rows it crossed', () => {
      headers()
      const before = sequenceHistoryOf(useSequences.getState(), 'doc-1').past.length

      fireEvent.pointerDown(grip('V1'), { clientY: 0 })
      dragTo(DEFAULT_TRACK_HEIGHT)
      dragTo(2 * DEFAULT_TRACK_HEIGHT)
      drop()

      expect(sequenceHistoryOf(useSequences.getState(), 'doc-1').past).toHaveLength(before + 1)
    })

    // Climbing crossed as many rows as the pointer did; descending stopped at the first — see
    // `headers` for what reproduces it, and `helpers/teardown` for why.
    it('carries the top track all the way to the bottom of the stack', () => {
      installTracks([
        trackFixture('V1', 'video'),
        trackFixture('V2', 'video'),
        trackFixture('A1', 'audio'),
        trackFixture('A2', 'audio'),
      ])
      headers()

      fireEvent.pointerDown(grip('V1'), { clientY: 0 })
      dragTo(DEFAULT_TRACK_HEIGHT)
      dragTo(2 * DEFAULT_TRACK_HEIGHT)
      dragTo(3 * DEFAULT_TRACK_HEIGHT)
      drop()

      expect(ids()).toEqual(['V2', 'A1', 'A2', 'V1'])
    })

    // Held against the end of the stack, the drag banks nothing — otherwise bringing the pointer
    // back where it started would spend those steps the other way, and the track would climb.
    it('writes nothing at all when there is nowhere to go', () => {
      headers()

      fireEvent.pointerDown(grip('A1'), { clientY: 0 })
      dragTo(DEFAULT_TRACK_HEIGHT)
      dragTo(0)
      drop()

      expect(ids()).toEqual(['V1', 'A1'])
      expect(sequenceHistoryOf(useSequences.getState(), 'doc-1').past).toHaveLength(0)
    })
  })

  /**
   * The rename field sits inside the header, so this row's own menu would take a press meant for
   * the native clipboard one — and `preventDefault` is what keeps Chromium from ever asking the
   * main process for it (`main/window/contextMenu.ts`).
   */
  it('leaves a right-click in the rename field to the native menu', async () => {
    headers()
    await userEvent.dblClick(screen.getByText('V1'))

    const raised = fireEvent.contextMenu(screen.getByRole('textbox'))

    expect(raised).toBe(true)
    expect(screen.queryByRole('menuitem')).not.toBeInTheDocument()
  })

  /**
   * A press hands the track to the inspector, which then describes a row the column marks
   * nowhere: not in the accessibility tree, and not to the eye either — the visual side of this
   * is a separate decision.
   */
  describe('the row the inspector is describing', () => {
    const row = (id: string): HTMLElement => screen.getByTestId(`track-header-${id}`)

    it('says which one it is, and only that one', () => {
      headers()

      fireEvent.pointerDown(screen.getByText('A1'))

      expect(row('A1')).toHaveAttribute('aria-current', 'true')
      expect(row('V1')).not.toHaveAttribute('aria-current')
    })

    /**
     * Every sequence names its first tracks `V1` and `A1`, so an id alone matches across tabs.
     * A track picked in another document must leave this column saying nothing.
     */
    it('says nothing for a track of the same name picked in another document', () => {
      headers()

      act(() => useSelection.getState().selectTrack('doc-2', 'A1'))

      expect(row('A1')).not.toHaveAttribute('aria-current')
    })
  })
})
