import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { programOwner, transports } from '@/engines/timeline/playback'
import { usePlayback } from '@/stores/playback'
import { installSequence } from '@/stores/sequence-fixtures'
import { sequenceOf, sequenceStore, useSequences } from '@/stores/sequences'
import { ProgramTransport } from './ProgramTransport'

const OWNER = programOwner('doc-1')

describe('ProgramTransport', () => {
  const play = vi.fn()
  const pause = vi.fn()
  let unregister = (): void => undefined

  beforeEach(() => {
    usePlayback.setState({ running: {} })
    installSequence('doc-1')
    play.mockReset()
    pause.mockReset()
    unregister()
    unregister = transports.register(OWNER, { play, pause, playing: () => false })
  })

  // It owns no player: the picture is the monitor's, and a second engine on one sequence would
  // fight the first over the playback token.
  it('asks the programme monitor to run rather than playing anything itself', async () => {
    render(<ProgramTransport documentId="doc-1" />)

    await userEvent.click(screen.getByRole('button', { name: /^Lire/ }))

    expect(play).toHaveBeenCalledTimes(1)
  })

  it('reads as playing from what the player reported, not from what was pressed', () => {
    usePlayback.getState().setRunning(OWNER, true)
    render(<ProgramTransport documentId="doc-1" />)

    expect(screen.getByRole('button', { name: /^Pause/ })).toBeInTheDocument()
  })

  it('stops the player and puts the head back at the start', async () => {
    const store = useSequences.getState()
    store.replace('doc-1', { ...sequenceOf(store, 'doc-1'), playhead: 2_000_000 })
    render(<ProgramTransport documentId="doc-1" />)

    await userEvent.click(screen.getByRole('button', { name: /Retour au début/ }))

    expect(pause).toHaveBeenCalledTimes(1)
    expect(sequenceOf(useSequences.getState(), 'doc-1').playhead).toBe(0)
  })

  it('does not rebuild a document that has already been dropped', async () => {
    useSequences.getState().drop('doc-1')
    render(<ProgramTransport documentId="doc-1" />)

    await userEvent.click(screen.getByRole('button', { name: /Retour au début/ }))

    expect(sequenceStore.hasState(useSequences.getState(), 'doc-1')).toBe(false)
  })
})
