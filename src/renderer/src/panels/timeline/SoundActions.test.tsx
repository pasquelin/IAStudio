import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { SECOND } from '@shared/domain/time'
import { EMPTY_SOUND_SEQUENCE } from '@/engines/timeline/timeline-state'
import { installDocument } from '@/stores/document-fixtures'
import { useDocuments } from '@/stores/documents'
import { sequenceOf, useSequences } from '@/stores/sequences'
import { TimelineActions } from './TimelineActions'

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
})
