import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import type { FieldDescriptor, ModelDescriptor } from '@shared/domain/model'
import type { StudioBridge } from '@shared/ipc'
import { installFakeBridge } from '@/services/fake-bridge'
import { installCanvas } from '@/stores/canvas-fixtures'
import { useLayouts } from '@/stores/layouts'
import { useModels } from '@/stores/models'
import { connectPreparation } from '@/stores/preparation'
import { useSettings } from '@/stores/settings'
import { useTools } from '@/stores/tools'
import { prepareEdit } from '@/spaces/image/ai-actions'
import panelSource from './Generator.tsx?raw'
import { Generator } from './Generator'

const DOCUMENT = 'doc-1'

const PICTURE: FieldDescriptor = { key: 'image', kind: 'image', label: 'Image', required: true }

const DESCRIPTORS: Record<string, ModelDescriptor> = {
  model_flux: descriptor('model_flux', 'Flux', 'image'),
  model_big: descriptor('model_big', 'Magnific Upscaler', 'upscale'),
}

function descriptor(id: string, name: string, family: ModelDescriptor['family']): ModelDescriptor {
  return {
    id,
    name,
    family,
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
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <Generator />
    </QueryClientProvider>,
  )
}

function defaultModels(models: Record<string, string>): void {
  useSettings.setState(state => ({
    settings: {
      ...state.settings,
      generation: { ...state.settings.generation, defaultModels: models },
    },
  }))
}

describe('Generator', () => {
  let bridge: StudioBridge

  beforeEach(() => {
    installCanvas(DOCUMENT)
    useSettings.setState({ auth: { authenticated: true } })
    useModels.setState({ selected: {}, preset: {}, prepared: null })
    useTools.setState({ open: {}, focusedZone: null })
    useLayouts.setState({ activeWorkspace: 'image' })
    defaultModels({ image: 'model_flux', upscale: 'model_big' })

    bridge = installFakeBridge({
      scenario: {
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
    await prepareEdit(DOCUMENT, 'enlarge', host, bridge.scenario)
    renderPanel()

    expect(await screen.findByText('Magnific Upscaler')).toBeInTheDocument()
    expect(screen.queryByText('Flux')).not.toBeInTheDocument()
  })

  // A preparation is a parenthesis: leaving the space closes it, and the panel comes back to the
  // family of wherever the user now is. `connectPreparation` is what the application branches.
  it('comes back to the workspace family once the preparation is closed', async () => {
    const stop = connectPreparation()
    await prepareEdit(DOCUMENT, 'enlarge', host, bridge.scenario)

    useLayouts.setState({ activeWorkspace: 'video' })
    defaultModels({ video: 'model_flux' })
    renderPanel()

    expect(await screen.findByText('Flux')).toBeInTheDocument()
    stop()
  })

  // Choosing a model by hand is taking the generator back from whatever prepared it.
  it('drops the preparation once a model is picked in the panel', async () => {
    await prepareEdit(DOCUMENT, 'enlarge', host, bridge.scenario)

    useModels.getState().select('image', 'model_flux')
    renderPanel()

    expect(await screen.findByText('Flux')).toBeInTheDocument()
  })

  /**
   * The form pulls zod, react-hook-form and its resolver — 219,6 kB of the opening chunk on
   * 8 August. Nothing but a deferred import keeps them out, and nothing but this says so.
   */
  it('never imports the form at module scope', () => {
    expect(panelSource).not.toMatch(/^import \{ DynamicForm \}/m)
    // Both halves: a static import removed without a deferred one put back would leave the panel
    // with no form at all, and the line above would still pass.
    expect(panelSource).toMatch(/await import\('@\/design\/DynamicForm'\)/)
  })
})
