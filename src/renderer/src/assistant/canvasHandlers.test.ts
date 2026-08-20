import { beforeEach, describe, expect, it } from 'vitest'
import { assistantAction, type ActionName } from '@shared/domain/assistant'
import { BLEND_MODES } from '@shared/domain/canvasBlend'
import {
  ADJUSTMENT_KINDS,
  DEFAULT_CANVAS,
  LAYER_KINDS,
  pixelLayer,
  textLayer,
  type CanvasState,
} from '@/engines/canvas/canvasState'
import { installIn } from '@/stores/document-fixtures'
import { canvasOf, canvasStore, useCanvases } from '@/stores/canvases'
import { useDocuments } from '@/stores/documents'
import { runAction } from './executor'

const DOCUMENT = 'doc-image'

function canvas(): CanvasState {
  return canvasOf(useCanvases.getState(), DOCUMENT)
}

function withLayers(...layers: CanvasState['layers']): void {
  installIn(canvasStore, DOCUMENT, { ...DEFAULT_CANVAS, layers }, 'image')
}

const layerIds = (): string[] => canvas().layers.map(layer => layer.id)

beforeEach(() => {
  withLayers(pixelLayer('layer-a', 'Fond'), pixelLayer('layer-b', 'Sujet'))
})

/**
 * Every other closed field of the registry reads its source — `MODEL_FAMILIES`, `ASSET_TYPES`,
 * `WORKSPACE_IDS`, the three scene registries. The image family cannot: blend modes and
 * adjustment kinds live in `engines/canvas`, which `shared/` may not import, so they are written
 * out by hand there. This is what holds the copies to their originals, and it has to live on this
 * side of the boundary for the same reason.
 */
describe('what the registry offers a layer', () => {
  const optionsOf = (name: ActionName, key: string): string[] =>
    [...(assistantAction(name)?.fields.find(field => field.key === key)?.options ?? [])].sort()

  it('is exactly what the engine declares', () => {
    expect(optionsOf('layer.style', 'blend')).toEqual([...BLEND_MODES].sort())
    expect(optionsOf('layer.add', 'adjustment')).toEqual([...ADJUSTMENT_KINDS].sort())
    // Every kind but `group`, which is made by grouping a selection rather than added.
    expect(optionsOf('layer.add', 'kind')).toEqual(
      LAYER_KINDS.filter(kind => kind !== 'group').sort(),
    )
  })
})

describe('reading the image in front', () => {
  it('answers the frame and the whole stack, groups walked into', async () => {
    const outcome = await runAction('canvas.state', {})

    expect(outcome).toMatchObject({
      ok: true,
      data: { documentId: DOCUMENT, width: DEFAULT_CANVAS.width, height: DEFAULT_CANVAS.height },
    })
    const read = outcome.ok ? (outcome.data as { layers: { id: string }[] }) : null
    expect(read?.layers.map(one => one.id)).toEqual(['layer-a', 'layer-b'])
  })

  /**
   * The rule `command.run` already follows: an action of this family speaks to the image tab in
   * front, and there is no second way of naming a document. Without a check the commands would
   * run against a default state and report success.
   */
  it('refuses every action of the family while no image is in front', async () => {
    useDocuments.setState({ documents: {}, activeId: null })

    expect(await runAction('canvas.state', {})).toEqual({ ok: false, refusal: 'wrongSurface' })
    expect(await runAction('layer.remove', { layerId: 'layer-a' })).toEqual({
      ok: false,
      refusal: 'wrongSurface',
    })
  })
})

describe('building a stack', () => {
  it('adds a layer and answers the id it was given', async () => {
    const outcome = await runAction('layer.add', { kind: 'pixel', name: 'Ciel' })
    const added = outcome.ok ? (outcome.data as { layerId: string }) : null

    expect(added?.layerId).toBeTruthy()
    expect(canvas().layers.at(-1)?.name).toBe('Ciel')
  })

  /** A client has a rectangle, not a hand: the box is what it names, and the two points follow. */
  it('draws a shape from the box a client names', async () => {
    await runAction('layer.add', {
      kind: 'shape',
      name: 'Cadre',
      shape: 'rectangle',
      x: 10,
      y: 20,
      width: 100,
      height: 50,
      fill: 0xff0000,
    })

    const added = canvas().layers.at(-1)
    if (added?.kind !== 'shape') throw new Error('the layer added is not a shape')

    // Read through the transform, which is where the box really lands: the layer's own space
    // starts at the corner of what the shape REACHES, a stroke's overhang included.
    expect({ x: added.transform.x + added.from.x, y: added.transform.y + added.from.y }).toEqual({
      x: 10,
      y: 20,
    })
    expect({ x: added.transform.x + added.to.x, y: added.transform.y + added.to.y }).toEqual({
      x: 110,
      y: 70,
    })
    expect(added.fill).toBe(0xff0000)
  })

  /**
   * A line and an arrow have no inside: `paintShape` leaves their path open on purpose, so a
   * fill paints nothing at all. The layer listed in the stack and drew a blank.
   */
  it('strokes the two shapes that have no inside, rather than filling them', async () => {
    await runAction('layer.add', {
      kind: 'shape',
      name: 'Trait',
      shape: 'line',
      width: 100,
      height: 100,
      fill: 0x00ff00,
    })

    const added = canvas().layers.at(-1)
    expect(added?.kind === 'shape' && added.fill).toBeNull()
    expect(added?.kind === 'shape' && added.stroke?.color).toBe(0x00ff00)
  })

  // A ring reaches its far point from the CENTRE, so a box wider than it is tall used to put the
  // top of the star at a negative y — outside the layer's texture, and clipped away.
  it('keeps a star inside its own texture whatever the box is shaped like', async () => {
    await runAction('layer.add', {
      kind: 'shape',
      name: 'Étoile',
      shape: 'star',
      width: 200,
      height: 50,
    })

    const added = canvas().layers.at(-1)
    if (added?.kind !== 'shape') throw new Error('the layer added is not a shape')

    expect(added.from.x).toBeGreaterThanOrEqual(0)
    expect(added.from.y).toBeGreaterThanOrEqual(0)
    expect(added.to.y).toBeGreaterThanOrEqual(0)
  })

  // A shape with no box is a layer with nothing on it, which nothing on screen could show.
  it('refuses a shape that names no box', async () => {
    expect(await runAction('layer.add', { kind: 'shape', name: 'Cadre' })).toEqual({
      ok: false,
      refusal: 'badInput',
    })
  })

  /**
   * A caption added by a client is a POINT one, having no box — naming a width is what gives it
   * one. The other axis then starts at the paragraph default rather than at nothing.
   */
  it('gives a point caption a box the first time a client names one', async () => {
    await runAction('layer.add', { kind: 'text', name: 'Titre', text: 'Bonjour' })
    const id = canvas().layers.at(-1)?.id
    expect(canvas().layers.at(-1)?.kind === 'text' && canvas().layers.at(-1)).toMatchObject({
      box: null,
    })

    await runAction('layer.text', { layerId: id, width: 900, align: 'center' })

    const written = canvas().layers.at(-1)
    if (written?.kind !== 'text') throw new Error('the layer is not a caption')
    expect(written.box?.width).toBe(900)
    expect(written.box?.height).toBeGreaterThan(0)
    expect(written.align).toBe('center')
  })

  /** One axis at a time: a client naming only a width must not flatten the height with it. */
  it('resizes a caption box on the axis it names, and on that one only', async () => {
    await runAction('layer.add', { kind: 'text', name: 'Titre', text: 'Bonjour' })
    const id = canvas().layers.at(-1)?.id
    await runAction('layer.text', { layerId: id, width: 900, height: 400 })

    await runAction('layer.text', { layerId: id, width: 500 })

    const written = canvas().layers.at(-1)
    if (written?.kind !== 'text') throw new Error('the layer is not a caption')
    expect(written.box).toEqual({ width: 500, height: 400 })
  })

  // A row in the panel that changes nothing is the one thing a layer must never be.
  it('refuses an adjustment layer that names no dial', async () => {
    expect(await runAction('layer.add', { kind: 'adjustment', name: 'Étalonnage' })).toEqual({
      ok: false,
      refusal: 'badInput',
    })
    expect(canvas().layers).toHaveLength(2)
  })

  it('removes, renames and reorders by id', async () => {
    await runAction('layer.rename', { layerId: 'layer-a', name: 'Ciel' })
    expect(canvas().layers[0]?.name).toBe('Ciel')

    await runAction('layer.move', { layerId: 'layer-a', index: 1 })
    expect(layerIds()).toEqual(['layer-b', 'layer-a'])

    await runAction('layer.remove', { layerId: 'layer-b' })
    expect(layerIds()).toEqual(['layer-a'])
  })

  /**
   * A command whose layer is gone answers by returning the state untouched, so without this
   * check every miss would be reported as done — the whole reason the id is looked up first.
   */
  it('refuses a layer the stack does not hold rather than reporting a no-op as done', async () => {
    expect(await runAction('layer.rename', { layerId: 'layer-z', name: 'Rien' })).toEqual({
      ok: false,
      refusal: 'notFound',
    })
  })

  it('groups, ungroups and duplicates, answering the new ids', async () => {
    const grouped = await runAction('layer.group', {
      layerIds: ['layer-a', 'layer-b'],
      name: 'Décor',
    })
    const groupId = grouped.ok ? (grouped.data as { layerId: string }).layerId : ''
    expect(canvas().layers.map(one => one.kind)).toEqual(['group'])

    const copy = await runAction('layer.duplicate', { layerId: groupId })
    expect(copy).toMatchObject({ ok: true })
    expect(canvas().layers).toHaveLength(2)

    await runAction('layer.ungroup', { layerId: groupId })
    expect(canvas().layers.some(one => one.id === groupId)).toBe(false)
  })

  /**
   * `groupLayers` gathers TOP-LEVEL layers only and hands the state back when it finds none, so
   * an id that names nothing — or one already inside a group — was answered with the id of a
   * group no layer carries.
   */
  it('refuses to group an id that is not a layer of the top level', async () => {
    expect(await runAction('layer.group', { layerIds: ['layer-z'], name: 'Décor' })).toEqual({
      ok: false,
      refusal: 'notFound',
    })
    expect(canvas().layers.map(one => one.kind)).toEqual(['pixel', 'pixel'])
  })

  /** `moveLayer` refuses a parent that is no group by handing the state back — done, said twice. */
  it('refuses a move under something that is not a group', async () => {
    expect(
      await runAction('layer.move', { layerId: 'layer-a', parentId: 'layer-b', index: 0 }),
    ).toEqual({ ok: false, refusal: 'badInput' })
    expect(layerIds()).toEqual(['layer-a', 'layer-b'])
  })

  /** `textLayer` names a layer after its own text; the name asked for is what a client looks up. */
  it('keeps the name a text layer was asked for, not its text', async () => {
    await runAction('layer.add', { kind: 'text', name: 'Titre', text: 'Générique' })

    expect(canvas().layers.at(-1)?.name).toBe('Titre')
  })
})

describe('styling and placing a layer', () => {
  it('changes only the dials it was given', async () => {
    await runAction('layer.style', { layerId: 'layer-a', opacity: 0.5 })

    expect(canvas().layers[0]).toMatchObject({ opacity: 0.5, blend: 'normal', visible: true })
  })

  /**
   * Three dials, three entries, and that is the right answer rather than a shortcoming: history
   * coalescing merges commands that share an `id`, keeping the FIRST one's `revert` — a gesture
   * around three different dials would undo the opacity and leave the blend mode set.
   */
  it('takes several dials in one call, each undoable on its own', async () => {
    await runAction('layer.style', {
      layerId: 'layer-a',
      opacity: 0.2,
      blend: 'multiply',
      visible: false,
    })

    expect(canvas().layers[0]).toMatchObject({ opacity: 0.2, blend: 'multiply', visible: false })
    expect(useCanvases.getState().histories[DOCUMENT]?.past).toHaveLength(3)
  })

  // Degrees in, radians stored: a client writing 90 for a quarter turn is right more often than
  // one writing 1.5707963.
  it('takes a rotation in degrees and keeps every value it was not given', async () => {
    await runAction('layer.transform', { layerId: 'layer-a', x: 40, rotation: 90 })

    expect(canvas().layers[0]?.transform).toMatchObject({ x: 40, rotation: Math.PI / 2, scaleX: 1 })
  })

  it('writes a text layer’s words, and refuses one that holds pixels', async () => {
    withLayers(textLayer('layer-t', 'Titre', { x: 0, y: 0 }), pixelLayer('layer-p', 'Fond'))

    await runAction('layer.text', { layerId: 'layer-t', text: 'Générique', size: 64 })
    expect(canvas().layers[0]).toMatchObject({ text: 'Générique', size: 64 })

    expect(await runAction('layer.text', { layerId: 'layer-p', text: 'Rien' })).toEqual({
      ok: false,
      refusal: 'badInput',
    })
  })

  it('reads a colour written as #rrggbb', async () => {
    withLayers(textLayer('layer-t', 'Titre', { x: 0, y: 0 }))

    await runAction('layer.text', { layerId: 'layer-t', color: '#ff8800' })
    expect(canvas().layers[0]).toMatchObject({ color: 0xff8800 })
  })
})

describe('the frame itself', () => {
  it('resizes the frame alone, and rescales the layers when asked', async () => {
    await runAction('canvas.resize', { width: 800, height: 600 })
    expect(canvas()).toMatchObject({ width: 800, height: 600 })

    await runAction('canvas.resize', { width: 400, height: 300, scalePixels: true })
    expect(canvas()).toMatchObject({ width: 400, height: 300 })
  })

  it('crops to a rectangle and turns the frame a quarter turn', async () => {
    await runAction('canvas.crop', { x: 0, y: 0, width: 100, height: 200 })
    expect(canvas()).toMatchObject({ width: 100, height: 200 })

    await runAction('canvas.orient', { turn: 'rotateClockwise' })
    expect(canvas()).toMatchObject({ width: 200, height: 100 })
  })
})
