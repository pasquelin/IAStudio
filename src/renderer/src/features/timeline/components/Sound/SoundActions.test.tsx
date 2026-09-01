import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SECOND } from '@shared/domain/time'
import { transports } from '@/engines/timeline/playback'
import { EMPTY_SOUND_SEQUENCE } from '@/engines/timeline/timelineState'
import { installDocument } from '@/stores/document-fixtures'
import { useDocuments } from '@/stores/documents'
import { sequenceOf, useSequences } from '@/stores/sequences'
import { TimelineActions } from '../Timeline/TimelineActions'

const DOCUMENT = 'take-1'

const montage = () => sequenceOf(useSequences.getState(), DOCUMENT)

describe('the bar of a sound montage', () => {
  beforeEach(() => {
    useDocuments.setState({ documents: {}, activeId: null })
    useSequences.setState({ states: { [DOCUMENT]: EMPTY_SOUND_SEQUENCE }, histories: {} })
    installDocument(DOCUMENT, 'audio')
    render(<TimelineActions />)
  })

  // No picture track: this workspace has no monitor to play one on, and `trackForAsset` would
  // then let a video land on a row nothing ever shows.
  it('offers to add a sound track, and only a sound track', () => {
    expect(screen.getByRole('button', { name: /Ajouter une piste audio/ })).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Ajouter une piste vidéo/ }),
    ).not.toBeInTheDocument()
  })

  it('carries the montage tools, as the sequence bar does', () => {
    expect(screen.getByRole('button', { name: /Lame/ })).toBeInTheDocument()
  })

  it('brings the head back to the start', async () => {
    useSequences.getState().replace(DOCUMENT, { ...montage(), playhead: 3 * SECOND })

    await userEvent.click(screen.getByRole('button', { name: /Retour au début/ }))

    expect(montage().playhead).toBe(0)
  })

  /**
   * The player lives in the programme monitor now, as the picture pair's does — this row asks it
   * through the registry both surfaces share. Owned here, it was a second player for a montage
   * that already had one, and the workspace's single playback token would have arbitrated
   * between two halves of the same document.
   */
  it('asks the monitor to play rather than holding a player of its own', async () => {
    const play = vi.fn()
    const stop = transports.register(DOCUMENT, { play, pause: vi.fn(), playing: () => false })

    await userEvent.click(screen.getByRole('button', { name: /^Lire/ }))

    expect(play).toHaveBeenCalledOnce()
    stop()
  })
})
