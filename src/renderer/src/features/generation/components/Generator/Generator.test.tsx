import { act, render, screen } from '@testing-library/react'
import { SCENARIO_CLOUD } from '@shared/domain/aiCloud'
import { LOCAL_RUNTIME } from '@shared/domain/model'
import { aiRoleId } from '@shared/domain/aiRole'
import { localModel } from '@shared/domain/localModel-fixtures'
import type { AiOverview } from '@shared/domain/aiOverview'
import { useAiModels } from '@/stores/aiModels'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { FieldDescriptor, ModelDescriptor, ModelSummary } from '@shared/domain/model'
import type { Job } from '@shared/domain/job'
import type { StudioBridge } from '@shared/ipc'
import { withQueries } from '@/features/shell/components/query-fixtures'
import { installFakeBridge } from '@/services/fakeBridge'
import { installCanvas } from '@/stores/canvas-fixtures'
import { useCode, scriptRefAt } from '@/stores/code'
import { installDocument } from '@/stores/document-fixtures'
import { useDocuments } from '@/stores/documents'
import { useLayouts } from '@/stores/layouts'
import { useGeneration } from '@/stores/generation'
import { useModels } from '@/stores/models'
import { job } from '@/stores/job-fixtures'
import { useJobs } from '@/stores/jobs'
import type { Asset } from '@shared/domain/asset'
import { useAssets } from '@/stores/assets'
import { useProject } from '@/stores/project'
import { selectedFilePaths, useSelection } from '@/stores/selection'
import { connectPreparation } from '@/stores/preparation'
import { DEFAULT_SETTINGS } from '@shared/domain/settings'
import { useSettings } from '@/stores/settings'
import { useAccounts } from '@/stores/accounts'
import { TRIPO_CLOUD } from '@shared/domain/tripo'
import { chooseModels } from '@/stores/models-fixtures'
import { chassisFor } from '@/stores/panels-fixtures'
import { prepareEdit } from '@/features/image/aiActions'
import panelSource from './Generator.tsx?raw'
import { Generator } from './Generator'

const DOCUMENT = 'doc-1'

const PICTURE: FieldDescriptor = { key: 'image', kind: 'image', label: 'Image', required: true }

const DESCRIPTORS: Record<string, ModelDescriptor> = {
  model_flux: descriptor('model_flux', 'Flux', 'image'),
  model_big: descriptor('model_big', 'Magnific Upscaler', 'upscale'),
  'ssd-1b': {
    ...descriptor('ssd-1b', 'SSD-1B', 'image'),
    runsOn: LOCAL_RUNTIME,
  },
  model_code: {
    ...descriptor('model_code', 'Sonnet', 'code'),
    capabilities: ['txt2code', 'code2code'],
    fields: [{ key: 'prompt', kind: 'text', label: 'Prompt', required: true }],
  },
}

function descriptor(id: string, name: string, family: ModelDescriptor['family']): ModelDescriptor {
  return {
    id,
    name,
    family,
    runsOn: SCENARIO_CLOUD,
    source: 'scenario',
    origin: 'official',
    featured: false,
    capabilities: ['img2img'],
    tags: [],
    fields: [PICTURE],
  }
}

/** The engine, reduced to what an edit asks of it: a flattened picture and no mask. */
const host = {
  snapshot: () => Promise.resolve('FLAT'),
  maskSnapshot: () => Promise.resolve(null),
}

function renderPanel() {
  return render(withQueries(<Generator />))
}

/** A picture picked in the explorer — the one source this panel can attach on its own. */
const PICTURE_PATH = 'Images/concept.png'

const PICKED: Asset = {
  id: 'asset-picked',
  name: 'concept',
  type: 'image',
  location: 'local',
  path: PICTURE_PATH,
  createdAt: '2026-08-23T00:00:00.000Z',
  tags: [],
}

function selectPicture(): void {
  useAssets.setState({ items: [PICKED] })
  useSelection.getState().selectFiles([PICTURE_PATH])
}

/** A row the picker can list, for the state where the catalogue holds one and none is chosen. */
const OFFERED: ModelSummary = {
  id: 'model_offered',
  name: 'Offered',
  family: 'image',
  runsOn: SCENARIO_CLOUD,
  source: 'scenario',
  origin: 'official',
  featured: false,
  capabilities: [],
  tags: [],
}

const PROJECT = {
  path: '/projects/demo',
  manifest: { version: 1, createdAt: '', updatedAt: '' },
}

describe('Generator', () => {
  let bridge: StudioBridge

  beforeEach(() => {
    installCanvas(DOCUMENT)
    useSettings.setState({
      auth: { authenticated: true },
      // A canvas is open in every case below, so the question would stand in front of the form.
      // The one case that is ABOUT the question sets `ask` itself.
      settings: {
        ...DEFAULT_SETTINGS,
        generation: { ...DEFAULT_SETTINGS.generation, landing: 'document' },
      },
    })
    useAiModels.setState({ overview: null })
    // A job collects into its own project and nowhere else, so the panel asks for one before it
    // draws a form. Every case below is about the form, and each of them needs one.
    useProject.setState({ project: PROJECT, known: true })
    chassisFor('image')
    useLayouts.setState({ activeWorkspace: 'image' })
    useGeneration.setState({ forcedCapability: null })
    useAssets.setState({ items: [] })
    useSelection.getState().selectFiles([])
    // Both image employments, because a canvas is open above: the panel reads that as working
    // FROM the picture, and only the employment it settles on decides which model runs.
    chooseModels({
      [aiRoleId('image', 'txt2img')]: 'model_flux',
      [aiRoleId('image', 'img2img')]: 'model_flux',
      [aiRoleId('video', 'txt2video')]: 'model_flux',
      [aiRoleId('video', 'img2video')]: 'model_flux',
      [aiRoleId('upscale', 'upscale')]: 'model_big',
    })

    bridge = installFakeBridge({
      // The panel resolves a picked PATH against the catalogue — see `useGenerationContext`.
      assets: { search: async () => [PICKED] },
      provider: {
        describeModel: (modelId: string) =>
          DESCRIPTORS[modelId]
            ? Promise.resolve(DESCRIPTORS[modelId])
            : Promise.reject(new Error('no model')),
        uploadAsset: (_name: string, image: string) =>
          Promise.resolve(`asset-${image.toLowerCase()}`),
      },
    })
  })

  it('opens on the model the detected operation is served by', async () => {
    renderPanel()

    expect(await screen.findByText('Flux')).toBeInTheDocument()
  })

  /**
   * The operation follows what is at hand, and nobody has to know the word for it is `img2img`.
   * The picture is SELECTED: what the panel can send is what the catalogue holds a row for.
   */
  it('reads a selected picture as the operation to run, and says which', async () => {
    selectPicture()
    renderPanel()

    await screen.findByText('Flux')
    expect(screen.getByLabelText('Opération')).toHaveValue('image/img2img')
  })

  /**
   * 🛑 The sources are drawn AND sent: they decide which operation runs, so drawing one the
   * request never carries would switch the model under the person and leave the picture behind.
   */
  it('opens the form on the picture it says it is working from', async () => {
    selectPicture()
    chooseModels({ [aiRoleId('image', 'img2img')]: 'model_flux' })
    renderPanel()

    expect(await screen.findByLabelText(/Image/)).toHaveValue('asset-picked')
  })

  /**
   * § 20: a model that serves no employment used to draw nothing at all — the rail dropped the
   * generator's icon and the panel returned null. The operation stays on screen, so another can
   * be picked without leaving.
   */
  it('says an operation has no model rather than drawing an empty panel', async () => {
    selectPicture()
    chooseModels({ [aiRoleId('image', 'txt2img')]: 'model_flux' })
    renderPanel()

    expect(await screen.findByText('Aucun modèle ne sert cette opération.')).toBeVisible()
    expect(screen.getByLabelText('Opération')).toBeInTheDocument()
  })

  /**
   * The two states wore ONE sentence, and it was the wrong one on the commoner of them: "no model
   * available for this operation" was painted over a picker listing a dozen, because what it
   * really meant was that none had been chosen yet.
   */
  it('tells having no model to choose from apart from having chosen none', async () => {
    selectPicture()
    chooseModels({})
    installFakeBridge({
      provider: {
        searchModels: () => Promise.resolve({ items: [OFFERED], cursor: null }),
      },
    })
    renderPanel()

    expect(await screen.findByText('Choisissez un modèle pour continuer.')).toBeVisible()
  })

  /**
   * The shelf it was picked in can be a closed panel, so the line saying what will be sent is the
   * only place the source exists — and it stayed there through a document being closed, with
   * nothing on screen to say where it came from or how to be rid of it.
   */
  it('takes a source off by deselecting it where it was picked', async () => {
    selectPicture()
    renderPanel()

    await screen.findByText('Sélectionné dans l’explorateur')
    await userEvent.click(screen.getByRole('button', { name: 'Retirer cette source' }))

    expect(selectedFilePaths(useSelection.getState())).toEqual([])
    expect(screen.queryByText('concept.png')).not.toBeInTheDocument()
  })

  /**
   * 🛑 The half a deselection does not do on its own. `defaultValues` carries what the previous
   * descriptor held, and a preset that merely stops naming the field lets the withdrawn id back
   * in as if it had been typed — the panel then drew one answer to "what is sent" and the form
   * below it drew another, which is the silent generation the sources list exists to prevent.
   */
  it('takes the withdrawn source out of the form, not only out of the list', async () => {
    selectPicture()
    renderPanel()

    expect(await screen.findByLabelText(/Image/)).toHaveValue('asset-picked')
    await userEvent.click(screen.getByRole('button', { name: 'Retirer cette source' }))

    expect(screen.getByLabelText(/Image/)).toHaveValue('')
  })

  /**
   * The whole point of the edit: Enlarge asks for an upscaler, which is another family than the
   * workspace's. Reading the workspace family alone left the panel on the image model, so the
   * form showed neither the right parameters nor the picture that had just been uploaded — and
   * Generate would have run Flux on it.
   */
  it('opens on the model an edit prepared, not on the one the workspace holds', async () => {
    await prepareEdit(DOCUMENT, 'enlarge', host, bridge.provider)
    renderPanel()

    expect(await screen.findByText('Magnific Upscaler')).toBeInTheDocument()
    expect(screen.queryByText('Flux')).not.toBeInTheDocument()
  })

  // A preparation is a parenthesis: leaving the space closes it, and the panel comes back to the
  // family of wherever the user now is. `connectPreparation` is what the application branches.
  it('comes back to the workspace family once the preparation is closed', async () => {
    const stop = connectPreparation()
    await prepareEdit(DOCUMENT, 'enlarge', host, bridge.provider)

    useLayouts.setState({ activeWorkspace: 'video' })
    renderPanel()

    expect(await screen.findByText('Flux')).toBeInTheDocument()
    stop()
  })

  /**
   * Picking the operation by hand is taking the generator back from whatever prepared it — the
   * gesture the Models panel used to carry, now one control away from the form it changes.
   */
  it('drops the preparation once another operation is picked', async () => {
    await prepareEdit(DOCUMENT, 'enlarge', host, bridge.provider)

    useGeneration.getState().forceCapability(aiRoleId('image', 'txt2img'))
    renderPanel()

    expect(await screen.findByText('Flux')).toBeInTheDocument()
  })

  /**
   * The form pulls zod, react-hook-form and its resolver — 219,6 kB of the opening chunk on
   * 8 August, 223 000 in its own chunk on 10 August. Nothing but a deferred import keeps them
   * out, and nothing but this says so.
   *
   * The `lazy` itself moved to `components/dynamicFormLazy`, which three panels had each written
   * for themselves; that module's only export is the `lazy`, so importing IT statically pulls
   * nothing. What must never appear here is the form's own module, under any form of import —
   * which is wider than the `^import { DynamicForm }` this line used to match.
   */
  it('never imports the form at module scope', () => {
    expect(panelSource).not.toMatch(/from '@\/components\/DynamicForm'/)
    // Both halves: an import removed without the deferred one put back would leave the panel
    // with no form at all, and the line above would still pass.
    expect(panelSource).toMatch(/from '@\/components\/dynamicFormLazy'/)
  })

  /**
   * Asserted on the source for the same reason as the import above: the note only appears after
   * a debounced dry run. Where the figure is FORMATTED moved to the hook this form reads it
   * from — `useCostEstimate.test.ts` holds that half.
   */
  it('draws whatever the cost watch says, and formats nothing itself', () => {
    expect(panelSource).toMatch(/submitNote=\{cost\.note\}/)
    expect(panelSource).not.toMatch(/formatUnits/)
  })

  /**
   * The last door before the spend. Five ways of arming a model never open the picker — a stored
   * default, "recreate", "regenerate with these parameters", a Spark idea, the canvas edits — so
   * greying the picker alone would leave every one of them to discover the 403.
   */
  describe('a model the plan does not cover', () => {
    // A project of its own: `busy` is also raised by its absence, and without one these cases
    // would pass on the wrong reason — a disabled button proving nothing about the plan.
    beforeEach(() => {
      useProject.setState({
        project: {
          path: '/projects/Summer',
          manifest: {
            version: 1,
            createdAt: '2026-01-01T00:00:00Z',
            updatedAt: '2026-01-01T00:00:00Z',
          },
        },
        known: true,
      })

      installFakeBridge({
        provider: {
          describeModel: () =>
            Promise.resolve({
              ...descriptor('model_flux', 'Flux', 'image'),
              requiredPlanLevel: 50,
            }),
          plan: () => Promise.resolve({ name: 'cu-basic', level: 25 }),
        },
      })
    })

    it('refuses to generate with it', async () => {
      renderPanel()

      expect(await screen.findByRole('button', { name: 'Générer' })).toBeDisabled()
    })

    it('says why, naming the plan, rather than leaving a dead button', async () => {
      renderPanel()

      expect(await screen.findByText(/cu-basic/)).toBeInTheDocument()
    })

    // Being wrong here blocks a model the user is paying for, so an unread plan refuses nothing.
    it('generates as before when the plan cannot be read', async () => {
      installFakeBridge({
        provider: {
          describeModel: () =>
            Promise.resolve({
              ...descriptor('model_flux', 'Flux', 'image'),
              requiredPlanLevel: 50,
            }),
          plan: () => Promise.resolve(null),
        },
      })
      renderPanel()

      expect(await screen.findByRole('button', { name: 'Générer' })).toBeEnabled()
    })
  })
})

/**
 * Decided with the user: the generator REQUIRES a project. A job collects into its own project
 * and nowhere else, so generating without one produces assets that land nowhere — the panel
 * used to draw the whole form with a dead button and one muted line to say why.
 */
describe('the generator without a project', () => {
  beforeEach(() => {
    installCanvas(DOCUMENT)
    useSettings.setState({ auth: { authenticated: true } })
    chassisFor('image')
    useLayouts.setState({ activeWorkspace: 'image' })
    chooseModels({
      [aiRoleId('image', 'txt2img')]: 'model_flux',
      [aiRoleId('image', 'img2img')]: 'model_flux',
      [aiRoleId('video', 'txt2video')]: 'model_flux',
      [aiRoleId('video', 'img2video')]: 'model_flux',
      [aiRoleId('upscale', 'upscale')]: 'model_big',
    })
    installFakeBridge({})
  })

  it('asks for one rather than drawing a form nothing can submit', async () => {
    useProject.setState({ project: null, known: true })

    renderPanel()

    expect(await screen.findByText(/Ouvrez un projet pour générer/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Générer/ })).toBeNull()
  })

  it('offers both ways to get one', () => {
    useProject.setState({ project: null, known: true })

    renderPanel()

    expect(screen.getByRole('button', { name: 'Ouvrir un projet' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Créer un projet' })).toBeInTheDocument()
  })

  // The studio reopens the last project on launch: taking the first `null` for an answer offers
  // to create a project to someone who already has one, for as long as the reopening takes.
  it('offers nothing before the main process has said whether there is one', () => {
    useProject.setState({ project: null, known: false })

    renderPanel()

    expect(screen.queryByRole('button', { name: 'Créer un projet' })).toBeNull()
  })

  // A cloud model still needs a key. A model of this machine must not.
  it('asks for the credentials before the project', () => {
    useSettings.setState({ auth: { authenticated: false, reason: 'missing' } })
    useProject.setState({ project: null, known: true })

    renderPanel()

    expect(screen.queryByRole('button', { name: 'Ouvrir un projet' })).toBeNull()
  })
})

/**
 * 🛑 A SECOND cloud serving the family answers for it too, and the Scenario flag alone does not.
 * Read on that flag, a Tripo key was refused the 3D and Image forms while the picker listed its
 * fifty models right beside them — measured in the app on 2026-08-31.
 */
describe('the generator on a second cloud', () => {
  beforeEach(() => {
    installCanvas(DOCUMENT)
    useSettings.setState({ auth: { authenticated: false, reason: 'missing' } })
    useProject.setState({ project: PROJECT, known: true })
    chassisFor('image')
    useLayouts.setState({ activeWorkspace: 'image' })
    useGeneration.setState({ forcedCapability: aiRoleId('image', 'txt2img') })
    // Read, and holding nothing of this machine: the guard is only reached past both.
    useAiModels.setState({
      overview: {
        roles: [],
        machine: { physicalBytes: 1, availableBytes: 1, diskFreeBytes: 1, gpu: null, vram: null },
        projectPath: PROJECT.path,
        installing: null,
        loading: null,
        loadFailure: null,
        installFailure: null,
        ollama: { ready: false, installed: false, names: [], progress: null, failed: false },
        engine: { known: false, missing: [], progress: null, failed: false },
      },
    })
    useAccounts.setState({ accounts: [], accountsLoaded: true })
  })

  it('asks for a key when no held cloud serves the family', () => {
    renderPanel()

    expect(screen.getAllByText(/identifiants/i).length).toBeGreaterThan(0)
  })

  it('draws the form when another held cloud serves it', () => {
    useAccounts.setState({
      accounts: [{ id: 'account-tripo', name: 'Studio', providerId: TRIPO_CLOUD, active: true }],
      accountsLoaded: true,
    })

    renderPanel()

    expect(screen.queryByText(/identifiants/i)).toBeNull()
  })
})

describe('the generator on this machine', () => {
  beforeEach(() => {
    installCanvas(DOCUMENT)
    useSettings.setState({ auth: { authenticated: false, reason: 'missing' } })
    useProject.setState({ project: PROJECT, known: true })
    useModels.setState({
      selected: { [aiRoleId('image', 'txt2img')]: 'ssd-1b' },
      preset: {},
    })
    chassisFor('image')
    useLayouts.setState({ activeWorkspace: 'image' })
    // Forced, because a canvas is open above and the panel would otherwise read that as working
    // FROM its picture. What this case is about is an account, not the detection.
    useGeneration.setState({ forcedCapability: aiRoleId('image', 'txt2img') })
    const overview: AiOverview = {
      roles: [
        {
          role: aiRoleId('image', 'txt2img'),
          provider: { kind: 'local', modelId: 'ssd-1b' },
          chosen: { app: { kind: 'local', modelId: 'ssd-1b' }, project: null },
          candidates: [
            {
              model: localModel({ id: 'ssd-1b', name: 'SSD-1B', family: 'image' }),
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
          clouds: [],
        },
      ],
      machine: {
        physicalBytes: 1,
        availableBytes: 1,
        diskFreeBytes: 1,
        gpu: null,
        vram: null,
      },
      projectPath: PROJECT.path,
      installing: null,
      loading: null,
      loadFailure: null,
      installFailure: null,
      ollama: { ready: false, installed: false, names: [], progress: null, failed: false },
      engine: { known: false, missing: [], progress: null, failed: false },
    }
    useAiModels.setState({ overview })
    installFakeBridge({
      provider: {
        describeModel: (modelId: string) =>
          DESCRIPTORS[modelId]
            ? Promise.resolve(DESCRIPTORS[modelId])
            : Promise.reject(new Error('no model')),
      },
    })
  })

  it('draws the form without an account', async () => {
    renderPanel()

    expect(await screen.findByText('SSD-1B')).toBeInTheDocument()
    expect(screen.queryByText(/identifiants/i)).toBeNull()
  })

  /**
   * 🛑 Seen on screen: clicking the word « Modèle » made the picker flicker and never stay open.
   * A `<label>` FORWARDS its click — the panel opened on the forwarded one, and the original,
   * landing outside it, closed it again. A disclosure takes no label of its own.
   */
  it('leaves the model picker shut when its name is clicked', async () => {
    renderPanel()

    await userEvent.click(await screen.findByText('Modèle'))

    expect(screen.queryByPlaceholderText(/Chercher un modèle/i)).toBeNull()
  })

  /**
   * 🛑 The Scenario key, asked for where Scenario can serve and nowhere else: a person holding an
   * Anthropic key alone was shown the Scenario form in Code, with no way past it.
   */
  it('asks for no Scenario key in a space its catalogue does not serve', () => {
    useLayouts.setState({ activeWorkspace: 'code' })
    useGeneration.setState({ forcedCapability: aiRoleId('code', 'txt2code') })
    useAiModels.setState({ overview: null })

    renderPanel()

    expect(screen.queryByText(/identifiants/i)).toBeNull()
  })
})

describe('a generation in flight', () => {
  beforeEach(() => {
    installCanvas(DOCUMENT)
    useSettings.setState({
      auth: { authenticated: true },
      // A canvas is open here, so the question would stand in front of every case below. The two
      // that are ABOUT the question set `ask` themselves.
      settings: {
        ...DEFAULT_SETTINGS,
        generation: { ...DEFAULT_SETTINGS.generation, landing: 'document' },
      },
    })
    useAiModels.setState({ overview: null })
    useProject.setState({ project: PROJECT, known: true })
    useLayouts.setState({ activeWorkspace: 'image' })
    useGeneration.setState({ forcedCapability: aiRoleId('image', 'txt2img') })
    chooseModels({ [aiRoleId('image', 'txt2img')]: 'model_flux' })
    useJobs.setState({ jobs: [], bodies: {} })

    installFakeBridge({
      provider: {
        describeModel: (modelId: string) =>
          DESCRIPTORS[modelId]
            ? Promise.resolve(DESCRIPTORS[modelId])
            : Promise.reject(new Error('no model')),
        generate: () => Promise.resolve(job({ id: 'job_1', status: 'running', progress: 0.4 })),
      },
    })
  })

  /** The one required field of these descriptors, filled so the form will submit at all. */
  const generate = async (): Promise<void> => {
    await userEvent.type(await screen.findByLabelText(/Image/), 'asset-source')
    await userEvent.click(screen.getByRole('button', { name: /Générer/ }))
  }

  /**
   * 🛑 Asked BEFORE the run, never after: the answer decides where minutes of compute land, and
   * a question raised when the picture arrives is one nobody is still watching for.
   */
  it('asks where the result goes before spending anything on it', async () => {
    useSettings.setState({
      settings: {
        ...DEFAULT_SETTINGS,
        generation: { ...DEFAULT_SETTINGS.generation, landing: 'ask' },
      },
    })
    renderPanel()

    await generate()

    expect(await screen.findByRole('dialog')).toBeVisible()
    expect(screen.queryByText('En cours')).toBeNull()
  })

  // With nothing open there is nothing to choose between, so nothing is asked.
  it('asks nothing when no document is waiting for the result', async () => {
    useDocuments.setState({ documents: {}, activeId: null })
    useSettings.setState({
      settings: {
        ...DEFAULT_SETTINGS,
        generation: { ...DEFAULT_SETTINGS.generation, landing: 'ask' },
      },
    })
    renderPanel()

    await generate()

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(await screen.findByText('En cours')).toBeVisible()
  })

  /**
   * § 30: someone who pressed Generate watches the panel they pressed it in. A run whose only
   * trace is a bar at the foot of the window reads as a click that did nothing.
   */
  it('shows how far it has got, in the panel it was launched from', async () => {
    renderPanel()
    await generate()

    expect(await screen.findByText('En cours')).toBeVisible()
  })

  // 🛑 `submit` is a round trip, and a second press before it answers pays for two generations.
  it('disarms the button while one is running', async () => {
    renderPanel()
    await generate()

    expect(await screen.findByRole('button', { name: /Générer/ })).toBeDisabled()
  })

  /**
   * 🛑 The window the guard is FOR: while `submit` is in flight the job has no id yet, so
   * following the job list cannot answer for it. Reading `running` alone left the button live
   * for the whole round trip.
   */
  it('disarms it during the round trip, before any job id exists', async () => {
    let answer: (settled: Job) => void = () => {}
    installFakeBridge({
      provider: {
        describeModel: (modelId: string) =>
          DESCRIPTORS[modelId]
            ? Promise.resolve(DESCRIPTORS[modelId])
            : Promise.reject(new Error('no model')),
        generate: () => new Promise<Job>(resolve => (answer = resolve)),
      },
    })

    renderPanel()
    await generate()

    expect(screen.getByRole('button', { name: /Générer/ })).toBeDisabled()
    await act(async () => answer(job({ id: 'job_1', status: 'running' })))
  })

  it('offers to stop it, and asks the main process to', async () => {
    const cancel = vi.fn(() => Promise.resolve())
    useJobs.setState({ cancel })

    renderPanel()
    await generate()
    await userEvent.click(await screen.findByRole('button', { name: 'Annuler la tâche' }))

    expect(cancel).toHaveBeenCalledWith('job_1')
  })

  // A finished job has nothing to stop, and a button that cancels one answers nothing.
  it('takes the way to stop it away once it has finished', async () => {
    renderPanel()
    await generate()
    await screen.findByText('En cours')

    act(() => {
      useJobs.setState({ jobs: [job({ id: 'job_1', status: 'succeeded', progress: 1 })] })
    })

    expect(screen.queryByRole('button', { name: 'Annuler la tâche' })).toBeNull()
  })
})

/**
 * The Code space, where a landing OVERWRITES rather than adds — the one place the destination is
 * a fact of the operation and not of a preference.
 */
describe('a generation that lands in a script', () => {
  beforeEach(() => {
    installDocument('Walk', 'code')
    useCode.getState().installed(scriptRefAt('Scripts/Walk.ts'), 'export const x = 1')
    useSettings.setState({
      auth: { authenticated: true },
      // 🛑 `ask` on purpose: the operation's own answer has to win over the preference, or the
      // question stands in front of a request that already settled it.
      settings: {
        ...DEFAULT_SETTINGS,
        generation: { ...DEFAULT_SETTINGS.generation, landing: 'ask' },
      },
    })
    useAiModels.setState({ overview: null })
    useProject.setState({ project: PROJECT, known: true })
    useLayouts.setState({ activeWorkspace: 'code' })
    useGeneration.setState({ forcedCapability: aiRoleId('code', 'code2code') })
    chooseModels({ [aiRoleId('code', 'code2code')]: 'model_code' })
    useJobs.setState({ jobs: [], bodies: {} })

    installFakeBridge({
      provider: {
        describeModel: (modelId: string) =>
          DESCRIPTORS[modelId]
            ? Promise.resolve(DESCRIPTORS[modelId])
            : Promise.reject(new Error('no model')),
        generate: () => Promise.resolve(job({ id: 'job_1', status: 'running', progress: 0.4 })),
      },
    })
  })

  /** Everywhere else a generation adds a picture; here it writes over a file being edited. */
  it('names the file it will write into, and the one that travels with the request', async () => {
    renderPanel()

    expect(await screen.findByLabelText('Destination')).toHaveValue('document')
    expect(screen.getByRole('option', { name: 'Dans Walk.ts' })).toBeInTheDocument()
    expect(screen.getByText(/Walk\.ts part avec la demande/)).toBeVisible()
  })

  /** 🛑 The operation settles it, so there is nothing left to ask — `landing: 'ask'` or not. */
  it('asks nothing, the operation having already said where it goes', async () => {
    renderPanel()

    await userEvent.type(await screen.findByLabelText(/Prompt/), 'twice as fast')
    await userEvent.click(screen.getByRole('button', { name: /Générer/ }))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(await screen.findByText('En cours')).toBeVisible()
  })

  /** The control deviates it, and the deviation is held OUT of the form — invariant 5. */
  it('lets the destination be deviated to a file of its own', async () => {
    renderPanel()

    await userEvent.selectOptions(await screen.findByLabelText('Destination'), 'newTab')

    expect(screen.getByLabelText('Destination')).toHaveValue('newTab')
    // What travels is a fact of the OPERATION, and deviating where it lands does not change it.
    expect(screen.getByText(/Walk\.ts part avec la demande/)).toBeVisible()
  })
})
