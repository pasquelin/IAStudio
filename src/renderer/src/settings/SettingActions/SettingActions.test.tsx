import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SettingActionId } from '@shared/domain/settingsRegistry'
import { installFakeBridge } from '@/services/fakeBridge'
import { useSettingsDraft } from '@/stores/settingsDraft'
import { SettingActions } from './SettingActions'

const realConfirm = window.confirm

function answerConfirm(answer: boolean): void {
  window.confirm = () => answer
}

beforeEach(() => {
  useSettingsDraft.setState({ pending: {}, touched: new Set() })
})

afterEach(() => {
  window.confirm = realConfirm
})

describe('the buttons of a section', () => {
  it('runs an action that needs no confirming', async () => {
    const runAction = vi.fn((_id: SettingActionId) => Promise.resolve())
    installFakeBridge({ settings: { runAction } })
    render(<SettingActions section="advanced" />)

    await userEvent.click(screen.getByRole('button', { name: 'Afficher dans le dossier' }))

    expect(runAction).toHaveBeenCalledWith('advanced.openSettingsFile')
  })

  // No Cancel covers these: they never pass through the editing buffer.
  it('asks before an action that cannot be taken back', async () => {
    const runAction = vi.fn((_id: SettingActionId) => Promise.resolve())
    installFakeBridge({ settings: { runAction } })
    answerConfirm(false)
    render(<SettingActions section="advanced" />)

    await userEvent.click(screen.getByRole('button', { name: 'Réinitialiser' }))

    expect(runAction).not.toHaveBeenCalled()
  })

  it('runs it once the question is answered', async () => {
    const runAction = vi.fn((_id: SettingActionId) => Promise.resolve())
    installFakeBridge({ settings: { runAction } })
    answerConfirm(true)
    render(<SettingActions section="advanced" />)

    await userEvent.click(screen.getByRole('button', { name: 'Réinitialiser' }))

    expect(runAction).toHaveBeenCalledWith('advanced.reset')
  })

  it('drops the buffer on a reset, which would otherwise write back over it', async () => {
    installFakeBridge()
    answerConfirm(true)
    useSettingsDraft.getState().stage('appearance.density', 'compact')
    render(<SettingActions section="advanced" />)

    await userEvent.click(screen.getByRole('button', { name: 'Réinitialiser' }))

    expect(useSettingsDraft.getState().touched.size).toBe(0)
  })

  it('shows nothing for a section that has no buttons', () => {
    installFakeBridge()
    const { container } = render(<SettingActions section="appearance" />)

    expect(container).toBeEmptyDOMElement()
  })
})
