import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AiOverview, ModelCandidate, RoleRow } from '@shared/domain/aiOverview'
import { aiRoleId, ASSISTANT_ROLE } from '@shared/domain/aiRole'
import { GIBI, localModel } from '@shared/domain/localModel-fixtures'
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

/**
 * The block of the means list whose name is `name` — its label, its reading and its button, which
 * now share one group rather than sitting a column apart.
 */
const meansLine = (name: string): HTMLElement =>
  screen.getByText(name).parentElement?.parentElement as HTMLElement

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

    // Plain spaces, where the value carries the binding one: `toHaveTextContent` normalises
    // what it READ and not what it was given. The chip is the one taken out of what Chromium
    // answers, rather than the driver build that came with it.
    expect(meansLine('Machine')).toHaveTextContent(
      'Mémoire vive : 34 Gio libres sur 96 Gio · Puce : Apple M2 Max · Disque : 500 Gio libres',
    )
  })

  it('counts what is installed, what it weighs and what is held in memory', () => {
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

    expect(meansLine('Sur cet ordinateur')).toHaveTextContent(
      '1 modèle installé · 2,0 Gio · 1 chargé en mémoire',
    )
  })

  /**
   * The band exists to be read on a machine that has nothing yet: saying so is half of what it
   * is for, and it is exactly the state a key would have hidden on the feed this replaces.
   */
  it('says a bare machine is bare, rather than drawing nothing', () => {
    show()

    expect(meansLine('Sur cet ordinateur')).toHaveTextContent('Aucun modèle installé')
    expect(meansLine('Ollama')).toHaveTextContent('Pas sur cet ordinateur')
    expect(meansLine('En ligne')).toHaveTextContent('Aucune clé API')
  })

  it('names the clouds an account was entered for', () => {
    show(overview({ roles: [row({ clouds: ['scenario', 'anthropic'] })] }))

    expect(meansLine('En ligne')).toHaveTextContent('Scenario · Claude')
  })

  /**
   * The complaint this layout answers: three cards that were each one big button, two of them
   * opening the same screen, with nothing on any of them saying what a click would do.
   */
  it('gives every line a button that says what it does, and where it leads', async () => {
    const { open } = show()

    await userEvent.click(
      within(meansLine('En ligne')).getByRole('button', { name: 'Ajouter une clé' }),
    )

    expect(open).toHaveBeenCalledWith('account')
  })

  it('offers to install Ollama when it is absent, and to choose once it is there', () => {
    show()
    expect(within(meansLine('Ollama')).getByRole('button')).toHaveTextContent('Installer')
  })

  it('names what serves an employment no family shares', () => {
    show(
      overview({
        roles: [
          row({ role: ASSISTANT_ROLE, provider: { kind: 'cloud', providerId: 'anthropic' } }),
        ],
      }),
    )

    expect(screen.getByRole('button', { name: /Assistant/ })).toHaveTextContent('Claude')
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

    expect(screen.getByRole('button', { name: /Image/ })).toHaveTextContent('1 / 2')
  })

  it('opens the settings on the screen that chooses for the family clicked', async () => {
    const { open } = show(overview({ roles: [row({ role: aiRoleId('video', 'txt2video') })] }))

    await userEvent.click(screen.getByRole('button', { name: /Vidéo/ }))

    // Awaited: the registry that names the screen rides in the settings window's own chunk, and
    // is fetched by the click rather than by the render.
    await waitFor(() => expect(open).toHaveBeenCalledWith('ai.video'))
  })

  /**
   * The reading the manager cannot give at a glance, and the one this band was asked for: one
   * download that answers six employments across two families beats one that answers a single.
   */
  it('ranks the catalogue by what one download covers, families named', () => {
    show(
      overview({
        roles: [
          row({
            role: aiRoleId('image', 'txt2img'),
            candidates: [
              candidate({
                model: localModel({ id: 'ssd', name: 'SSD-1B', diskBytes: 4 * GIBI }),
                installed: false,
                serves: 6,
              }),
            ],
          }),
          row({
            role: aiRoleId('texture', 'txt2img_texture'),
            candidates: [
              candidate({
                model: localModel({ id: 'ssd', name: 'SSD-1B', diskBytes: 4 * GIBI }),
                installed: false,
                serves: 6,
              }),
            ],
          }),
        ],
      }),
    )

    const line = screen.getByText('SSD-1B').parentElement as HTMLElement
    expect(line).toHaveTextContent('Image · Texture')
    expect(line).toHaveTextContent('6 emplois')
  })

  it('advises choosing before installing, since what is on the disk costs nothing', () => {
    show(
      overview({
        roles: [
          row({ candidates: [candidate({ installed: true })], clouds: ['scenario'] }),
          row({
            role: aiRoleId('video', 'txt2video'),
            candidates: [
              candidate({
                model: localModel({ id: 'wide', name: 'Wide' }),
                installed: false,
                serves: 4,
              }),
            ],
          }),
        ],
      }),
    )

    expect(
      screen.getByText('1 emploi a un modèle installé mais personne de choisi.'),
    ).toBeInTheDocument()
  })

  /**
   * The figure a reader needs before any of the detail under it — and it opens the band, where
   * the advice used to close it under three blocks nobody reached.
   */
  it('opens on where the studio stands, before what it holds', () => {
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

    const verdict = screen.getByText('1 emploi servi sur 2')
    const means = screen.getByText('Ce dont vous disposez')

    expect(verdict.compareDocumentPosition(means)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
  })

  /** Read straight on, « Assistant » looked like a seventh workspace. */
  it('rules off the two roles no workspace holds', () => {
    const { open } = show(
      overview({
        roles: [row({ role: aiRoleId('image', 'txt2img') }), row({ role: ASSISTANT_ROLE })],
      }),
    )

    expect(document.querySelectorAll('[aria-hidden="true"].bg-border')).toHaveLength(1)
    expect(open).not.toHaveBeenCalled()
  })

  /**
   * 🛑 The band informs and leads; it never installs. A second place a download can start from is
   * a second progress bar with nothing saying which of the two is running — ADR-23.
   */
  it('offers no gesture that would remove or load anything', () => {
    show(overview({ roles: [row({ candidates: [candidate({ installed: false })] })] }))

    for (const word of [/Supprimer/, /Charger/, /Décharger/]) {
      expect(screen.queryByRole('button', { name: word })).not.toBeInTheDocument()
    }
  })
})
