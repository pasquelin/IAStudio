import { action, type ActionField, type AssistantAction } from './assistantAction'
import { EASINGS } from './animation'
import { CSG_OPERATIONS } from './csg'
import { FONT_SOURCES } from './font'
import { CAPTURE_QUALITIES } from './sceneCapture'
import {
  BACKGROUND_BLUR,
  BACKGROUND_KINDS,
  DISPLAY_MODES,
  ENV_INTENSITY,
  ENVIRONMENT_KINDS,
  ENVIRONMENT_PRESETS,
  EXPOSURE,
  FOG_DENSITY,
  FOG_KINDS,
  GROUND_SIZE,
  LIGHT_ENTRIES,
  MATERIAL_SLOTS,
  MESH_ENTRIES,
  OBJECT_ENTRIES,
  TEXTURE_SLOTS,
  TILES_PER_METRE,
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
const vector = (
  axis: 'x' | 'y' | 'z',
  of: 'position' | 'rotation' | 'scale' | 'target' | 'point',
): ActionField => ({
  key: `${of}${axis.toUpperCase()}`,
  kind: 'number',
  labelKey: `assistant.fields.${of}${axis.toUpperCase()}`,
  required: false,
})

/**
 * 🛑 What turns « d'un mètre vers le haut » into one call instead of three.
 *
 * Without it a caller has to read the pose, do the arithmetic and write the result — measured on
 * the bench pass of 2026-08-26, section 7 scored 0 on five requests, every one of them written
 * as an absolute. The field's own label carries the rule, since that is what a model reads.
 */
const RELATIVE: ActionField = {
  key: 'relative',
  kind: 'boolean',
  labelKey: 'assistant.fields.relative',
  required: false,
}

/** An optional dial, spelled once for the forty-odd that only differ by their bounds. */
const dial = (key: string, bounds: { min?: number; max?: number } = {}): ActionField => ({
  key,
  kind: 'number',
  labelKey: `assistant.fields.${key}`,
  required: false,
  ...bounds,
})

/** The same, counted rather than measured — a segment count is never a fraction of one. */
const count = (key: string, min: number, max: number): ActionField => ({
  key,
  kind: 'integer',
  labelKey: `assistant.fields.${key}`,
  required: false,
  min,
  max,
})

/** A size in scene units, which is never zero: a degenerate primitive is a mesh that vanishes. */
const SMALLEST = 0.001

/**
 * The parameters of a primitive, in ONE action rather than fourteen.
 *
 * Which of them a node holds is settled when it is added and never again — `setGeometryOn` only
 * writes a mesh built from the same kind — so a client reads the kind from `scene.state` and
 * names the fields that kind carries. One that belongs to another is refused, not ignored.
 *
 * The bounds here are the UNION over the kinds carrying each name, and they have to be: a torus
 * takes one radial segment where a capsule takes three. The handler narrows to the kind in hand,
 * and `sceneHandlers.test.ts` holds both halves against `GEOMETRY_SPECS`.
 */
const GEOMETRY_FIELDS: readonly ActionField[] = [
  dial('width', { min: SMALLEST }),
  dial('height', { min: SMALLEST }),
  dial('depth', { min: SMALLEST }),
  dial('radius', { min: SMALLEST }),
  dial('radiusTop', { min: 0 }),
  dial('radiusBottom', { min: 0 }),
  dial('innerRadius', { min: 0 }),
  dial('outerRadius', { min: SMALLEST }),
  dial('tube', { min: SMALLEST }),
  count('segments', 3, 128),
  count('capSegments', 1, 128),
  count('radialSegments', 1, 128),
  count('widthSegments', 3, 128),
  count('heightSegments', 1, 128),
  count('tubularSegments', 3, 128),
  count('p', 1, 20),
  count('q', 1, 20),
]

/**
 * The maps a material wears, named by slot. A slot given an empty id is a map taken OFF, which
 * is the difference between "leave this one alone" and "there is none" — a client that could
 * only ever add one would have no way back.
 */
const TEXTURES: ActionField = {
  key: 'textures',
  kind: 'record',
  labelKey: 'assistant.fields.textures',
  required: false,
  options: [...TEXTURE_SLOTS],
}

/** Which control point of a rail, counted from the first. */
const POINT_INDEX: ActionField = {
  key: 'index',
  kind: 'integer',
  labelKey: 'assistant.fields.pointIndex',
  required: true,
  min: 0,
}

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
    /**
     * Marks shapes as tools for the next fold, or takes the mark off — Roblox's Negate, and the
     * one explicit way to say which way a cut runs through either door.
     */
    name: 'node.negate',
    titleKey: 'assistant.actions.nodeNegate.title',
    descriptionKey: 'assistant.actions.nodeNegate.description',
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
      { key: 'negative', kind: 'boolean', labelKey: 'assistant.fields.negative', required: false },
    ],
  }),
  action({
    /**
     * Folds shapes into one solid. The ORDER OF THE IDS says nothing — `carvePlan` elects the
     * matter, and `matterId` is what names one outright.
     */
    name: 'node.carve',
    titleKey: 'assistant.actions.nodeCarve.title',
    descriptionKey: 'assistant.actions.nodeCarve.description',
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
      {
        key: 'operation',
        kind: 'choice',
        labelKey: 'assistant.fields.csgOperation',
        required: true,
        options: CSG_OPERATIONS,
      },
      { key: 'matterId', kind: 'text', labelKey: 'assistant.fields.matterId', required: false },
    ],
  }),
  action({
    /**
     * The same fold run the other way — one call to repair a cut that came out inverted, where
     * the alternative is an undo and a rule to explain.
     */
    name: 'node.carveInvert',
    titleKey: 'assistant.actions.nodeCarveInvert.title',
    descriptionKey: 'assistant.actions.nodeCarveInvert.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [{ key: 'nodeId', kind: 'text', labelKey: 'assistant.fields.nodeId', required: true }],
  }),
  action({
    /** Undoes a fold: the brushes the graph kept come back as meshes, where they stood. */
    name: 'node.separate',
    titleKey: 'assistant.actions.nodeSeparate.title',
    descriptionKey: 'assistant.actions.nodeSeparate.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [NODE],
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
      RELATIVE,
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
    /**
     * A mesh's material, and a text's — one section of the inspector serves both, and they wear
     * the same descriptor. `tilesPerMetre` is the exception: a text's outline is not a primitive,
     * so its UVs never go through the tiling, and naming it on one is refused rather than filed.
     */
    name: 'node.material',
    titleKey: 'assistant.actions.nodeMaterial.title',
    descriptionKey: 'assistant.actions.nodeMaterial.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [
      NODE,
      { key: 'color', kind: 'color', labelKey: 'assistant.fields.colour', required: false },
      dial('roughness', { min: 0, max: 1 }),
      dial('metalness', { min: 0, max: 1 }),
      dial('tilesPerMetre', { min: TILES_PER_METRE.min, max: TILES_PER_METRE.max }),
      TEXTURES,
    ],
  }),
  action({
    name: 'node.geometry',
    titleKey: 'assistant.actions.nodeGeometry.title',
    descriptionKey: 'assistant.actions.nodeGeometry.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [NODE, ...GEOMETRY_FIELDS],
  }),
  action({
    /**
     * What a node does with light that is not its own. A light catches nothing and a sprite does
     * neither, so the field the node cannot hold is refused — which is the same row the inspector
     * hides rather than draws inert.
     */
    name: 'node.shadow',
    titleKey: 'assistant.actions.nodeShadow.title',
    descriptionKey: 'assistant.actions.nodeShadow.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [
      NODE,
      {
        key: 'castShadow',
        kind: 'boolean',
        labelKey: 'assistant.fields.castShadow',
        required: false,
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
    name: 'node.sprite',
    titleKey: 'assistant.actions.nodeSprite.title',
    descriptionKey: 'assistant.actions.nodeSprite.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [
      NODE,
      { key: 'color', kind: 'color', labelKey: 'assistant.fields.colour', required: false },
      dial('opacity', { min: 0, max: 1 }),
      // An empty id takes the picture off, exactly as the material's slots do.
      { key: 'map', kind: 'text', labelKey: 'assistant.fields.map', required: false },
    ],
  }),
  action({
    /**
     * What a text says, in what face, at what size. Its material is `node.material`'s — the same
     * bargain the inspector strikes, where one section lights both a mesh and a text.
     */
    name: 'node.text',
    titleKey: 'assistant.actions.nodeText.title',
    descriptionKey: 'assistant.actions.nodeText.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [
      NODE,
      { key: 'value', kind: 'text', labelKey: 'assistant.fields.value', required: false },
      { key: 'fontFamily', kind: 'text', labelKey: 'assistant.fields.fontFamily', required: false },
      {
        key: 'fontSource',
        kind: 'choice',
        labelKey: 'assistant.fields.fontSource',
        required: false,
        options: FONT_SOURCES,
      },
      dial('textSize', { min: SMALLEST }),
      dial('textDepth', { min: 0 }),
      count('curveSegments', 1, 32),
    ],
  }),
  action({
    /** The shape of a rail. Its points are `path.addPoint` and its two neighbours. */
    name: 'node.path',
    titleKey: 'assistant.actions.nodePath.title',
    descriptionKey: 'assistant.actions.nodePath.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [
      NODE,
      dial('tension', { min: 0, max: 1 }),
      { key: 'closed', kind: 'boolean', labelKey: 'assistant.fields.closed', required: false },
    ],
  }),
  action({
    /**
     * A control point added after the one named, halfway to its neighbour — the panel's own
     * button, which names none and lands at the end. A point of its own is what a client that
     * knows where the camera should pass gives instead.
     */
    name: 'path.addPoint',
    titleKey: 'assistant.actions.pathAddPoint.title',
    descriptionKey: 'assistant.actions.pathAddPoint.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [
      NODE,
      { ...POINT_INDEX, required: false },
      vector('x', 'point'),
      vector('y', 'point'),
      vector('z', 'point'),
    ],
  }),
  action({
    name: 'path.movePoint',
    titleKey: 'assistant.actions.pathMovePoint.title',
    descriptionKey: 'assistant.actions.pathMovePoint.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [NODE, POINT_INDEX, vector('x', 'point'), vector('y', 'point'), vector('z', 'point')],
  }),
  action({
    // Two points is the floor `withoutPoint` holds: one point is not a line.
    name: 'path.removePoint',
    titleKey: 'assistant.actions.pathRemovePoint.title',
    descriptionKey: 'assistant.actions.pathRemovePoint.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [NODE, POINT_INDEX],
  }),
  action({
    /**
     * The MATERIAL a model wears in ONE of its slots, named by the title of its document. An empty
     * title takes the whole dress off, and the model goes back to what its own file carries.
     *
     * A reference: what that material holds is resolved when the scene is read, so editing it
     * reaches every model wearing it. The slot is Blender's — a model carries one material per
     * primitive of its mesh, and a caller that names none means the first.
     */
    name: 'model.wearMaterial',
    titleKey: 'assistant.actions.modelWearMaterial.title',
    descriptionKey: 'assistant.actions.modelWearMaterial.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [
      NODE,
      { key: 'material', kind: 'text', labelKey: 'assistant.fields.material', required: false },
      {
        key: 'slot',
        kind: 'integer',
        labelKey: 'assistant.fields.materialSlot',
        required: false,
        min: 0,
        // A mesh of more primitives than this is not a model anyone dresses by hand, and the list
        // GROWS to reach the slot named: unbounded, one call could ask for a million rows.
        max: MATERIAL_SLOTS - 1,
      },
    ],
  }),
  action({
    /**
     * The simple way to cover a model: ONE picture as its base colour, which is what Roblox's
     * `TextureID` is. No asset takes the dress off.
     *
     * EXCLUSIVE with `model.wearMaterial`: a model is covered one way or the other, never both,
     * so this drops whatever materials it wore. Nothing is derived from the picture — a normal
     * computed from the luminance of a photograph turns painted shadow into relief.
     */
    name: 'model.wearImage',
    titleKey: 'assistant.actions.modelWearImage.title',
    descriptionKey: 'assistant.actions.modelWearImage.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [
      NODE,
      { key: 'assetId', kind: 'text', labelKey: 'assistant.fields.assetId', required: false },
    ],
  }),
  action({
    /**
     * Everything a light of any kind carries, in one action — the whole of the section the
     * inspector derives from the descriptor. What differs from kind to kind is which fields are
     * ACCEPTED: an ambient light has no cone and a hemisphere has no single colour, so naming one
     * where it does not belong is refused rather than filed against a field that is not there.
     */
    name: 'node.light',
    titleKey: 'assistant.actions.nodeLight.title',
    descriptionKey: 'assistant.actions.nodeLight.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [
      NODE,
      { key: 'color', kind: 'color', labelKey: 'assistant.fields.colour', required: false },
      // A hemisphere has these two INSTEAD of `color`, which is the whole reason it needs them.
      { key: 'skyColor', kind: 'color', labelKey: 'assistant.fields.skyColour', required: false },
      {
        key: 'groundColor',
        kind: 'color',
        labelKey: 'assistant.fields.groundColour',
        required: false,
      },
      dial('intensity', { min: 0 }),
      RELATIVE,
      // Zero means no falloff at all — three.js reads it as "reaches everywhere".
      dial('distance', { min: 0 }),
      dial('decay', { min: 0, max: 4 }),
      // Half-angle of the cone: a spot wider than a hemisphere lights nothing more.
      dial('angle', { min: 0.01, max: Math.PI / 2 }),
      dial('penumbra', { min: 0, max: 1 }),
      // Where the beam points, in the scene's own frame. Never a node: see `LightDescriptor`.
      vector('x', 'target'),
      vector('y', 'target'),
      vector('z', 'target'),
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
     * A rail LAID where the camera stands, aimed down its line of sight, and bound to the shot in
     * one gesture — the inspector's own button. `camera.rail` binds one that already exists; this
     * makes one, because a rail drives nothing without a shot to run it.
     */
    name: 'camera.addRail',
    titleKey: 'assistant.actions.cameraAddRail.title',
    descriptionKey: 'assistant.actions.cameraAddRail.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [{ key: 'shotId', kind: 'text', labelKey: 'assistant.fields.shotId', required: true }],
  }),
  action({
    /**
     * A camera's line moved up or down the band, which is what settles what the film looks
     * through: the stack decides, so moving a line changes the cut.
     */
    name: 'camera.reorder',
    titleKey: 'assistant.actions.cameraReorder.title',
    descriptionKey: 'assistant.actions.cameraReorder.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [NODE, { key: 'by', kind: 'integer', labelKey: 'assistant.fields.by', required: true }],
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
      // Absent, the node keeps the place it already has among its new siblings — which is what
      // hanging it somewhere means, and what dropping a row ONTO another does on screen.
      {
        key: 'index',
        kind: 'integer',
        labelKey: 'assistant.fields.nodeIndex',
        required: false,
        min: 0,
      },
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
  action({
    /**
     * A still of the view, into the project's pictures. The keyboard and the palette take the
     * view's own pixels; the four qualities are the menu's rows, and this is the only door onto
     * the other three.
     *
     * `none` for the reason `command.run scene.capture` already is: the picture lands in the
     * project's own library, which the studio treats as no question asked.
     */
    name: 'scene.capture',
    titleKey: 'assistant.actions.sceneCapture.title',
    descriptionKey: 'assistant.actions.sceneCapture.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [
      {
        key: 'quality',
        kind: 'choice',
        labelKey: 'assistant.fields.captureQuality',
        required: false,
        options: CAPTURE_QUALITIES,
      },
    ],
  }),
  action({
    /**
     * A ready-made world, in one call — the flyout of the environment panel. Each one is a PATCH
     * and leaves what it is not about exactly as it was, so a ground somebody turned on stays on.
     */
    name: 'world.preset',
    titleKey: 'assistant.actions.worldPreset.title',
    descriptionKey: 'assistant.actions.worldPreset.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [
      {
        key: 'preset',
        kind: 'choice',
        labelKey: 'assistant.fields.environmentPreset',
        required: true,
        options: ENVIRONMENT_PRESETS,
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
        // Its own label: this one multiplies what three.js maps down, where `exposure` elsewhere
        // is a count of stops on a grading dial. One sentence for two quantities said neither.
        labelKey: 'assistant.fields.toneExposure',
        required: false,
        min: EXPOSURE.min,
        max: EXPOSURE.max,
      },
    ],
  }),
]
