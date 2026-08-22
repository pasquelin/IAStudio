import { render, screen } from '@testing-library/react'
import { SCENARIO_CLOUD } from '@shared/domain/aiCloud'
import { LOCAL_RUNTIME } from '@shared/domain/model'
import { aiRoleId } from '@shared/domain/aiRole'
import { localModel } from '@shared/domain/localModel-fixtures'
import type { AiOverview } from '@shared/domain/aiOverview'
import { useAiModels } from '@/stores/aiModels'
import { beforeEach, describe, expect, it } from 'vitest'
import type { FieldDescriptor, ModelDescriptor } from '@shared/domain/model'
import type { StudioBridge } from '@shared/ipc'
import { withQueries } from '@/app/query-fixtures'
import { installFakeBridge } from '@/services/fakeBridge'
import { installCanvas } from '@/stores/canvas-fixtures'
import { useLayouts } from '@/stores/layouts'
import { useModels } from '@/stores/models'
import { useProject } from '@/stores/project'
import { connectPreparation } from '@/stores/preparation'
import { useSettings } from '@/stores/settings'
import { preferModels } from '@/stores/settings-fixtures'
import { arrangedFor } from '@/stores/tool-fixtures'
import { useTools } from '@/stores/tools'
import { prepareEdit } from '@/spaces/image/aiActions'
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

const PROJECT = {
  path: '/projects/demo',
  manifest: { version: 1, name: 'demo', createdAt: '', updatedAt: '' },
}

describe('Generator', () => {
  let bridge: StudioBridge

  beforeEach(() => {
    installCanvas(DOCUMENT)
    useSettings.setState({ auth: { authenticated: true } })
    useAiModels.setState({ overview: null })
    // A job collects into its own project and nowhere else, so the panel asks for one before it
    // draws a form. Every case below is about the form, and each of them needs one.
    useProject.setState({ project: PROJECT, known: true })
    useModels.setState({ selected: {}, preset: {}, prepared: null })
    useTools.setState({ arrangements: arrangedFor('image', { open: {} }), focusedZone: null })
    useLayouts.setState({ activeWorkspace: 'image' })
    preferModels({ image: 'model_flux', upscale: 'model_big' })

    bridge = installFakeBridge({
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

  it('opens on the workspace model when nothing was prepared', async () => {
    renderPanel()

    expect(await screen.findByText('Flux')).toBeInTheDocument()
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
    preferModels({ video: 'model_flux' })
    renderPanel()

    expect(await screen.findByText('Flux')).toBeInTheDocument()
    stop()
  })

  // Choosing a model by hand is taking the generator back from whatever prepared it.
  it('drops the preparation once a model is picked in the panel', async () => {
    await prepareEdit(DOCUMENT, 'enlarge', host, bridge.provider)

    useModels.getState().select('image', 'model_flux')
    renderPanel()

    expect(await screen.findByText('Flux')).toBeInTheDocument()
  })

  /**
   * The form pulls zod, react-hook-form and its resolver — 219,6 kB of the opening chunk on
   * 8 August, 223 000 in its own chunk on 10 August. Nothing but a deferred import keeps them
   * out, and nothing but this says so.
   *
   * The `lazy` itself moved to `design/dynamicFormLazy`, which three panels had each written
   * for themselves; that module's only export is the `lazy`, so importing IT statically pulls
   * nothing. What must never appear here is the form's own module, under any form of import —
   * which is wider than the `^import { DynamicForm }` this line used to match.
   */
  it('never imports the form at module scope', () => {
    expect(panelSource).not.toMatch(/from '@\/design\/DynamicForm'/)
    // Both halves: an import removed without the deferred one put back would leave the panel
    // with no form at all, and the line above would still pass.
    expect(panelSource).toMatch(/from '@\/design\/dynamicFormLazy'/)
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
          path: '/projects/summer',
          manifest: {
            version: 1,
            name: 'Summer',
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
    useTools.setState({ arrangements: arrangedFor('image', { open: {} }), focusedZone: null })
    useLayouts.setState({ activeWorkspace: 'image' })
    preferModels({ image: 'model_flux', upscale: 'model_big' })
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

describe('the generator on this machine', () => {
  beforeEach(() => {
    installCanvas(DOCUMENT)
    useSettings.setState({ auth: { authenticated: false, reason: 'missing' } })
    useProject.setState({ project: PROJECT, known: true })
    useModels.setState({ selected: { image: 'ssd-1b' }, preset: {}, prepared: null })
    useTools.setState({ arrangements: arrangedFor('image', { open: {} }), focusedZone: null })
    useLayouts.setState({ activeWorkspace: 'image' })
    preferModels()
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
      ollama: { ready: false, installed: false, names: [], progress: null, failed: false },
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
})
