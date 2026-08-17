import { action, type ActionField, type AssistantAction } from './assistantAction'
import { PBR_CHANNELS } from './texture'

/**
 * The sky and the material, driven by value.
 *
 * Unlike the image and the montage, both of these keep their state in `shared/` already — a sky is
 * a `SkyboxContent`, a material a `MaterialSettings` — so the closed lists here are IMPORTED
 * rather than written out, and no test has to hold a copy to its original.
 *
 * Angles are in RADIANS, which is what the state holds and what the panels write. The image family
 * takes degrees because a layer carries one angle a person types; these carry several a program
 * computes, and converting them back for every read would be the greater cost.
 */

const NUMBER = (key: string, labelKey: string, min?: number, max?: number): ActionField => ({
  key,
  kind: 'number',
  labelKey,
  required: false,
  ...(min === undefined ? {} : { min }),
  ...(max === undefined ? {} : { max }),
})

export const MATERIAL_ACTIONS: readonly AssistantAction[] = [
  action({
    name: 'skybox.state',
    titleKey: 'assistant.actions.skyboxState.title',
    descriptionKey: 'assistant.actions.skyboxState.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [],
  }),
  action({
    /**
     * Every dial optional, like `layer.style`: a client changing the exposure alone must not have
     * to restate a temperature it never read.
     */
    name: 'skybox.adjust',
    titleKey: 'assistant.actions.skyboxAdjust.title',
    descriptionKey: 'assistant.actions.skyboxAdjust.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [
      NUMBER('exposure', 'assistant.fields.exposure'),
      NUMBER('contrast', 'assistant.fields.contrast', 0),
      NUMBER('saturation', 'assistant.fields.saturation', 0),
      NUMBER('temperature', 'assistant.fields.temperature', -1, 1),
      NUMBER('tint', 'assistant.fields.tint', -1, 1),
      NUMBER('rotationY', 'assistant.fields.rotationY'),
      NUMBER('blur', 'assistant.fields.blur', 0, 1),
    ],
  }),
  action({
    name: 'skybox.resetAdjustments',
    titleKey: 'assistant.actions.skyboxResetAdjustments.title',
    descriptionKey: 'assistant.actions.skyboxResetAdjustments.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [],
  }),
  action({
    name: 'skybox.sun',
    titleKey: 'assistant.actions.skyboxSun.title',
    descriptionKey: 'assistant.actions.skyboxSun.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [
      NUMBER('elevation', 'assistant.fields.elevation'),
      NUMBER('azimuth', 'assistant.fields.azimuth'),
      NUMBER('intensity', 'assistant.fields.intensity', 0),
      { key: 'color', kind: 'color', labelKey: 'assistant.fields.colour', required: false },
    ],
  }),
  action({
    name: 'skybox.environment',
    titleKey: 'assistant.actions.skyboxEnvironment.title',
    descriptionKey: 'assistant.actions.skyboxEnvironment.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [
      NUMBER('intensity', 'assistant.fields.intensity', 0),
      {
        key: 'showBackground',
        kind: 'boolean',
        labelKey: 'assistant.fields.showBackground',
        required: false,
      },
    ],
  }),
  action({
    name: 'skybox.source',
    titleKey: 'assistant.actions.skyboxSource.title',
    descriptionKey: 'assistant.actions.skyboxSource.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [
      { key: 'assetId', kind: 'text', labelKey: 'assistant.fields.assetId', required: true },
    ],
  }),
  action({
    name: 'texture.state',
    titleKey: 'assistant.actions.textureState.title',
    descriptionKey: 'assistant.actions.textureState.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [],
  }),
  action({
    name: 'texture.material',
    titleKey: 'assistant.actions.textureMaterial.title',
    descriptionKey: 'assistant.actions.textureMaterial.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [
      { key: 'color', kind: 'color', labelKey: 'assistant.fields.colour', required: false },
      NUMBER('roughness', 'assistant.fields.roughness', 0, 1),
      NUMBER('metalness', 'assistant.fields.metalness', 0, 1),
      NUMBER('normalScale', 'assistant.fields.normalScale'),
      NUMBER('heightScale', 'assistant.fields.heightScale'),
      NUMBER('aoIntensity', 'assistant.fields.aoIntensity', 0),
      NUMBER('edgeIntensity', 'assistant.fields.edgeIntensity', 0),
      { key: 'emissive', kind: 'color', labelKey: 'assistant.fields.emissive', required: false },
      NUMBER('emissiveIntensity', 'assistant.fields.emissiveIntensity', 0),
      NUMBER('tilingX', 'assistant.fields.tilingX'),
      NUMBER('tilingY', 'assistant.fields.tilingY'),
      NUMBER('offsetX', 'assistant.fields.offsetX'),
      NUMBER('offsetY', 'assistant.fields.offsetY'),
      NUMBER('rotation', 'assistant.fields.rotationY'),
      {
        key: 'invertNormalGreen',
        kind: 'boolean',
        labelKey: 'assistant.fields.invertNormalGreen',
        required: false,
      },
    ],
  }),
  action({
    name: 'texture.preview',
    titleKey: 'assistant.actions.texturePreview.title',
    descriptionKey: 'assistant.actions.texturePreview.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [
      NUMBER('envIntensity', 'assistant.fields.intensity', 0),
      NUMBER('envRotation', 'assistant.fields.rotationY'),
      {
        key: 'showBackground',
        kind: 'boolean',
        labelKey: 'assistant.fields.showBackground',
        required: false,
      },
      { key: 'autoSpin', kind: 'boolean', labelKey: 'assistant.fields.autoSpin', required: false },
      { key: 'showSeam', kind: 'boolean', labelKey: 'assistant.fields.showSeam', required: false },
    ],
  }),
  action({
    /**
     * No `assetId` means EMPTY the channel, which is the one thing an optional field can say here
     * that a required one cannot — clearing a map is a real gesture of the panel.
     */
    name: 'texture.channel',
    titleKey: 'assistant.actions.textureChannel.title',
    descriptionKey: 'assistant.actions.textureChannel.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [
      {
        key: 'channel',
        kind: 'choice',
        labelKey: 'assistant.fields.pbrChannel',
        required: true,
        options: PBR_CHANNELS,
      },
      { key: 'assetId', kind: 'text', labelKey: 'assistant.fields.assetId', required: false },
    ],
  }),
  action({
    name: 'styles.list',
    titleKey: 'assistant.actions.stylesList.title',
    descriptionKey: 'assistant.actions.stylesList.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [],
  }),
  action({
    /**
     * A style is a MATERIAL kept aside, so it is saved from the one in front rather than from
     * values a client would have to restate. The name is a prefix — the studio makes it unique.
     */
    name: 'style.save',
    titleKey: 'assistant.actions.styleSave.title',
    descriptionKey: 'assistant.actions.styleSave.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [{ key: 'name', kind: 'text', labelKey: 'assistant.fields.name', required: true }],
  }),
  action({
    name: 'style.rename',
    titleKey: 'assistant.actions.styleRename.title',
    descriptionKey: 'assistant.actions.styleRename.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [
      { key: 'styleId', kind: 'text', labelKey: 'assistant.fields.styleId', required: true },
      { key: 'name', kind: 'text', labelKey: 'assistant.fields.name', required: true },
    ],
  }),
  action({
    /**
     * `files` rather than `none`: a style lives outside every project, so nothing in the studio
     * gives it back — not ⌘Z, not the Explorer.
     */
    name: 'style.remove',
    titleKey: 'assistant.actions.styleRemove.title',
    descriptionKey: 'assistant.actions.styleRemove.description',
    commitment: 'files',
    reach: 'mcp',
    fields: [
      { key: 'styleId', kind: 'text', labelKey: 'assistant.fields.styleId', required: true },
    ],
  }),
]
