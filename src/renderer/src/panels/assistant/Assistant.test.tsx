import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { aiOverview, roleRow } from '@shared/domain/aiOverview-fixtures'
import { ASSISTANT_ROLE } from '@shared/domain/aiRole'
import { DEFAULT_SETTINGS } from '@shared/domain/settings'
import { installFakeBridge } from '@/services/fakeBridge'
import { useAiModels } from '@/stores/aiModels'
import { useAssistant } from '@/stores/assistant'
import { useDictation } from '@/stores/dictation'
import { useLayouts } from '@/stores/layouts'
import { useSettings } from '@/stores/settings'
import { useTools } from '@/stores/tools'
import { focusChat } from '@/assistant/chatPanel'
import { mountedDictationTarget } from '@/dictation/destination'
import { Assistant } from './Assistant'

beforeEach(() => {
  useAiModels.setState({
    overview: aiOverview({
      roles: [
        roleRow({ role: ASSISTANT_ROLE, provider: { kind: 'cloud', providerId: 'scenario' } }),
      ],
    }),
  })
  useAssistant.setState({ turns: [], busy: false, asked: null, draft: '', staged: 0 })
  useSettings.setState({ settings: DEFAULT_SETTINGS })
  useDictation.setState({ partial: '', state: 'idle' })
  useLayouts.setState({ activeWorkspace: 'image', home: false })
  useTools.setState({ focusedZone: null })
  installFakeBridge()
})

describe('the assistant as a panel of the right column', () => {
  it('stages the same conversation the empty centre stages', () => {
    render(<Assistant />)

    expect(screen.getByRole('textbox')).toBeInTheDocument()
    expect(useAssistant.getState().staged).toBe(1)
  })

  /**
   * The caret follows the GESTURE, never the layout: ⌘K asks for it and the panel takes it on
   * the frame it mounts. Focused on mount either way, it would swallow every studio shortcut
   * from the first frame of a launch — the column draws this panel untouched.
   */
  it('leaves the caret alone when it is merely what the column draws', () => {
    render(<Assistant />)

    expect(screen.getByRole('textbox')).not.toHaveFocus()
  })

  it('takes the caret when a gesture asked for the conversation first', () => {
    focusChat()
    render(<Assistant />)

    expect(screen.getByRole('textbox')).toHaveFocus()
  })

  /**
   * The claim on the spoken word follows the READER, not the mount: this panel is what an
   * untouched right column draws, so claiming it unconditionally would send every dictation of
   * the studio here — the prompt of a generation included.
   */
  it('leaves the spoken word to the caret until the reader is inside it', async () => {
    render(<Assistant />)
    expect(mountedDictationTarget()).toBeNull()

    await userEvent.click(screen.getByRole('textbox'))

    expect(mountedDictationTarget()).not.toBeNull()
  })

  /**
   * 🛑 A session begun here outlives the caret: one dictates with the hands off the keyboard, so
   * looking at the canvas mid-sentence must not hand the rest of it to whatever is under the
   * pointer — nor stop the microphone.
   */
  it('keeps the spoken word once a session has begun, caret or not', async () => {
    render(<Assistant />)
    await userEvent.click(screen.getByRole('textbox'))
    act(() => useDictation.setState({ state: 'listening' }))

    act(() => screen.getByRole('textbox').blur())

    expect(mountedDictationTarget()).not.toBeNull()
    expect(useDictation.getState().state).toBe('listening')
  })

  it('gives the spoken word back once the reader has left and the microphone is shut', async () => {
    render(<Assistant />)
    await userEvent.click(screen.getByRole('textbox'))

    act(() => screen.getByRole('textbox').blur())

    expect(mountedDictationTarget()).toBeNull()
  })
})
