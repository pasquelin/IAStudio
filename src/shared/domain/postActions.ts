import { action, type ActionField, type AssistantAction } from './assistantAction'
import { CAMERA_POST_MODES, POST_EFFECT_IDS } from './postProcessing'

/**
 * The composition, driven by value.
 *
 * Every one of these names a stack by whose it is — the scene's when no camera is given — so one
 * family serves the Default Post Processing and every camera that overrides it. Nothing here
 * knows what a bloom is: the effect is a member of `PostEffectId` and the parameter is a key of
 * its own fiche, both read off the catalogue rather than listed a second time.
 */

/**
 * Whose composition. Absent means the SCENE's, which is what a first call means — a hand opens a
 * scene and reaches for its look before it has made a camera.
 */
const CAMERA: ActionField = {
  key: 'cameraId',
  kind: 'text',
  labelKey: 'assistant.fields.postCameraId',
  required: false,
}

/** Which knob of that instance. A key of the effect's own fiche, never a name of our choosing. */
const PARAM: ActionField = {
  key: 'param',
  kind: 'text',
  labelKey: 'assistant.fields.postParam',
  required: true,
}

/** Which instance of the stack. The id the stack holds, not the kind of effect. */
const EFFECT: ActionField = {
  key: 'effectId',
  kind: 'text',
  labelKey: 'assistant.fields.postEffectId',
  required: true,
}

export const POST_ACTIONS: readonly AssistantAction[] = [
  action({
    name: 'post.state',
    titleKey: 'assistant.actions.postState.title',
    descriptionKey: 'assistant.actions.postState.description',
    commitment: 'none',
    repeatable: true,
    reach: 'mcp',
    fields: [CAMERA],
  }),
  action({
    name: 'post.add',
    titleKey: 'assistant.actions.postAdd.title',
    descriptionKey: 'assistant.actions.postAdd.description',
    commitment: 'none',
    repeatable: true,
    reach: 'mcp',
    fields: [
      CAMERA,
      {
        key: 'effect',
        kind: 'choice',
        labelKey: 'assistant.fields.postEffect',
        required: true,
        options: POST_EFFECT_IDS,
      },
    ],
  }),
  action({
    name: 'post.remove',
    titleKey: 'assistant.actions.postRemove.title',
    descriptionKey: 'assistant.actions.postRemove.description',
    commitment: 'none',
    repeatable: true,
    reach: 'mcp',
    fields: [CAMERA, EFFECT],
  }),
  action({
    name: 'post.move',
    titleKey: 'assistant.actions.postMove.title',
    descriptionKey: 'assistant.actions.postMove.description',
    commitment: 'none',
    repeatable: true,
    reach: 'mcp',
    fields: [
      CAMERA,
      EFFECT,
      { key: 'by', kind: 'integer', labelKey: 'assistant.fields.postBy', required: true },
    ],
  }),
  action({
    name: 'post.set',
    titleKey: 'assistant.actions.postSet.title',
    descriptionKey: 'assistant.actions.postSet.description',
    commitment: 'none',
    repeatable: true,
    reach: 'mcp',
    fields: [
      CAMERA,
      EFFECT,
      PARAM,
      // Three ways to say a value, because a parameter is a number, a switch or a word — and the
      // catalogue is what decides which. A call naming the wrong one is refused rather than
      // coerced: a bloom strength of `true` means nothing anybody meant.
      { key: 'value', kind: 'number', labelKey: 'assistant.fields.postValue', required: false },
      { key: 'text', kind: 'text', labelKey: 'assistant.fields.postText', required: false },
      { key: 'on', kind: 'boolean', labelKey: 'assistant.fields.postOn', required: false },
    ],
  }),
  action({
    name: 'post.enable',
    titleKey: 'assistant.actions.postEnable.title',
    descriptionKey: 'assistant.actions.postEnable.description',
    commitment: 'none',
    repeatable: true,
    reach: 'mcp',
    fields: [
      CAMERA,
      EFFECT,
      { key: 'enabled', kind: 'boolean', labelKey: 'assistant.fields.postEnabled', required: true },
    ],
  }),
  action({
    name: 'post.switch',
    titleKey: 'assistant.actions.postSwitch.title',
    descriptionKey: 'assistant.actions.postSwitch.description',
    commitment: 'none',
    repeatable: true,
    reach: 'mcp',
    fields: [
      CAMERA,
      { key: 'enabled', kind: 'boolean', labelKey: 'assistant.fields.postEnabled', required: true },
    ],
  }),
  /**
   * By id OR by name, like every node-facing action of the registry: `post.presets` publishes
   * both families, and a preset somebody saved on this machine is reachable by the name they
   * gave it. A `choice` on the shipped ids alone would have made the saved ones unreachable.
   */
  action({
    name: 'post.preset',
    titleKey: 'assistant.actions.postPreset.title',
    descriptionKey: 'assistant.actions.postPreset.description',
    commitment: 'none',
    repeatable: true,
    reach: 'mcp',
    fields: [
      CAMERA,
      { key: 'preset', kind: 'text', labelKey: 'assistant.fields.postPreset', required: true },
    ],
  }),
  action({
    name: 'post.presets',
    titleKey: 'assistant.actions.postPresets.title',
    descriptionKey: 'assistant.actions.postPresets.description',
    commitment: 'none',
    repeatable: true,
    reach: 'mcp',
    fields: [],
  }),
  action({
    name: 'post.duplicate',
    titleKey: 'assistant.actions.postDuplicate.title',
    descriptionKey: 'assistant.actions.postDuplicate.description',
    commitment: 'none',
    repeatable: true,
    reach: 'mcp',
    fields: [CAMERA, EFFECT],
  }),
  action({
    name: 'post.reset',
    titleKey: 'assistant.actions.postReset.title',
    descriptionKey: 'assistant.actions.postReset.description',
    commitment: 'none',
    repeatable: true,
    reach: 'mcp',
    fields: [CAMERA, EFFECT],
  }),
  /**
   * The composition ANIMATED, which is what the fifth `TrackProperty` bought — without these two
   * a client can compose a look and never make it move. The value is the ABSOLUTE one the panel
   * shows; the delta against the stack is arithmetic nobody outside should have to do.
   */
  action({
    name: 'post.key',
    titleKey: 'assistant.actions.postKey.title',
    descriptionKey: 'assistant.actions.postKey.description',
    commitment: 'none',
    repeatable: true,
    reach: 'mcp',
    fields: [
      CAMERA,
      EFFECT,
      PARAM,
      { key: 'value', kind: 'number', labelKey: 'assistant.fields.postValue', required: true },
    ],
  }),
  action({
    name: 'post.unkey',
    titleKey: 'assistant.actions.postUnkey.title',
    descriptionKey: 'assistant.actions.postUnkey.description',
    commitment: 'none',
    repeatable: true,
    reach: 'mcp',
    fields: [CAMERA, EFFECT, PARAM],
  }),
  action({
    name: 'post.save',
    titleKey: 'assistant.actions.postSave.title',
    descriptionKey: 'assistant.actions.postSave.description',
    commitment: 'none',
    repeatable: true,
    reach: 'mcp',
    fields: [
      CAMERA,
      { key: 'name', kind: 'text', labelKey: 'assistant.fields.postPresetName', required: true },
    ],
  }),
  action({
    name: 'post.rename',
    titleKey: 'assistant.actions.postRename.title',
    descriptionKey: 'assistant.actions.postRename.description',
    commitment: 'none',
    repeatable: true,
    reach: 'mcp',
    fields: [
      { key: 'preset', kind: 'text', labelKey: 'assistant.fields.postPreset', required: true },
      { key: 'name', kind: 'text', labelKey: 'assistant.fields.postPresetName', required: true },
    ],
  }),
  /** It leaves this MACHINE, and no document holds it: `studio` rather than `none`. */
  action({
    name: 'post.forget',
    titleKey: 'assistant.actions.postForget.title',
    descriptionKey: 'assistant.actions.postForget.description',
    commitment: 'studio',
    repeatable: true,
    reach: 'mcp',
    fields: [
      { key: 'preset', kind: 'text', labelKey: 'assistant.fields.postPreset', required: true },
    ],
  }),
  action({
    name: 'post.camera',
    titleKey: 'assistant.actions.postCamera.title',
    descriptionKey: 'assistant.actions.postCamera.description',
    commitment: 'none',
    repeatable: true,
    reach: 'mcp',
    fields: [
      { key: 'nodeId', kind: 'text', labelKey: 'assistant.fields.nodeId', required: true },
      {
        key: 'mode',
        kind: 'choice',
        labelKey: 'assistant.fields.postMode',
        required: true,
        options: CAMERA_POST_MODES,
      },
    ],
  }),
]
