import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { aiOverview, roleRow } from '@shared/domain/aiOverview-fixtures'
import type { RoleRow } from '@shared/domain/aiOverview'
import { ASSISTANT_ROLE } from '@shared/domain/aiRole'
import { localModel } from '@shared/domain/localModel-fixtures'
import { DEFAULT_SETTINGS } from '@shared/domain/settings'
import { installFakeBridge } from '@/services/fakeBridge'
import { useAiModels } from '@/stores/aiModels'
import { useSettings } from '@/stores/settings'
import { AssistantConversationPicker } from './AssistantConversationPicker'

const assistant = (over: Partial<RoleRow> = {}): RoleRow =>
  roleRow({
    role: ASSISTANT_ROLE,
    provider: { kind: 'cloud', providerId: 'deepseek' },
    chosen: { app: { kind: 'cloud', providerId: 'deepseek' }, project: null },
    candidates: [
      {
        model: localModel({ id: 'qwen2.5', name: 'Qwen 2.5' }),
        installed: true,
        loaded: false,
        holdable: true,
        unverified: false,
        supplied: false,
        serves: 1,
        fit: 'compatible',
        obstacle: null,
      },
    ],
    clouds: ['scenario', 'deepseek'],
    ...over,
  })

const show = (row: RoleRow = assistant()) => {
  useAiModels.setState({ overview: aiOverview({ roles: [row] }) })
  render(<AssistantConversationPicker />)
}

describe('the assistant picker', () => {
  beforeEach(() => {
    installFakeBridge()
    useSettings.setState({ settings: DEFAULT_SETTINGS })
    useAiModels.setState({ chooseAiProvider: vi.fn(async () => {}) })
  })

  /**
   * The defect this closed: the modal offered the studio's four whatever served the assistant, so
   * a person holding a DeepSeek key had no gesture that said "talk to DeepSeek".
   */
  it('offers everything that can answer, each under where it runs', () => {
    show()

    expect(screen.getByRole('option', { name: 'Qwen 2.5' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'DeepSeek — deepseek-chat' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /Haiku 4.5/ })).toBeInTheDocument()
    expect(screen.getAllByRole('group').map(one => one.getAttribute('label'))).toEqual([
      'Sur cette machine',
      'Vos clés',
      'Le studio',
    ])
  })

  it('shows what serves the assistant today, rather than a model nobody picked', () => {
    show()

    expect(screen.getByRole('combobox')).toHaveValue('clouds:deepseek')
  })

  it('writes the provider the manager screen writes', async () => {
    const chooseAiProvider = vi.fn(async () => {})
    useAiModels.setState({ chooseAiProvider })
    show()

    await userEvent.selectOptions(screen.getByRole('combobox'), 'machine:qwen2.5')

    expect(chooseAiProvider).toHaveBeenCalledWith(
      ASSISTANT_ROLE,
      { kind: 'local', modelId: 'qwen2.5' },
      'app',
    )
  })

  /** The studio's four differ by price, not by provider: picking one settles both at once. */
  it('writes the model beside the provider for the studio’s own', async () => {
    const write = vi.fn(async () => {})
    const chooseAiProvider = vi.fn(async () => {})
    useSettings.setState({ write })
    useAiModels.setState({ chooseAiProvider })
    show()

    await userEvent.selectOptions(screen.getByRole('combobox'), 'studio:claude-opus-4-8')

    expect(write).toHaveBeenCalledWith({ assistant: { model: 'claude-opus-4-8' } })
    expect(chooseAiProvider).toHaveBeenCalledWith(
      ASSISTANT_ROLE,
      { kind: 'cloud', providerId: 'scenario' },
      'app',
    )
  })

  /** A choice the open project settled is written back there, or the click would change nothing. */
  it('writes where the choice in force was written', async () => {
    const chooseAiProvider = vi.fn(async () => {})
    useAiModels.setState({
      overview: aiOverview({
        projectPath: '/projects/one',
        roles: [
          assistant({ chosen: { app: null, project: { kind: 'cloud', providerId: 'deepseek' } } }),
        ],
      }),
      chooseAiProvider,
    })
    render(<AssistantConversationPicker />)

    await userEvent.selectOptions(screen.getByRole('combobox'), 'machine:qwen2.5')

    expect(chooseAiProvider).toHaveBeenCalledWith(ASSISTANT_ROLE, expect.anything(), 'project')
  })

  /** Nothing held a key and nothing was installed: the field says so rather than naming a model. */
  it('says nothing serves it when nothing does', () => {
    show(assistant({ provider: null, candidates: [], clouds: [] }))

    expect(screen.getByRole('combobox')).toHaveValue('')
    expect(screen.getByRole('option', { name: 'rien de choisi' })).toBeInTheDocument()
  })
  /**
   * `providerFor` keeps an explicit local choice on installed alone, where the list asks the
   * machine as well: a model chosen while the memory was free read « rien de choisi » after a
   * big render, over an assistant that was still answering on it.
   */
  it('keeps naming the model that answers once the machine stops allowing it', () => {
    const row = assistant({ provider: { kind: 'local', modelId: 'qwen2.5' } })
    show({
      ...row,
      candidates: row.candidates.map(one => ({
        ...one,
        fit: 'insufficient-memory',
        obstacle: 'memory',
      })),
    })

    expect(screen.getByRole('combobox')).toHaveValue('machine:qwen2.5')
    expect(screen.getByRole('option', { name: 'Qwen 2.5' })).toBeInTheDocument()
  })
})
