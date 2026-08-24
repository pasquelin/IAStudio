import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AiOverview, ModelCandidate, RoleRow } from '@shared/domain/aiOverview'
import { aiRoleId, ASSISTANT_ROLE } from '@shared/domain/aiRole'
import { GIBI, localModel } from '@shared/domain/localModel-fixtures'
import { NO_BREAK_SPACE } from '@shared/i18n/typography'
import { installFakeBridge } from '@/services/fakeBridge'
import { useAiModels } from '@/stores/aiModels'
import { settleHome } from '../../home-fixtures'
import { ModelInventory } from './ModelInventory'

const candidate = (over: Partial<ModelCandidate> = {}): ModelCandidate => ({
  model: localModel(),
  installed: true,
  loaded: false,
  holdable: true,
  unverified: false,
  supplied: false,
  serves: 1,
  fit: 'compatible',
  obstacle: null,
  ...over,
})

const row = (over: Partial<RoleRow> = {}): RoleRow => ({
  role: aiRoleId('image', 'txt2img'),
  provider: null,
  chosen: { app: null, project: null },
  candidates: [],
  clouds: [],
  ...over,
})

const overview = (over: Partial<AiOverview> = {}): AiOverview => ({
  roles: [],
  machine: {
    physicalBytes: 96 * GIBI,
    availableBytes: 34 * GIBI,
    diskFreeBytes: 500 * GIBI,
    gpu: 'ANGLE (Apple, ANGLE Metal Renderer: Apple M2 Max, Version 26.5.2 (Build 25F84))',
    vram: null,
  },
  projectPath: null,
  installing: null,
  loading: null,
  loadFailure: null,
  installFailure: null,
  ollama: { ready: false, installed: false, names: [], progress: null, failed: false },
  ...over,
})

function show(one: AiOverview = overview()) {
  const open = vi.fn(() => Promise.resolve())
  installFakeBridge({ settings: { open } })
  useAiModels.setState({ overview: one })
  render(<ModelInventory />)

  return { open }
}

beforeEach(() => {
  settleHome()
  useAiModels.setState({ overview: null })
})

describe('the models band', () => {
  it('says it is reading rather than announcing an empty machine it has not seen', () => {
    installFakeBridge({})
    render(<ModelInventory />)

    expect(screen.getByText('Lecture de la machine…')).toBeInTheDocument()
  })

  it('states what the machine offers, chip included', () => {
    show()

    // The unit binds to its number with a no-break space, and the chip is the one taken out of
    // what Chromium answers rather than the driver build that came with it.
    expect(screen.getByText(/Apple M2 Max/).textContent).toBe(
      `34${NO_BREAK_SPACE}Gio libres sur 96${NO_BREAK_SPACE}Gio · Apple M2 Max · 500${NO_BREAK_SPACE}Gio sur le disque`,
    )
  })

  it('counts what is installed and what it weighs', () => {
    show(
      overview({
        roles: [
          row({
            candidates: [
              candidate({ model: localModel({ id: 'a', diskBytes: 2 * GIBI }), loaded: true }),
              candidate({ model: localModel({ id: 'b' }), installed: false }),
            ],
          }),
        ],
      }),
    )

    // Read off the card rather than off the page: the machine line above it ends in the same
    // three words, and a query over the whole band would answer with either.
    const card = screen.getByRole('button', { name: /Sur cet ordinateur/ })

    expect(card).toHaveTextContent('1 modèle installé')
    // A normal space, not the binding one the value actually carries: `toHaveTextContent`
    // normalises what it READ and not what it was given.
    expect(card).toHaveTextContent('2,0 Gio sur le disque')
    expect(card).toHaveTextContent('1 chargé en mémoire')
    expect(card).toHaveTextContent('1 au catalogue, à installer')
  })

  /**
   * The band exists to be read on a machine that has nothing yet: saying so is half of what it
   * is for, and it is exactly the state a key would have hidden on the feed this replaces.
   */
  it('says a bare machine is bare, rather than drawing nothing', () => {
    show()

    expect(screen.getByText('Aucun modèle installé')).toBeInTheDocument()
    expect(screen.getByText('Aucune clé API')).toBeInTheDocument()
    expect(screen.getByText('Pas sur cet ordinateur')).toBeInTheDocument()
  })

  it('names the clouds an account was entered for', () => {
    show(overview({ roles: [row({ clouds: ['scenario', 'anthropic'] })] }))

    expect(screen.getByText('2 comptes connectés')).toBeInTheDocument()
    expect(screen.getByText('Scenario · Claude')).toBeInTheDocument()
  })

  it('names what serves an employment no family shares', () => {
    show(
      overview({
        roles: [
          row({ role: ASSISTANT_ROLE, provider: { kind: 'cloud', providerId: 'anthropic' } }),
        ],
      }),
    )

    expect(screen.getByRole('button', { name: /Assistant/ })).toBeInTheDocument()
    expect(screen.getByText('Claude')).toBeInTheDocument()
  })

  it('tallies a family rather than naming one of its employments', () => {
    show(
      overview({
        roles: [
          row({
            role: aiRoleId('image', 'txt2img'),
            provider: { kind: 'cloud', providerId: 'scenario' },
          }),
          row({ role: aiRoleId('image', 'inpaint') }),
        ],
      }),
    )

    expect(screen.getByText('1 emploi servi sur 2')).toBeInTheDocument()
  })

  it('opens the settings on the screen that chooses for the family clicked', async () => {
    const { open } = show(overview({ roles: [row({ role: aiRoleId('video', 'txt2video') })] }))

    await userEvent.click(screen.getByRole('button', { name: /Vidéo/ }))

    // Awaited: the registry that names the screen rides in the settings window's own chunk, and
    // is fetched by the click rather than by the render.
    await waitFor(() => expect(open).toHaveBeenCalledWith('ai.video'))
  })

  it('sends the cloud card to the account screen, where the keys are', async () => {
    const { open } = show()

    await userEvent.click(screen.getByRole('button', { name: /En ligne/ }))

    expect(open).toHaveBeenCalledWith('account')
  })

  /**
   * 🛑 The band informs and leads; it never installs. A second place a download can start from is
   * a second progress bar with nothing saying which of the two is running — ADR-23.
   */
  it('offers no gesture that would install, remove or load anything', () => {
    show(overview({ roles: [row({ candidates: [candidate({ installed: false })] })] }))

    for (const word of [/Installer/, /Supprimer/, /Charger/]) {
      expect(screen.queryByRole('button', { name: word })).not.toBeInTheDocument()
    }
  })
})
