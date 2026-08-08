import { beforeEach, describe, expect, it } from 'vitest'
import type { FieldDescriptor } from '@shared/domain/model'
import { setLayerMask } from '@/engines/canvas/commands'
import { installCanvas } from '@/stores/canvas-fixtures'
import { useCanvases } from '@/stores/canvases'
import { useLayouts } from '@/stores/layouts'
import { useModels } from '@/stores/models'
import { useSettings } from '@/stores/settings'
import { useTools } from '@/stores/tools'
import { prepareEdit } from './ai-actions'

const DOCUMENT = 'doc-1'

const FIELDS: FieldDescriptor[] = [
  { key: 'prompt', kind: 'longText', label: 'Prompt', required: false },
  { key: 'image', kind: 'image', label: 'Image', required: true },
  { key: 'mask', kind: 'image', label: 'Mask', required: false, maskFrom: 'image' },
]

const host = {
  snapshot: () => Promise.resolve('FLAT'),
  maskSnapshot: () => Promise.resolve('MASK'),
}

let uploaded: string[] = []
const bridge = {
  uploadAsset: (_name: string, image: string) => {
    uploaded.push(image)
    return Promise.resolve(`asset-${image.toLowerCase()}`)
  },
  describeModel: () => Promise.resolve({ fields: FIELDS }),
}

function defaultModel(family: string, modelId: string | undefined): void {
  useSettings.setState(state => ({
    settings: {
      ...state.settings,
      generation: { ...state.settings.generation, defaultModels: { [family]: modelId } },
    },
  }))
}

beforeEach(() => {
  uploaded = []
  installCanvas(DOCUMENT)
  useModels.setState({ selected: {}, preset: {} })
  useTools.setState({ open: {}, focusedZone: null })
  useLayouts.setState({ activeWorkspace: 'image' })
  defaultModel('image', 'model_flux')
})

describe('preparing an edit', () => {
  it('opens the family model on the flattened document', async () => {
    await expect(prepareEdit(DOCUMENT, 'regenerate', host, bridge)).resolves.toBe(true)

    expect(useModels.getState().selected.image).toBe('model_flux')
    expect(useModels.getState().preset.image).toMatchObject({ image: 'asset-flat' })
  })

  // The session choice wins over the preference, the order the generator itself follows.
  it('uses the model chosen in the panel over the one set in the preferences', async () => {
    useModels.getState().select('image', 'model_chosen')

    await prepareEdit(DOCUMENT, 'regenerate', host, bridge)

    expect(useModels.getState().selected.image).toBe('model_chosen')
  })

  /**
   * The canvas does not honour a mask whose box is unticked, so sending it would ask the model
   * to repaint a region nothing on screen shows.
   */
  it('leaves a disabled mask out of the edit', async () => {
    useCanvases
      .getState()
      .runCommand(DOCUMENT, setLayerMask('layer-1', { enabled: false, linked: true }))

    await prepareEdit(DOCUMENT, 'regenerate', host, bridge)

    expect(uploaded).toEqual(['FLAT'])
  })

  // An upload is a permanent asset in the user's library: a model with nowhere to put a picture
  // must not cost one.
  it('sends nothing to a model that takes no picture', async () => {
    const textOnly = {
      ...bridge,
      describeModel: () =>
        Promise.resolve({ fields: [FIELDS[0]].filter(field => field !== undefined) }),
    }

    await expect(prepareEdit(DOCUMENT, 'regenerate', host, textOnly)).resolves.toBe(false)
    expect(uploaded).toEqual([])
  })

  // The mask one paints is the mask one regenerates — but only where the layer carries one.
  it('sends the mask along when the armed layer has one', async () => {
    useCanvases
      .getState()
      .runCommand(DOCUMENT, setLayerMask('layer-1', { enabled: true, linked: true }))

    await prepareEdit(DOCUMENT, 'regenerate', host, bridge)

    expect(uploaded).toEqual(['FLAT', 'MASK'])
    expect(useModels.getState().preset.image).toMatchObject({ mask: 'asset-mask' })
  })

  it('sends only the picture when there is no mask to send', async () => {
    await prepareEdit(DOCUMENT, 'regenerate', host, bridge)

    expect(uploaded).toEqual(['FLAT'])
  })

  // Cutting out, enlarging and vectorizing take the picture whole: a mask would mean nothing.
  it('asks each edit of the family it belongs to', async () => {
    defaultModel('upscale', 'model_big')

    await prepareEdit(DOCUMENT, 'enlarge', host, bridge)

    expect(useModels.getState().selected.upscale).toBe('model_big')
    expect(uploaded).toEqual(['FLAT'])
  })

  /**
   * Never a model chosen on the user's behalf. The panel opens on the family instead, which is
   * the one place where choosing one belongs.
   */
  it('opens the models panel rather than picking one when none is set', async () => {
    defaultModel('vectorization', undefined)

    await expect(prepareEdit(DOCUMENT, 'vectorize', host, bridge)).resolves.toBe(false)

    expect(uploaded).toEqual([])
    expect(useTools.getState().open.right?.primary).toBe('models')
  })

  // The action prepares; it never submits. Every parameter of the model stays visible, and the
  // edit is reviewable before it is paid for.
  it('brings the form forward rather than submitting it', async () => {
    await prepareEdit(DOCUMENT, 'regenerate', host, bridge)

    expect(useTools.getState().focusedZone).toBe('right')
  })
})
