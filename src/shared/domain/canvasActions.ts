import { action, type ActionField, type AssistantAction } from './assistantAction'
import { BLEND_MODES } from './canvasBlend'

/**
 * The image workspace, driven by value rather than by gesture.
 *
 * The 48 canvas COMMANDS are gestures with no arguments — "brush tool", "zoom in", "undo" — so a
 * client could arm a tool and never say what to do with it. These take the values: which layer,
 * what opacity, where, how big.
 *
 * None of them names a document. They act on the image tab in front, which is the same rule
 * `command.run` follows, and `studio.state` says which one that is. A client changes it with
 * `document.activate` rather than by naming it here — one way of saying "the document I mean",
 * not two.
 *
 * What is NOT here, said plainly: painting. A stroke goes through the engine's GPU surface and
 * its patch history, which no command in `engines/canvas/commands.ts` exposes — `paintPixels`
 * takes a live port, not a path. Publishing it needs an engine API that does not exist yet.
 */

const LAYER: ActionField = {
  key: 'layerId',
  kind: 'text',
  labelKey: 'assistant.fields.layerId',
  required: true,
}

/**
 * How many sides a ring may take. Written out because `shapeGeometry.ts` cannot be imported from
 * here; `canvasHandlers.test.ts` holds this copy to `MIN_SIDES`/`MAX_SIDES`, and the dials too.
 */
const SIDES = { min: 3, max: 12 }

export const CANVAS_ACTIONS: readonly AssistantAction[] = [
  action({
    name: 'canvas.state',
    titleKey: 'assistant.actions.canvasState.title',
    descriptionKey: 'assistant.actions.canvasState.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [],
  }),
  action({
    name: 'layer.add',
    titleKey: 'assistant.actions.layerAdd.title',
    descriptionKey: 'assistant.actions.layerAdd.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [
      {
        key: 'kind',
        kind: 'choice',
        labelKey: 'assistant.fields.layerKind',
        required: true,
        options: ['pixel', 'text', 'adjustment', 'shape'],
      },
      { key: 'name', kind: 'text', labelKey: 'assistant.fields.name', required: true },
      { key: 'text', kind: 'longText', labelKey: 'assistant.fields.text', required: false },
      {
        key: 'shape',
        kind: 'choice',
        labelKey: 'assistant.fields.shape',
        required: false,
        options: ['rectangle', 'line', 'arrow', 'ellipse', 'polygon', 'star'],
      },
      { key: 'width', kind: 'number', labelKey: 'assistant.fields.width', required: false },
      { key: 'height', kind: 'number', labelKey: 'assistant.fields.height', required: false },
      {
        key: 'sides',
        kind: 'integer',
        labelKey: 'assistant.fields.sides',
        required: false,
        ...SIDES,
      },
      // `#rrggbb`, as every other colour of the registry — and as `layer.shape`, which repaints
      // what this one draws: two spellings of one concept had a client refused on its own value.
      { key: 'fill', kind: 'color', labelKey: 'assistant.fields.shapeFill', required: false },
      {
        key: 'adjustment',
        kind: 'choice',
        labelKey: 'assistant.fields.adjustment',
        required: false,
        options: ['exposure', 'contrast', 'saturation', 'temperature'],
      },
      { key: 'x', kind: 'number', labelKey: 'assistant.fields.x', required: false },
      { key: 'y', kind: 'number', labelKey: 'assistant.fields.y', required: false },
    ],
  }),
  action({
    name: 'layer.remove',
    titleKey: 'assistant.actions.layerRemove.title',
    descriptionKey: 'assistant.actions.layerRemove.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [LAYER],
  }),
  action({
    name: 'layer.select',
    titleKey: 'assistant.actions.layerSelect.title',
    descriptionKey: 'assistant.actions.layerSelect.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [LAYER],
  }),
  action({
    name: 'layer.rename',
    titleKey: 'assistant.actions.layerRename.title',
    descriptionKey: 'assistant.actions.layerRename.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [
      LAYER,
      { key: 'name', kind: 'text', labelKey: 'assistant.fields.name', required: true },
    ],
  }),
  action({
    /**
     * Every dial of a layer at once, and each one optional: a client that wants to change the
     * opacity alone must not have to restate the blend mode it did not read.
     */
    name: 'layer.style',
    titleKey: 'assistant.actions.layerStyle.title',
    descriptionKey: 'assistant.actions.layerStyle.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [
      LAYER,
      {
        key: 'opacity',
        kind: 'number',
        labelKey: 'assistant.fields.opacity',
        required: false,
        min: 0,
        max: 1,
      },
      {
        key: 'fillOpacity',
        kind: 'number',
        labelKey: 'assistant.fields.fillOpacity',
        required: false,
        min: 0,
        max: 1,
      },
      {
        key: 'blend',
        kind: 'choice',
        labelKey: 'assistant.fields.blend',
        required: false,
        options: BLEND_MODES,
      },
      { key: 'visible', kind: 'boolean', labelKey: 'assistant.fields.visible', required: false },
      { key: 'clipped', kind: 'boolean', labelKey: 'assistant.fields.clipped', required: false },
    ],
  }),
  action({
    name: 'layer.transform',
    titleKey: 'assistant.actions.layerTransform.title',
    descriptionKey: 'assistant.actions.layerTransform.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [
      LAYER,
      { key: 'x', kind: 'number', labelKey: 'assistant.fields.x', required: false },
      { key: 'y', kind: 'number', labelKey: 'assistant.fields.y', required: false },
      { key: 'scaleX', kind: 'number', labelKey: 'assistant.fields.scaleX', required: false },
      { key: 'scaleY', kind: 'number', labelKey: 'assistant.fields.scaleY', required: false },
      // Degrees, not radians: the state stores radians, and a client writing 90 for a quarter
      // turn is right more often than one writing 1.5707963.
      { key: 'rotation', kind: 'number', labelKey: 'assistant.fields.rotation', required: false },
    ],
  }),
  action({
    name: 'layer.text',
    titleKey: 'assistant.actions.layerText.title',
    descriptionKey: 'assistant.actions.layerText.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [
      LAYER,
      { key: 'text', kind: 'longText', labelKey: 'assistant.fields.text', required: false },
      {
        key: 'size',
        kind: 'number',
        labelKey: 'assistant.fields.fontSize',
        required: false,
        min: 1,
      },
      { key: 'color', kind: 'color', labelKey: 'assistant.fields.colour', required: false },
      {
        key: 'align',
        kind: 'choice',
        labelKey: 'assistant.fields.align',
        required: false,
        options: ['left', 'center', 'right', 'justify'],
      },
      { key: 'width', kind: 'number', labelKey: 'assistant.fields.width', required: false, min: 1 },
      {
        key: 'height',
        kind: 'number',
        labelKey: 'assistant.fields.height',
        required: false,
        min: 1,
      },
      {
        key: 'lineHeight',
        kind: 'number',
        labelKey: 'assistant.fields.lineHeight',
        required: false,
      },
      { key: 'tracking', kind: 'number', labelKey: 'assistant.fields.tracking', required: false },
      /**
       * The typeface, which `fonts.list` names and nothing could set — the one action of
       * discovery this registry published with no way to act on what it found.
       */
      {
        key: 'fontFamily',
        kind: 'text',
        labelKey: 'assistant.fields.fontFamily',
        required: false,
      },
      // Told apart rather than guessed: a machine that has Lato installed offers it under the
      // same name as the face the studio ships, and the two are not the same file.
      {
        key: 'fontSource',
        kind: 'choice',
        labelKey: 'assistant.fields.fontSource',
        required: false,
        options: ['embedded', 'system'],
      },
    ],
  }),
  action({
    name: 'layer.move',
    titleKey: 'assistant.actions.layerMove.title',
    descriptionKey: 'assistant.actions.layerMove.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [
      LAYER,
      { key: 'index', kind: 'integer', labelKey: 'assistant.fields.index', required: true, min: 0 },
      { key: 'parentId', kind: 'text', labelKey: 'assistant.fields.parentId', required: false },
    ],
  }),
  action({
    name: 'layer.duplicate',
    titleKey: 'assistant.actions.layerDuplicate.title',
    descriptionKey: 'assistant.actions.layerDuplicate.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [
      LAYER,
      { key: 'name', kind: 'text', labelKey: 'assistant.fields.name', required: false },
    ],
  }),
  action({
    name: 'layer.group',
    titleKey: 'assistant.actions.layerGroup.title',
    descriptionKey: 'assistant.actions.layerGroup.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [
      {
        key: 'layerIds',
        kind: 'text',
        labelKey: 'assistant.fields.layerIds',
        required: true,
        repeated: true,
      },
      { key: 'name', kind: 'text', labelKey: 'assistant.fields.name', required: true },
    ],
  }),
  action({
    name: 'layer.ungroup',
    titleKey: 'assistant.actions.layerUngroup.title',
    descriptionKey: 'assistant.actions.layerUngroup.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [LAYER],
  }),
  action({
    name: 'layer.mergeDown',
    titleKey: 'assistant.actions.layerMergeDown.title',
    descriptionKey: 'assistant.actions.layerMergeDown.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [LAYER],
  }),
  action({
    name: 'canvas.resize',
    titleKey: 'assistant.actions.canvasResize.title',
    descriptionKey: 'assistant.actions.canvasResize.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [
      { key: 'width', kind: 'integer', labelKey: 'assistant.fields.width', required: true, min: 1 },
      {
        key: 'height',
        kind: 'integer',
        labelKey: 'assistant.fields.height',
        required: true,
        min: 1,
      },
      // The difference between Image size and Canvas size, which every editor keeps apart: one
      // rescales the pixels, the other changes the frame around them.
      {
        key: 'scalePixels',
        kind: 'boolean',
        labelKey: 'assistant.fields.scalePixels',
        required: false,
      },
    ],
  }),
  action({
    name: 'canvas.crop',
    titleKey: 'assistant.actions.canvasCrop.title',
    descriptionKey: 'assistant.actions.canvasCrop.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [
      { key: 'x', kind: 'number', labelKey: 'assistant.fields.x', required: true },
      { key: 'y', kind: 'number', labelKey: 'assistant.fields.y', required: true },
      { key: 'width', kind: 'number', labelKey: 'assistant.fields.width', required: true, min: 1 },
      {
        key: 'height',
        kind: 'number',
        labelKey: 'assistant.fields.height',
        required: true,
        min: 1,
      },
    ],
  }),
  action({
    /**
     * The three padlocks of a layer, which every other action of this family is held by: a locked
     * layer refuses the very edits published beside this one, and nothing else could unlock it.
     */
    name: 'layer.lock',
    titleKey: 'assistant.actions.layerLock.title',
    descriptionKey: 'assistant.actions.layerLock.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [
      LAYER,
      { key: 'pixels', kind: 'boolean', labelKey: 'assistant.fields.lockPixels', required: false },
      {
        key: 'position',
        kind: 'boolean',
        labelKey: 'assistant.fields.lockPosition',
        required: false,
      },
      { key: 'alpha', kind: 'boolean', labelKey: 'assistant.fields.lockAlpha', required: false },
    ],
  }),
  action({
    /**
     * A shape stays a shape after it is drawn, which is the whole point of keeping its two points
     * rather than its pixels — and until now only the drawing could say what it was painted with.
     */
    name: 'layer.shape',
    titleKey: 'assistant.actions.layerShape.title',
    descriptionKey: 'assistant.actions.layerShape.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [
      LAYER,
      { key: 'filled', kind: 'boolean', labelKey: 'assistant.fields.shapeFilled', required: false },
      { key: 'fill', kind: 'color', labelKey: 'assistant.fields.shapeFill', required: false },
      {
        key: 'stroked',
        kind: 'boolean',
        labelKey: 'assistant.fields.shapeStroked',
        required: false,
      },
      { key: 'stroke', kind: 'color', labelKey: 'assistant.fields.shapeStroke', required: false },
      {
        key: 'strokeWidth',
        kind: 'number',
        labelKey: 'assistant.fields.strokeWidth',
        required: false,
        min: 1,
      },
      {
        key: 'sides',
        kind: 'integer',
        labelKey: 'assistant.fields.sides',
        required: false,
        ...SIDES,
      },
    ],
  }),
  action({
    /**
     * One dial per layer, and the layer says which — `canvas.state` carries it. Four fields rather
     * than a bare number because each dial swings its own range, and a schema is where a client
     * should read that rather than by being refused.
     */
    name: 'layer.adjustment',
    titleKey: 'assistant.actions.layerAdjustment.title',
    descriptionKey: 'assistant.actions.layerAdjustment.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [
      LAYER,
      {
        key: 'exposure',
        kind: 'number',
        labelKey: 'assistant.fields.exposure',
        required: false,
        min: -3,
        max: 3,
      },
      {
        key: 'contrast',
        kind: 'number',
        labelKey: 'assistant.fields.contrast',
        required: false,
        min: 0,
        max: 2,
      },
      {
        key: 'saturation',
        kind: 'number',
        labelKey: 'assistant.fields.saturation',
        required: false,
        min: 0,
        max: 2,
      },
      {
        key: 'temperature',
        kind: 'number',
        labelKey: 'assistant.fields.temperature',
        required: false,
        min: -1,
        max: 1,
      },
    ],
  }),
  action({
    name: 'canvas.orient',
    titleKey: 'assistant.actions.canvasOrient.title',
    descriptionKey: 'assistant.actions.canvasOrient.description',
    commitment: 'none',
    reach: 'mcp',
    fields: [
      {
        key: 'turn',
        kind: 'choice',
        labelKey: 'assistant.fields.turn',
        required: true,
        options: ['flipHorizontal', 'flipVertical', 'rotateClockwise', 'rotateAnticlockwise'],
      },
    ],
  }),
]
