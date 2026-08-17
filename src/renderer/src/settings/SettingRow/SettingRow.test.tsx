import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '@shared/domain/settings'
import type { SettingPath, SettingValue } from '@shared/domain/settingsPath'
import { descriptorAt } from '@shared/domain/settingsRegistry'
import { WINDOW_HELP } from '@/design/windowStyles'
import { TOOLTIP_ID } from '@/helpers/tooltip'
import { useSettings } from '@/stores/settings'
import { useSettingsDraft } from '@/stores/settingsDraft'
import { SettingRow } from './SettingRow'

function rowFor(path: SettingPath) {
  const descriptor = descriptorAt(path)
  if (!descriptor) throw new Error(`${path} is not described`)
  return <SettingRow descriptor={descriptor} />
}

type Write = [SettingPath, SettingValue | undefined]

/** The real staging, kept so a capture observes without replacing what the row actually does. */
const stage = useSettingsDraft.getState().stage

function captureWrites(): Write[] {
  const written: Write[] = []
  useSettingsDraft.setState({
    stage: (path, value) => {
      written.push([path, value])
      stage(path, value)
    },
  })
  return written
}

function resetDraft(): void {
  useSettingsDraft.setState({ pending: {}, touched: new Set(), stage })
}

describe('SettingRow', () => {
  beforeEach(() => {
    useSettings.setState({ settings: DEFAULT_SETTINGS })
    resetDraft()
  })

  // The whole point of the registry: no setting reaches a screen without being explained.
  it('names the setting and says what it does', () => {
    render(rowFor('generation.maxRetries'))

    expect(screen.getByLabelText(/Tentatives maximum/)).toBeInTheDocument()
    expect(screen.getByText(/réessaie toute seule/)).toBeInTheDocument()
  })

  it('ties the description to the control, so it is read out with it', () => {
    render(rowFor('appearance.theme'))

    const control = screen.getByLabelText(/Thème/)
    const description = document.getElementById(control.getAttribute('aria-describedby') ?? '')
    expect(description?.textContent).toMatch(/repose les yeux/)
  })

  /**
   * Read from the shared module rather than written here: the same sentence style runs through
   * both windows outside the docks, and a copy of the classes is a copy that drifts.
   */
  it('dresses its help line as every other window sentence', () => {
    render(rowFor('appearance.theme'))

    const control = screen.getByLabelText(/Thème/)
    const description = document.getElementById(control.getAttribute('aria-describedby') ?? '')
    expect(description).toHaveClass(WINDOW_HELP)
  })

  it('offers a choice as its declared options, translated', async () => {
    const written = captureWrites()
    render(rowFor('appearance.theme'))

    await userEvent.selectOptions(screen.getByLabelText(/Thème/), 'light')

    expect(written.at(-1)).toEqual(['appearance.theme', 'light'])
  })

  it('writes a number as it is changed', () => {
    const written = captureWrites()
    render(rowFor('generation.maxRetries'))

    fireEvent.change(screen.getByLabelText(/Tentatives maximum/), { target: { value: '7' } })

    expect(written).toEqual([['generation.maxRetries', 7]])
  })

  it('keeps every character typed into a path, which a write per keystroke would eat', async () => {
    render(rowFor('media.ffmpegPath'))

    const field = screen.getByLabelText(/Chemin de ffmpeg/)
    await userEvent.type(field, '/opt/homebrew/bin/ffmpeg')

    expect(field).toHaveValue('/opt/homebrew/bin/ffmpeg')
  })

  it('stores a path once, when the field is left', async () => {
    const written = captureWrites()
    render(rowFor('media.ffmpegPath'))

    await userEvent.type(screen.getByLabelText(/Chemin de ffmpeg/), '/usr/bin/ffmpeg')
    await userEvent.tab()

    expect(written).toEqual([['media.ffmpegPath', '/usr/bin/ffmpeg']])
  })

  // Enter stores the field, so it must not store one an input method has not finished writing.
  it('leaves Enter to the input method while it is composing a character', async () => {
    const written = captureWrites()
    render(rowFor('media.ffmpegPath'))

    await userEvent.type(screen.getByLabelText(/Chemin de ffmpeg/), '/usr/bin/ff')
    fireEvent.keyDown(screen.getByLabelText(/Chemin de ffmpeg/), {
      key: 'Enter',
      isComposing: true,
    })

    expect(written).toEqual([])
  })

  it('drops the setting when the field is emptied, rather than storing a blank', async () => {
    useSettings.setState({
      settings: { ...DEFAULT_SETTINGS, media: { ffmpegPath: '/usr/bin/ffmpeg' } },
    })
    const written = captureWrites()
    render(rowFor('media.ffmpegPath'))

    await userEvent.clear(screen.getByLabelText(/Chemin de ffmpeg/))
    await userEvent.tab()

    // Unset, not blank: that is what lets ffmpeg fall back to the bundled binary, then to PATH.
    expect(written).toEqual([['media.ffmpegPath', undefined]])
  })

  it('shows a value that arrived after it mounted, rather than an empty field', () => {
    render(rowFor('media.ffmpegPath'))

    // The settings window loads over IPC; the row may well render first.
    act(() => {
      useSettings.setState({
        settings: { ...DEFAULT_SETTINGS, media: { ffmpegPath: '/opt/homebrew/bin/ffmpeg' } },
      })
    })

    expect(screen.getByLabelText(/Chemin de ffmpeg/)).toHaveValue('/opt/homebrew/bin/ffmpeg')
  })

  it('never erases a stored path just because the field was never touched', async () => {
    useSettings.setState({
      settings: { ...DEFAULT_SETTINGS, media: { ffmpegPath: '/usr/bin/ffmpeg' } },
    })
    const written = captureWrites()
    render(rowFor('media.ffmpegPath'))

    await userEvent.click(screen.getByLabelText(/Chemin de ffmpeg/))
    await userEvent.tab()

    expect(written).toEqual([])
  })

  // Restoring while the field held a typed word used to leave that word on screen.
  it('clears a typed path once the value moves under the edit', async () => {
    useSettings.setState({
      settings: { ...DEFAULT_SETTINGS, media: { ffmpegPath: '/usr/bin/ffmpeg' } },
    })
    render(rowFor('media.ffmpegPath'))

    const field = screen.getByLabelText(/Chemin de ffmpeg/)
    await userEvent.type(field, '/typed')

    act(() => {
      useSettings.setState({ settings: DEFAULT_SETTINGS })
    })

    expect(field).toHaveValue('')
  })

  /**
   * `title` was the native tooltip: the OS delay, none of the theme, and nothing beyond the
   * button's own name. Read the content rather than the name — the name did not change.
   */
  it('explains what going back does, through the studio tooltip', () => {
    render(rowFor('appearance.theme'))

    const restore = screen.getByRole('button', { name: /Restaurer/ })
    expect(restore).toHaveAttribute('data-tooltip-id', TOOLTIP_ID)
    expect(restore).toHaveAttribute('data-tooltip-place', 'left')
    expect(restore).toHaveAttribute(
      'data-tooltip-content',
      'Remet la valeur d’origine, celle d’avant toute modification',
    )
    expect(restore).not.toHaveAttribute('title')
  })

  it('offers no way back while the setting is still at its default', () => {
    render(rowFor('appearance.theme'))
    expect(screen.getByRole('button', { name: /Restaurer/ })).toBeDisabled()
  })

  it('restores the default of a setting that was changed', async () => {
    useSettings.setState({
      settings: {
        ...DEFAULT_SETTINGS,
        appearance: { ...DEFAULT_SETTINGS.appearance, theme: 'light' },
      },
    })
    const written = captureWrites()
    render(rowFor('appearance.theme'))

    await userEvent.click(screen.getByRole('button', { name: /Restaurer/ }))

    expect(written).toEqual([['appearance.theme', 'dark']])
  })

  // An emptied number field is mid-edit, not a request to store nothing.
  it('reports an emptied number as no change at all', () => {
    const written = captureWrites()
    render(rowFor('generation.maxRetries'))

    fireEvent.change(screen.getByLabelText(/Tentatives maximum/), { target: { value: '' } })

    expect(written).toEqual([])
  })

  /**
   * The main process refuses a decimal outright, and the rejected write would leave the field
   * showing a number nothing stored — with nothing on screen to say so.
   */
  it('never sends a number the main process would refuse', () => {
    const written = captureWrites()
    render(rowFor('generation.maxRetries'))

    const field = screen.getByLabelText(/Tentatives maximum/)
    fireEvent.change(field, { target: { value: '3.5' } })
    // Bounds are 0 to 10; the HTML attributes do not stop anyone typing past them.
    fireEvent.change(field, { target: { value: '99' } })
    fireEvent.change(field, { target: { value: '-1' } })

    expect(written).toEqual([])
  })

  it('accepts a number inside the declared bounds', () => {
    const written = captureWrites()
    render(rowFor('generation.maxRetries'))

    fireEvent.change(screen.getByLabelText(/Tentatives maximum/), { target: { value: '10' } })

    expect(written).toEqual([['generation.maxRetries', 10]])
  })

  it('writes nothing when a path is retyped to what it already holds', async () => {
    useSettings.setState({
      settings: { ...DEFAULT_SETTINGS, media: { ffmpegPath: '/usr/bin/ffmpeg' } },
    })
    const written = captureWrites()
    render(rowFor('media.ffmpegPath'))

    const field = screen.getByLabelText(/Chemin de ffmpeg/)
    await userEvent.type(field, '  ')
    await userEvent.tab()

    expect(written).toEqual([])
    // And the spaces do not survive on screen, where nothing else would ever clear them.
    expect(field).toHaveValue('/usr/bin/ffmpeg')
  })
})

describe('the controls a kind brings with it', () => {
  beforeEach(() => {
    useSettings.setState({ settings: DEFAULT_SETTINGS })
    resetDraft()
  })

  it('writes a boolean as a boolean, not as the string a checkbox carries', () => {
    const written = captureWrites()
    render(rowFor('appearance.reduceMotion'))

    fireEvent.click(screen.getByLabelText(/Limiter les animations/))

    expect(written).toEqual([['appearance.reduceMotion', true]])
  })

  it('accepts the decimal step of a slider, which a whole-number field would refuse', () => {
    const written = captureWrites()
    render(rowFor('appearance.fontScale'))

    fireEvent.change(screen.getByLabelText(/Taille du texte/), { target: { value: '1.15' } })

    expect(written).toEqual([['appearance.fontScale', 1.15]])
  })

  it('shows the slider value, so a handle position is a number one can aim at', () => {
    useSettings.setState({
      settings: {
        ...DEFAULT_SETTINGS,
        appearance: { ...DEFAULT_SETTINGS.appearance, fontScale: 1.2 },
      },
    })
    render(rowFor('appearance.fontScale'))

    expect(screen.getByText('1,20')).toBeInTheDocument()
  })

  it('clamps to the declared maximum rather than sending a value zod would refuse', () => {
    const written = captureWrites()
    render(rowFor('appearance.fontScale'))

    fireEvent.change(screen.getByLabelText(/Taille du texte/), { target: { value: '9' } })

    // The range input clamps on its own; what this pins is that the bounds it clamps to are
    // the registry's, and therefore the same ones the main process enforces.
    expect(written).toEqual([['appearance.fontScale', 1.4]])
  })

  it('shows the theme accent while none is set, rather than a colour nobody chose', () => {
    document.documentElement.style.setProperty('--color-accent', '#3574f0')
    render(rowFor('appearance.accent'))

    expect(screen.getByLabelText(/Couleur d’accent/)).toHaveValue('#3574f0')
  })

  it('offers a picker beside a path, and keeps the field writable for a pasted one', () => {
    render(rowFor('media.ffmpegPath'))

    expect(screen.getByRole('button', { name: 'Parcourir…' })).toBeInTheDocument()
    expect(screen.getByLabelText(/Chemin de ffmpeg/)).toBeEnabled()
  })
})

describe('a setting that depends on another', () => {
  beforeEach(() => {
    useSettings.setState({ settings: DEFAULT_SETTINGS })
    resetDraft()
  })

  it('is live while its condition holds', () => {
    render(rowFor('three.gridSize'))

    expect(screen.getByLabelText(/Taille de la grille/)).toBeEnabled()
  })

  it('says why it is inert, rather than being a dead end', () => {
    useSettings.setState({
      settings: { ...DEFAULT_SETTINGS, three: { ...DEFAULT_SETTINGS.three, showGrid: false } },
    })
    render(rowFor('three.gridSize'))

    expect(screen.getByText(/Afficher la grille/)).toBeInTheDocument()
  })

  // Turning the grid off must grey its size at once, not once the change has been applied.
  it('follows the buffer, not only what is stored', () => {
    render(rowFor('three.gridSize'))
    act(() => {
      useSettingsDraft.getState().stage('three.showGrid', false)
    })

    expect(screen.getByText(/Afficher la grille/)).toBeInTheDocument()
  })
})
