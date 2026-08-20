import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS } from '@shared/domain/settings'
import { useDictation } from '@/stores/dictation'
import { useSettings } from '@/stores/settings'
import { useSettingsDraft } from '@/stores/settingsDraft'
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

  /**
   * The row was written by hand outside `SettingLine`, so it carried neither of the two things
   * every neighbouring setting offers: nothing said the choice was waiting for Apply, and there
   * was no way back to the microphone the application ships with — the system default.
   */
  it('offers the way back to the system default, once one has been chosen', async () => {
    render(<DictationSettings />)
    const restore = screen.getByRole('button', { name: /Restaurer/ })
    expect(restore).toBeDisabled()

    await userEvent.selectOptions(screen.getByRole('combobox'), 'usb')
    expect(restore).toBeEnabled()

    await userEvent.click(restore)
    expect(screen.getByRole('combobox')).toHaveValue('')
  })

  // The registry spells the system default as no key, the `<option>` spells it `''`: read as two
  // values, the button offered a way back from the default to itself.
  it('offers no way back once the system default is what is chosen', async () => {
    render(<DictationSettings />)

    await userEvent.selectOptions(screen.getByRole('combobox'), 'usb')
    await userEvent.selectOptions(screen.getByRole('combobox'), '')

    expect(screen.getByRole('button', { name: /Restaurer/ })).toBeDisabled()
  })

  /**
   * The main process takes `z.string().min(1).optional()`: an empty string makes Apply throw, and
   * the draft is cleared before that write is awaited — every other staged setting would go with
   * it, without a word on screen.
   */
  it('stages the system default as no value at all, never as an empty string', async () => {
    render(<DictationSettings />)

    await userEvent.selectOptions(screen.getByRole('combobox'), 'usb')
    await userEvent.click(screen.getByRole('button', { name: /Restaurer/ }))
    expect(useSettingsDraft.getState().pending.dictation?.inputDeviceId).toBeUndefined()

    await userEvent.selectOptions(screen.getByRole('combobox'), 'usb')
    await userEvent.selectOptions(screen.getByRole('combobox'), '')
    expect(useSettingsDraft.getState().pending.dictation?.inputDeviceId).toBeUndefined()
  })

  it('marks the choice as waiting for Apply, like the settings above it', async () => {
    const { container } = render(<DictationSettings />)
    expect(container.querySelector('.bg-primary.invisible')).not.toBeNull()

    await userEvent.selectOptions(screen.getByRole('combobox'), 'usb')

    expect(container.querySelector('.bg-primary.invisible')).toBeNull()
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
