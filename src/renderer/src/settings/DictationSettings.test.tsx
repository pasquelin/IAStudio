import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS } from '@shared/domain/settings'
import { useDictation } from '@/stores/dictation'
import { useSettings } from '@/stores/settings'
import { useSettingsDraft } from '@/stores/settings-draft'
import { DictationSettings } from './DictationSettings'

const listeners = new Map<string, () => void>()

beforeEach(() => {
  listeners.clear()
  // Defined rather than the whole of `navigator` stubbed: jsdom ships no `mediaDevices`, and
  // replacing the object wholesale takes `language` and the rest of it away with it.
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: {
      addEventListener: (event: string, listener: () => void) => listeners.set(event, listener),
      removeEventListener: (event: string) => listeners.delete(event),
      enumerateDevices: () => Promise.resolve([]),
    },
  })

  useSettings.setState({ settings: DEFAULT_SETTINGS })
  useSettingsDraft.setState({ pending: {}, touched: new Set() })
  useDictation.setState({
    devices: [
      { id: 'usb', label: 'Casque USB' },
      { id: 'built-in', label: 'Micro intégré' },
    ],
    refreshDevices: () => Promise.resolve(),
  })
})

afterEach(() => vi.restoreAllMocks())

describe('choosing a microphone', () => {
  it('lists what is plugged in, with the system default first', () => {
    render(<DictationSettings />)

    const options = screen.getAllByRole('option').map(option => option.textContent)
    expect(options).toEqual(['Périphérique par défaut', 'Casque USB', 'Micro intégré'])
  })

  // Through the same buffer every other row uses: a choice waits for Apply, and Cancel takes it
  // back with the rest.
  it('stages the choice rather than writing it at once', async () => {
    render(<DictationSettings />)

    await userEvent.selectOptions(screen.getByRole('combobox'), 'usb')

    expect(useSettingsDraft.getState().touched.has('dictation.inputDeviceId')).toBe(true)
  })

  it('says so when the machine offers nothing', () => {
    useDictation.setState({ devices: [] })
    render(<DictationSettings />)

    expect(screen.getByText(/Aucun micro/)).toBeInTheDocument()
  })

  // A headset plugged in or pulled out while the settings are open changes the list under the
  // hand that is choosing from it.
  it('follows the microphones being plugged in and out', () => {
    render(<DictationSettings />)

    expect(listeners.has('devicechange')).toBe(true)
  })

  it('shows nothing at all when dictation is switched off', () => {
    useSettings.setState({
      settings: {
        ...DEFAULT_SETTINGS,
        dictation: { ...DEFAULT_SETTINGS.dictation, enabled: false },
      },
    })
    render(<DictationSettings />)

    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })
})
