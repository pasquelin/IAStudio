import { action, type ActionField, type AssistantAction } from './assistantAction'
import { LIGHT_ENTRIES, MESH_ENTRIES, OBJECT_ENTRIES } from './scene'

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
]
