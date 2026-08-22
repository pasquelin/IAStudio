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
  loaded: false,
  holdable: true,
  unverified: false,
  supplied: false,
  serves: 1,
  fit: 'compatible',
  obstacle: null,
}

const HUGE: ModelCandidate = {
  model: localModel({ id: 'hidream', name: 'HiDream', reservationBytes: 48 * GIBI }),
  installed: false,
  loaded: false,
  holdable: true,
  unverified: false,
  supplied: false,
  serves: 1,
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
    vram: null,
  },
  projectPath: null,
  installing: null,
  loading: null,
  loadFailure: null,
  ollama: { ready: false, installed: false, names: [], progress: null, failed: false },
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
  it('warns that nothing is billed until a provider is chosen', () => {
    show(overview({ roles: [row({ provider: null })] }))

    expect(
      screen.getByText(/Rien n’est facturé tant que vous n’en avez pas validé un/),
    ).toBeInTheDocument()
  })

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

  it('names Ollama on an employment it cannot serve and lists the models it does have', () => {
    show(
      overview({
        ollama: {
          ready: true,
          installed: true,
          names: ['alpha:1', 'beta:2'],
          progress: null,
          failed: false,
        },
        roles: [row({ role: aiRoleId('image', 'txt2img'), candidates: [PARAKEET] })],
      }),
    )

    expect(screen.getByText('Ollama')).toBeInTheDocument()
    expect(screen.getByText(/alpha:1/)).toBeInTheDocument()
    expect(screen.getByText(/emploi qu’ils savent faire/)).toBeInTheDocument()
  })

  it('offers to install Ollama when it is not on this computer', () => {
    const installOllama = vi.fn(() => Promise.resolve(overview()))
    installFakeBridge({ ai: { installOllama } })
    show(
      overview({
        ollama: { ready: false, installed: false, names: [], progress: null, failed: false },
        roles: [row({ role: aiRoleId('image', 'txt2img'), candidates: [PARAKEET] })],
      }),
    )

    expect(screen.getByText(/n’est pas sur cet ordinateur/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Installer Ollama' }))
    expect(installOllama).toHaveBeenCalledOnce()
  })

  it('says the install failed without pretending Ollama is here', () => {
    show(
      overview({
        ollama: { ready: false, installed: false, names: [], progress: null, failed: true },
        roles: [row({ role: aiRoleId('image', 'txt2img'), candidates: [PARAKEET] })],
      }),
    )

    expect(screen.getByText(/n’a pas marché/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Installer Ollama' })).toBeInTheDocument()
  })

  it('groups Ollama models away from the studio catalogue', () => {
    const ollama: ModelCandidate = {
      ...PARAKEET,
      model: localModel({
        id: 'qwen3:8b',
        name: 'qwen3:8b',
        format: 'gguf',
        loader: 'ollama',
        files: [],
      }),
    }
    show(
      overview({
        roles: [row({ candidates: [PARAKEET, ollama], clouds: ['scenario'] })],
      }),
    )

    expect(screen.getByText('Sur cet ordinateur')).toBeInTheDocument()
    expect(screen.getByText('Ollama')).toBeInTheDocument()
    expect(screen.getByText('En ligne')).toBeInTheDocument()
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

  it('offers the publisher card as an outward https link', () => {
    show()

    const card = screen.getAllByRole('link', { name: 'Fiche éditeur' })[0]
    expect(card).toHaveAttribute('href', 'https://example.invalid/model')
    expect(card).toHaveAttribute('target', '_blank')
  })

  it('hides the publisher card when the model has no https page', () => {
    const own = { ...PARAKEET, model: localModel({ source: '' }) }
    show(overview({ roles: [row({ candidates: [own] })] }))

    expect(screen.queryByRole('link', { name: 'Fiche éditeur' })).not.toBeInTheDocument()
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

  // The empty choice has to be reachable again: without it, a choice made once could never
  // be given back, and a billed provider would stay selected.
  it('offers a way back to no provider', () => {
    const choose = vi.fn(() => Promise.resolve(overview()))
    installFakeBridge({ ai: { choose } })
    show(
      overview({
        roles: [row({ chosen: { app: { kind: 'local', modelId: 'parakeet' }, project: null } })],
      }),
    )

    fireEvent.click(screen.getByRole('radio', { name: /Aucun/ }))

    expect(choose).toHaveBeenCalledWith(DICTATION_ROLE, null, 'app')
  })

  /**
   * "Activate" means RESIDENT, never hidden — ADR-21 § D. The two gestures are about MEMORY, and
   * they sit beside the pair that is about the disk: a model can be installed and idle.
   */
  it('offers to hold an installed model in memory', () => {
    const load = vi.fn(() => Promise.resolve(overview()))
    installFakeBridge({ ai: { load } })
    show()

    fireEvent.click(screen.getByRole('button', { name: 'Charger' }))

    expect(load).toHaveBeenCalledWith('parakeet')
  })

  // The same button, the other way round: what is resident is what can be given back.
  it('offers to give the memory back once a model is resident', () => {
    const unload = vi.fn(() => Promise.resolve(overview()))
    installFakeBridge({ ai: { unload } })
    show(overview({ roles: [row({ candidates: [{ ...PARAKEET, loaded: true }] })] }))

    fireEvent.click(screen.getByRole('button', { name: 'Décharger' }))

    expect(unload).toHaveBeenCalledWith('parakeet')
  })

  /**
   * 🛑 A failure the person can act on: the two figures the admission weighed, said in words —
   * never a freeze, and never a stack trace.
   */
  it('says what a load asked for and what was left when it could not happen', () => {
    show(
      overview({
        loadFailure: {
          reason: 'beyond-machine',
          modelId: 'parakeet',
          neededBytes: 8 * GIBI,
          availableBytes: 3 * GIBI,
        },
      }),
    )

    expect(screen.getByRole('status')).toHaveTextContent(/8,0 Gio.*3,0 Gio/)
  })

  // Their file, their disk: the word differs from "Supprimer" because the gesture does.
  it('offers to forget a supplied model rather than to delete it, and says it is unvouched for', () => {
    const supplied = { ...PARAKEET, unverified: true, supplied: true }
    show(overview({ roles: [row({ candidates: [supplied] })] }))

    expect(screen.getByRole('button', { name: 'Retirer' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Supprimer' })).not.toBeInTheDocument()
    expect(screen.getByText(/provenance non vérifiée/)).toBeInTheDocument()
  })

  /**
   * Rank 3 of ADR-20: the gesture is theirs, and so is its refusal — the studio cannot word a
   * failure about a file it never saw anywhere but in the window that asked.
   */
  it('asks the main process for a weights file, and says when it cannot read one', async () => {
    const addOwnModel = vi.fn(() => Promise.reject(new Error('not a GGUF')))
    installFakeBridge({ ai: { addOwnModel } })
    show()

    fireEvent.click(screen.getByRole('button', { name: 'Ajouter un fichier…' }))

    expect(addOwnModel).toHaveBeenCalledOnce()
    expect(await screen.findByText(/n’est pas un modèle/)).toBeInTheDocument()
  })

  /**
   * 🛑 An employment with no local candidate shows the clouds and nothing else, and silence there
   * reads as a screen that is broken. What is missing is a MANIFEST and no longer an engine: the
   * engine serves five modalities, and the catalogue is what has nothing to offer for this one.
   */
  it('says why an employment offers no local model rather than leaving a gap', () => {
    show(overview({ roles: [row({ candidates: [], clouds: ['scenario'] })] }))

    expect(screen.getByText(/le catalogue n’en propose aucun/)).toBeInTheDocument()
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

describe('a summary written before a field existed', () => {
  /**
   * 🛑 Measured on screen: `AiSettings: Cannot read properties of undefined (reading
   * 'totalBytes')`, and the whole panel went with it. The type says `vram: … | null`, but this
   * crosses IPC — a summary that simply has no key is not `null`, and `=== null` let it through.
   */
  it('draws the machine even when a figure it expected is absent', () => {
    const machine = { physicalBytes: GIBI, availableBytes: GIBI, diskFreeBytes: GIBI, gpu: null }
    // Cast: the point is exactly a payload the type says cannot arrive, and does.
    show(overview({ machine: machine as AiOverview['machine'] }))

    expect(screen.getByText(/libres sur/)).toBeInTheDocument()
  })
})
