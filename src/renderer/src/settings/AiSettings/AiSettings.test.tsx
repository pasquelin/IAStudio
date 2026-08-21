import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AiOverview, ModelCandidate, RoleRow } from '@shared/domain/aiOverview'
import { aiRoleId, DICTATION_ROLE } from '@shared/domain/aiRole'
import { GIBI, localModel } from '@shared/domain/localModel-fixtures'
import { installFakeBridge } from '@/services/fakeBridge'
import { useAiModels } from '@/stores/aiModels'
import { AiSettings } from './AiSettings'

const PARAKEET: ModelCandidate = {
  model: localModel(),
  installed: true,
  fit: 'compatible',
  obstacle: null,
}

const HUGE: ModelCandidate = {
  model: localModel({ id: 'hidream', name: 'HiDream', reservationBytes: 48 * GIBI }),
  installed: false,
  fit: 'insufficient-memory',
  obstacle: 'memory',
}

const row = (over: Partial<RoleRow> = {}): RoleRow => ({
  role: DICTATION_ROLE,
  provider: { kind: 'local', modelId: 'parakeet' },
  chosen: { app: null, project: null },
  candidates: [PARAKEET, HUGE],
  clouds: [],
  ...over,
})

const overview = (over: Partial<AiOverview> = {}): AiOverview => ({
  roles: [row()],
  machine: {
    physicalBytes: 96 * GIBI,
    availableBytes: 34 * GIBI,
    diskFreeBytes: 500 * GIBI,
    gpu: 'Apple M2 Max',
  },
  projectPath: null,
  installing: null,
  ...over,
})

const show = (one: AiOverview = overview()) => {
  useAiModels.setState({ overview: one })
  render(<AiSettings />)
}

describe('AiSettings', () => {
  beforeEach(() => {
    installFakeBridge({})
    useAiModels.setState({ overview: null })
  })

  it('says nothing about the machine before the main process has answered', () => {
    render(<AiSettings />)

    expect(screen.getByText(/Lecture de la machine/)).toBeInTheDocument()
  })

  // One line per EMPLOYMENT, never one per model: the screen answers "what serves dictation",
  // which is the question somebody opens it with.
  it('shows one line per employment, with what serves it', () => {
    show(overview({ roles: [row(), row({ role: aiRoleId('image', 'inpaint'), candidates: [] })] }))

    expect(screen.getByText('Dictée')).toBeInTheDocument()
    expect(screen.getByText('Image · Retouche interne')).toBeInTheDocument()
    expect(screen.getAllByText(/Parakeet/).length).toBeGreaterThan(0)
  })

  /**
   * Nothing is hidden and everything is explained: a model the machine cannot take stays on
   * screen, unpickable, carrying the figures that say why.
   */
  it('keeps a model too heavy visible, greyed, with its reason', () => {
    show()

    const radio = screen.getByRole('radio', { name: /HiDream/ })
    expect(radio).toBeDisabled()
    // The figures, not only the word: "too heavy" without a number cannot be acted on.
    expect(screen.getByText(/place insuffisante — 48/)).toBeInTheDocument()
  })

  it('writes the choice for the role the candidate belongs to', () => {
    const choose = vi.fn(() => Promise.resolve(overview()))
    installFakeBridge({ ai: { choose } })
    show()

    fireEvent.click(screen.getByRole('radio', { name: /Parakeet/ }))

    expect(choose).toHaveBeenCalledWith(
      DICTATION_ROLE,
      { kind: 'local', modelId: 'parakeet' },
      'app',
    )
  })

  // Through the manager, so a download begun here and one begun elsewhere cannot compete for the
  // same files: the manager holds the only install lock.
  it('installs a candidate through the manager', () => {
    const install = vi.fn(() => Promise.resolve(overview()))
    installFakeBridge({ ai: { install } })
    show(overview({ roles: [row({ candidates: [{ ...PARAKEET, installed: false }] })] }))

    fireEvent.click(screen.getByRole('button', { name: 'Installer' }))

    expect(install).toHaveBeenCalledWith('parakeet')
  })

  // The default that works has to be reachable again: without it, a choice made once could never
  // be given back to the studio.
  it('offers a way back to the automatic choice', () => {
    const choose = vi.fn(() => Promise.resolve(overview()))
    installFakeBridge({ ai: { choose } })
    show(
      overview({
        roles: [row({ chosen: { app: { kind: 'local', modelId: 'parakeet' }, project: null } })],
      }),
    )

    fireEvent.click(screen.getByRole('radio', { name: /Automatique/ }))

    expect(choose).toHaveBeenCalledWith(DICTATION_ROLE, null, 'app')
  })

  // A scope with nothing to scope to would be a control that answers a question nobody asked.
  it('does not ask where a choice lands while no project is open', () => {
    show(overview({ projectPath: null }))

    expect(screen.queryByText(/Ces choix valent pour/)).not.toBeInTheDocument()
  })

  it('asks where a choice lands once a project is open', () => {
    show(overview({ projectPath: '/work/here' }))

    expect(screen.getByText(/Ces choix valent pour/)).toBeInTheDocument()
  })
})
