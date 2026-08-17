import { act, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS } from '@shared/domain/settings'
import { installFakeBridge } from '@/services/fakeBridge'
import { useMedia } from '@/stores/media'
import { useSettings } from '@/stores/settings'
import { MediaSettings } from './MediaSettings'

describe('MediaSettings', () => {
  beforeEach(() => {
    useSettings.setState({ settings: DEFAULT_SETTINGS })
    useMedia.setState({ capabilities: { ffmpeg: true } })
  })

  it('says what is missing when no binary answers', async () => {
    installFakeBridge({ media: { capabilities: () => Promise.resolve({ ffmpeg: false }) } })
    render(<MediaSettings />)

    await waitFor(() => expect(screen.getByText(/reste introuvable/)).toBeInTheDocument())
  })

  it('asks again after the path changed, since that setting is what decides the answer', async () => {
    const capabilities = vi.fn(() => Promise.resolve({ ffmpeg: true }))
    installFakeBridge({ media: { capabilities } })
    render(<MediaSettings />)

    await waitFor(() => expect(capabilities).toHaveBeenCalledOnce())

    act(() => {
      useSettings.setState({
        settings: { ...DEFAULT_SETTINGS, media: { ffmpegPath: '/usr/bin/ffmpeg' } },
      })
    })

    await waitFor(() => expect(capabilities).toHaveBeenCalledTimes(2))
  })
})
