import { action, type ActionField, type AssistantAction } from './assistantAction'
import { EASINGS } from './animation'
import {
  BACKGROUND_BLUR,
  BACKGROUND_KINDS,
  DISPLAY_MODES,
  ENV_INTENSITY,
  ENVIRONMENT_KINDS,
  EXPOSURE,
  FOG_DENSITY,
  FOG_KINDS,
  GROUND_SIZE,
  LIGHT_ENTRIES,
  MESH_ENTRIES,
  OBJECT_ENTRIES,
  TONE_MAPPINGS,
  VIEW_DIRECTIONS,
} from './scene'

/**
 * The 3D workspace, driven by value.
 *
 * The same bargain the image family struck: the 21 scene COMMANDS arm a tool or move a view,
 * and none of them says WHERE. These place a node, turn it, light it and paint it, in the
 * numbers a scene is actually built from.
 *
 * They act on the 3D tab in front, and `studio.state` says which one that is.
 */

const NODE: ActionField = {
  key: 'nodeId',
  kind: 'text',
  labelKey: 'assistant.fields.nodeId',
  required: true,
}

/**
 * Everything the Add menu offers, in one list — the primitives, the lights, and the three
 * objects that belong to no family. Read from the registries rather than restated, so a
 * fourteenth primitive is offered here the day it is offered on screen.
 */
const NODE_KINDS: readonly string[] = [
  ...MESH_ENTRIES.map(entry => entry.kind),
  ...LIGHT_ENTRIES.map(entry => entry.kind),
  ...OBJECT_ENTRIES.map(entry => entry.kind),
]

/** A vector, spelled as three optional numbers: a client changing height alone says `y`. */
const vector = (axis: 'x' | 'y' | 'z', of: 'position' | 'rotation' | 'scale'): ActionField => ({
  key: `${of}${axis.toUpperCase()}`,
  kind: 'number',
  labelKey: `assistant.fields.${of}${axis.toUpperCase()}`,
  required: false,
})

export const SCENE_ACTIONS: readonly AssistantAction[] = [
  action({
    name: 'scene.state',
    titleKey: 'assistant.actions.sceneState.title',
    descriptionKey: 'assistant.actions.sceneState.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [],
  }),
  action({
    name: 'node.add',
    titleKey: 'assistant.actions.nodeAdd.title',
    descriptionKey: 'assistant.actions.nodeAdd.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [
      {
        key: 'kind',
        kind: 'choice',
        labelKey: 'assistant.fields.nodeKind',
        required: true,
        options: NODE_KINDS,
      },
      { key: 'name', kind: 'text', labelKey: 'assistant.fields.name', required: false },
      vector('x', 'position'),
      vector('y', 'position'),
      vector('z', 'position'),
    ],
  }),
  action({
    /**
     * A model of the library, placed in the scene — which is how a generated mesh gets in. It is
     * not on the Add menu for the same reason: what to place comes from the project's assets,
     * not from a list of shapes.
     */
    name: 'node.addModel',
    titleKey: 'assistant.actions.nodeAddModel.title',
    descriptionKey: 'assistant.actions.nodeAddModel.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [
      { key: 'assetId', kind: 'text', labelKey: 'assistant.fields.assetId', required: true },
      { key: 'name', kind: 'text', labelKey: 'assistant.fields.name', required: false },
    ],
  }),
  action({
    name: 'node.remove',
    titleKey: 'assistant.actions.nodeRemove.title',
    descriptionKey: 'assistant.actions.nodeRemove.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [NODE],
  }),
  action({
    name: 'node.rename',
    titleKey: 'assistant.actions.nodeRename.title',
    descriptionKey: 'assistant.actions.nodeRename.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [
      NODE,
      { key: 'name', kind: 'text', labelKey: 'assistant.fields.name', required: true },
    ],
  }),
  action({
    name: 'node.transform',
    titleKey: 'assistant.actions.nodeTransform.title',
    descriptionKey: 'assistant.actions.nodeTransform.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [
      NODE,
      vector('x', 'position'),
      vector('y', 'position'),
      vector('z', 'position'),
      vector('x', 'rotation'),
      vector('y', 'rotation'),
      vector('z', 'rotation'),
      vector('x', 'scale'),
      vector('y', 'scale'),
      vector('z', 'scale'),
    ],
  }),
  action({
    name: 'node.visible',
    titleKey: 'assistant.actions.nodeVisible.title',
    descriptionKey: 'assistant.actions.nodeVisible.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [
      NODE,
      { key: 'visible', kind: 'boolean', labelKey: 'assistant.fields.visible', required: true },
    ],
  }),
  action({
    name: 'node.material',
    titleKey: 'assistant.actions.nodeMaterial.title',
    descriptionKey: 'assistant.actions.nodeMaterial.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [
      NODE,
      { key: 'color', kind: 'color', labelKey: 'assistant.fields.colour', required: false },
      {
        key: 'roughness',
        kind: 'number',
        labelKey: 'assistant.fields.roughness',
        required: false,
        min: 0,
        max: 1,
      },
      {
        key: 'metalness',
        kind: 'number',
        labelKey: 'assistant.fields.metalness',
        required: false,
        min: 0,
        max: 1,
      },
    ],
  }),
  action({
    // Colour and intensity only: the rest of a light's fields differ from kind to kind, and an
    // action that took all of them would take fields most lights have no use for.
    name: 'node.light',
    titleKey: 'assistant.actions.nodeLight.title',
    descriptionKey: 'assistant.actions.nodeLight.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [
      NODE,
      { key: 'color', kind: 'color', labelKey: 'assistant.fields.colour', required: false },
      {
        key: 'intensity',
        kind: 'number',
        labelKey: 'assistant.fields.intensity',
        required: false,
        min: 0,
      },
    ],
  }),
  action({
    // The lens, and nothing of where the camera stands: a camera is moved by `node.transform`
    // like anything else in the tree.
    name: 'node.camera',
    titleKey: 'assistant.actions.nodeCamera.title',
    descriptionKey: 'assistant.actions.nodeCamera.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [
      NODE,
      {
        key: 'fov',
        kind: 'number',
        labelKey: 'assistant.fields.fov',
        required: false,
        min: 1,
        max: 170,
      },
      { key: 'near', kind: 'number', labelKey: 'assistant.fields.near', required: false, min: 0 },
      { key: 'far', kind: 'number', labelKey: 'assistant.fields.far', required: false, min: 0 },
    ],
  }),
  action({
    /**
     * A shot opened for a camera, from an instant onwards. Where it lands in the stack is
     * `shotsWith`'s rule, the same one the band's button obeys — a client that could choose its
     * own layer would be a second law over what is on air.
     */
    name: 'camera.shot',
    titleKey: 'assistant.actions.cameraShot.title',
    descriptionKey: 'assistant.actions.cameraShot.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [
      { key: 'nodeId', kind: 'text', labelKey: 'assistant.fields.nodeId', required: true },
      {
        key: 'startSeconds',
        kind: 'number',
        labelKey: 'assistant.fields.startSeconds',
        required: false,
        min: 0,
      },
      {
        key: 'durationSeconds',
        kind: 'number',
        labelKey: 'assistant.fields.durationSeconds',
        required: false,
        min: 0,
      },
    ],
  }),
  action({
    /**
     * The rail a shot runs its camera along, and which stretch of it. An empty `pathId` unbinds:
     * the camera then stays wherever its transform and its keys put it.
     */
    name: 'camera.rail',
    titleKey: 'assistant.actions.cameraRail.title',
    descriptionKey: 'assistant.actions.cameraRail.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [
      { key: 'shotId', kind: 'text', labelKey: 'assistant.fields.shotId', required: true },
      { key: 'pathId', kind: 'text', labelKey: 'assistant.fields.pathId', required: false },
      // Not clamped to one another: `from` past `to` is what runs the rail backwards.
      { key: 'from', kind: 'number', labelKey: 'assistant.fields.railFrom', required: false },
      { key: 'to', kind: 'number', labelKey: 'assistant.fields.railTo', required: false },
      {
        key: 'easing',
        kind: 'choice',
        labelKey: 'assistant.fields.easing',
        required: false,
        options: EASINGS,
      },
    ],
  }),
  action({
    /**
     * What a shot aims its camera at: a node it follows, a fixed point, or nothing at all —
     * which leaves the camera aimed by its own rotation.
     */
    name: 'camera.target',
    titleKey: 'assistant.actions.cameraTarget.title',
    descriptionKey: 'assistant.actions.cameraTarget.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [
      { key: 'shotId', kind: 'text', labelKey: 'assistant.fields.shotId', required: true },
      { key: 'targetId', kind: 'text', labelKey: 'assistant.fields.targetId', required: false },
      { key: 'atX', kind: 'number', labelKey: 'assistant.fields.positionX', required: false },
      { key: 'atY', kind: 'number', labelKey: 'assistant.fields.positionY', required: false },
      { key: 'atZ', kind: 'number', labelKey: 'assistant.fields.positionZ', required: false },
    ],
  }),
  action({
    name: 'node.reparent',
    titleKey: 'assistant.actions.nodeReparent.title',
    descriptionKey: 'assistant.actions.nodeReparent.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [
      NODE,
      { key: 'parentId', kind: 'text', labelKey: 'assistant.fields.parentId', required: false },
    ],
  }),
  action({
    name: 'node.select',
    titleKey: 'assistant.actions.nodeSelect.title',
    descriptionKey: 'assistant.actions.nodeSelect.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [
      {
        key: 'nodeIds',
        kind: 'text',
        labelKey: 'assistant.fields.nodeIds',
        required: true,
        repeated: true,
      },
    ],
  }),
  /**
   * The two the native menu offers by NAME and no command can: `scene.display` cycles, and
   * cycling to a chosen mode means counting the ones in between.
   */
  action({
    name: 'view.direction',
    titleKey: 'assistant.actions.viewDirection.title',
    descriptionKey: 'assistant.actions.viewDirection.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [
      {
        key: 'direction',
        kind: 'choice',
        labelKey: 'assistant.fields.viewDirection',
        required: true,
        options: VIEW_DIRECTIONS,
      },
    ],
  }),
  action({
    name: 'view.display',
    titleKey: 'assistant.actions.viewDisplay.title',
    descriptionKey: 'assistant.actions.viewDisplay.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [
      {
        key: 'mode',
        kind: 'choice',
        labelKey: 'assistant.fields.displayMode',
        required: true,
        options: DISPLAY_MODES,
      },
    ],
  }),
  /**
   * The half of a 3D document that belongs to no node — what lights it, what hangs behind it,
   * what it stands on. Five actions rather than one, following the sections of the panel that
   * writes them: each of these unions carries its own fields, and a single flat call would offer
   * a density to a linear fog.
   */
  action({
    name: 'world.environment',
    titleKey: 'assistant.actions.worldEnvironment.title',
    descriptionKey: 'assistant.actions.worldEnvironment.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [
      {
        key: 'kind',
        kind: 'choice',
        labelKey: 'assistant.fields.environmentKind',
        required: false,
        options: ENVIRONMENT_KINDS,
      },
      // Names the sky, and naming one is enough: a document lit by an asset is `skybox` by that
      // fact alone, which spares a client two calls to do one thing.
      { key: 'assetId', kind: 'text', labelKey: 'assistant.fields.assetId', required: false },
      {
        key: 'intensity',
        kind: 'number',
        labelKey: 'assistant.fields.intensity',
        required: false,
        min: ENV_INTENSITY.min,
        max: ENV_INTENSITY.max,
      },
      { key: 'rotation', kind: 'number', labelKey: 'assistant.fields.rotationY', required: false },
    ],
  }),
  action({
    name: 'world.background',
    titleKey: 'assistant.actions.worldBackground.title',
    descriptionKey: 'assistant.actions.worldBackground.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [
      {
        key: 'kind',
        kind: 'choice',
        labelKey: 'assistant.fields.backgroundKind',
        required: true,
        options: BACKGROUND_KINDS,
      },
      { key: 'color', kind: 'color', labelKey: 'assistant.fields.colour', required: false },
      {
        key: 'blur',
        kind: 'number',
        labelKey: 'assistant.fields.blur',
        required: false,
        min: BACKGROUND_BLUR.min,
        max: BACKGROUND_BLUR.max,
      },
    ],
  }),
  action({
    name: 'world.fog',
    titleKey: 'assistant.actions.worldFog.title',
    descriptionKey: 'assistant.actions.worldFog.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [
      {
        key: 'kind',
        kind: 'choice',
        labelKey: 'assistant.fields.fogKind',
        required: true,
        options: FOG_KINDS,
      },
      { key: 'color', kind: 'color', labelKey: 'assistant.fields.colour', required: false },
      { key: 'near', kind: 'number', labelKey: 'assistant.fields.near', required: false },
      { key: 'far', kind: 'number', labelKey: 'assistant.fields.far', required: false },
      {
        key: 'density',
        kind: 'number',
        labelKey: 'assistant.fields.fogDensity',
        required: false,
        min: FOG_DENSITY.min,
        max: FOG_DENSITY.max,
      },
    ],
  }),
  action({
    name: 'world.ground',
    titleKey: 'assistant.actions.worldGround.title',
    descriptionKey: 'assistant.actions.worldGround.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [
      { key: 'visible', kind: 'boolean', labelKey: 'assistant.fields.visible', required: false },
      { key: 'color', kind: 'color', labelKey: 'assistant.fields.colour', required: false },
      {
        key: 'size',
        kind: 'number',
        labelKey: 'assistant.fields.groundSize',
        required: false,
        min: GROUND_SIZE.min,
        max: GROUND_SIZE.max,
      },
      {
        key: 'opacity',
        kind: 'number',
        labelKey: 'assistant.fields.opacity',
        required: false,
        min: 0,
        max: 1,
      },
      {
        key: 'receiveShadow',
        kind: 'boolean',
        labelKey: 'assistant.fields.receiveShadow',
        required: false,
      },
    ],
  }),
  action({
    name: 'world.render',
    titleKey: 'assistant.actions.worldRender.title',
    descriptionKey: 'assistant.actions.worldRender.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [
      {
        key: 'toneMapping',
        kind: 'choice',
        labelKey: 'assistant.fields.toneMapping',
        required: false,
        options: TONE_MAPPINGS,
      },
      {
        key: 'exposure',
        kind: 'number',
        labelKey: 'assistant.fields.exposure',
        required: false,
        min: EXPOSURE.min,
        max: EXPOSURE.max,
      },
    ],
  }),
]
