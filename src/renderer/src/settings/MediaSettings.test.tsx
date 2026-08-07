import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS } from '@shared/domain/settings'
import { installFakeBridge } from '@/services/fake-bridge'
import { useMedia } from '@/stores/media'
import { useSettings } from '@/stores/settings'
import { MediaSettings } from './MediaSettings'

describe('MediaSettings', () => {
  beforeEach(() => {
    useSettings.setState({ settings: DEFAULT_SETTINGS })
    useMedia.setState({ capabilities: { ffmpeg: true } })
  })

  it('keeps every character typed into the path, which a write per keystroke would eat', async () => {
    installFakeBridge()
    render(<MediaSettings />)

    const field = screen.getByLabelText(/Chemin de ffmpeg/)
    await userEvent.type(field, '/opt/homebrew/bin/ffmpeg')

    expect(field).toHaveValue('/opt/homebrew/bin/ffmpeg')
  })

  it('stores the path once, when the field is left', async () => {
    const write = vi.fn(async () => undefined)
    useSettings.setState({ write })
    installFakeBridge()
    render(<MediaSettings />)

    await userEvent.type(screen.getByLabelText(/Chemin de ffmpeg/), '/usr/bin/ffmpeg')
    await userEvent.tab()

    expect(write).toHaveBeenCalledExactlyOnceWith({ media: { ffmpegPath: '/usr/bin/ffmpeg' } })
  })

  it('drops the setting when the field is emptied, rather than storing a blank path', async () => {
    const write = vi.fn(async () => undefined)
    useSettings.setState({
      settings: { ...DEFAULT_SETTINGS, media: { ffmpegPath: '/usr/bin/ffmpeg' } },
      write,
    })
    installFakeBridge()
    render(<MediaSettings />)

    await userEvent.clear(screen.getByLabelText(/Chemin de ffmpeg/))
    await userEvent.tab()

    expect(write).toHaveBeenCalledExactlyOnceWith({ media: { ffmpegPath: undefined } })
  })

  it('shows a setting that arrived after it mounted, rather than an empty field', async () => {
    installFakeBridge()
    render(<MediaSettings />)

    // The settings window loads its settings over IPC; the section may well render first.
    act(() => {
      useSettings.setState({
        settings: { ...DEFAULT_SETTINGS, media: { ffmpegPath: '/opt/homebrew/bin/ffmpeg' } },
      })
    })

    expect(screen.getByLabelText(/Chemin de ffmpeg/)).toHaveValue('/opt/homebrew/bin/ffmpeg')
  })

  it('never erases a stored path just because the field was never touched', async () => {
    const write = vi.fn(async () => undefined)
    installFakeBridge()
    render(<MediaSettings />)

    act(() => {
      useSettings.setState({
        settings: { ...DEFAULT_SETTINGS, media: { ffmpegPath: '/usr/bin/ffmpeg' } },
        write,
      })
    })
    await userEvent.click(screen.getByLabelText(/Chemin de ffmpeg/))
    await userEvent.tab()

    expect(write).not.toHaveBeenCalled()
  })

  it('says what is missing when no binary answers', async () => {
    installFakeBridge({ media: { capabilities: () => Promise.resolve({ ffmpeg: false }) } })
    render(<MediaSettings />)

    await waitFor(() => expect(screen.getByText(/reste introuvable/)).toBeInTheDocument())
  })

  it('asks again after the path changed, since that field is what decides the answer', async () => {
    const capabilities = vi.fn(() => Promise.resolve({ ffmpeg: true }))
    installFakeBridge({ media: { capabilities } })
    render(<MediaSettings />)

    await waitFor(() => expect(capabilities).toHaveBeenCalledOnce())
    await userEvent.type(screen.getByLabelText(/Chemin de ffmpeg/), '/usr/bin/ffmpeg')
    await userEvent.tab()

    await waitFor(() => expect(capabilities).toHaveBeenCalledTimes(2))
  })
})
