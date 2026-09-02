import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { assistantAction, type ActionName } from '@shared/domain/assistant'
import { BLEND_MODES } from '@shared/domain/canvasBlend'
import { EMBEDDED_FONTS } from '@shared/domain/font'
import {
  ADJUSTMENT_KINDS,
  DEFAULT_CANVAS,
  DIAL_RANGE,
  GUIDE_AXES,
  LAYER_KINDS,
  pixelLayer,
  textLayer,
  type CanvasState,
} from '@/engines/canvas/canvasState'
import { MAX_SIDES, MIN_SIDES } from '@/engines/canvas/shapeGeometry'
import { holdCanvas } from '@/features/image/canvasHosts'
import { canvasHostStub } from '@/stores/canvas-fixtures'
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

/** By name rather than by index: a layer the stack was asked to add does not land at a known one. */
const layerNamed = (name: string): CanvasState['layers'][number] | undefined =>
  canvas().layers.find(layer => layer.name === name)

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
    expect(optionsOf('layer.setOpacityBlendAndVisibility', 'blend')).toEqual(
      [...BLEND_MODES].sort(),
    )
    expect(optionsOf('layer.add', 'adjustment')).toEqual([...ADJUSTMENT_KINDS].sort())
    // Every kind but `group`, which is made by grouping a selection rather than added.
    expect(optionsOf('layer.add', 'kind')).toEqual(
      LAYER_KINDS.filter(kind => kind !== 'group').sort(),
    )
  })

  /**
   * The BOUNDS travel the same way as the options, and were the half nothing held: a schema that
   * offers a wider swing than the slider is a client told it may write what the panel cannot.
   */
  it('bounds every dial exactly as the engine does', () => {
    const boundsOf = (name: ActionName, key: string) => {
      const field = assistantAction(name)?.fields.find(one => one.key === key)
      return { min: field?.min, max: field?.max }
    }

    for (const kind of ADJUSTMENT_KINDS) {
      expect(boundsOf('layer.setAdjustmentAmount', kind), kind).toEqual(DIAL_RANGE[kind])
    }

    expect(boundsOf('layer.editShapeLayer', 'sides')).toEqual({ min: MIN_SIDES, max: MAX_SIDES })
    expect(boundsOf('layer.add', 'sides')).toEqual({ min: MIN_SIDES, max: MAX_SIDES })
  })
})

describe('what a layer stands at', () => {
  /**
   * 🛑 Left out and read as the default: a layer is drawn, whole, unlocked, blended normally,
   * uncut and untransformed. Written whole, one cost 290 characters — a stack of four came back
   * cut before the layer a sentence named.
   */
  it('leaves out what a fresh layer already holds', async () => {
    const outcome = await runAction('canvas.state', {})
    const [layer] = outcome.ok
      ? ((outcome.data as { layers: Record<string, unknown>[] }).layers ?? [])
      : []

    expect(layer).toHaveProperty('id')
    for (const key of [
      'visible',
      'opacity',
      'fillOpacity',
      'locked',
      'blend',
      'clipped',
      'transform',
    ])
      expect(layer).not.toHaveProperty(key)
  })
})

describe('the pixel-art grid, driven by value', () => {
  let drop = (): void => {}
  afterEach(() => {
    drop()
    drop = (): void => {}
  })

  const onGrid = (cell: number): void =>
    installIn(
      canvasStore,
      DOCUMENT,
      {
        ...DEFAULT_CANVAS,
        width: 512,
        height: 512,
        pixelCell: cell,
        layers: [pixelLayer('l', 'L')],
      },
      'image',
    )

  // Set in CELLS, which is how a person says it — the handler turns them into the document's size.
  it('sizes the document from a count of cells', async () => {
    expect(
      await runAction('canvas.setPixelArt', { enabled: true, columns: 32, rows: 32, cell: 2 }),
    ).toMatchObject({ ok: true })

    expect([canvas().width, canvas().height, canvas().pixelCell]).toEqual([64, 64, 2])
  })

  it('reads the grid back in cells, and says nothing of it when there is none', async () => {
    onGrid(16)
    const held = await runAction('canvas.state', {})
    expect(held).toMatchObject({
      ok: true,
      data: { pixelArt: { cell: 16, columns: 32, rows: 32 } },
    })

    await runAction('canvas.setPixelArt', { enabled: false })
    const gone = await runAction('canvas.state', {})
    expect(gone.ok && 'pixelArt' in (gone.data as object)).toBe(false)
  })

  it('refuses to draw on an image that is not on a grid', async () => {
    expect(
      await runAction('canvas.drawPixels', { shape: 'points', cells: ['1,1'], color: '#ff0000' }),
    ).toMatchObject({ ok: false, refusal: 'badInput' })
  })

  // One of the two and never both: a call that named a colour AND asked to erase means neither.
  it('refuses a colour and an erasure together, and refuses neither', async () => {
    onGrid(16)

    expect(
      await runAction('canvas.drawPixels', {
        shape: 'points',
        cells: ['1,1'],
        color: '#ff0000',
        erase: true,
      }),
    ).toMatchObject({ ok: false, refusal: 'badInput' })
    expect(await runAction('canvas.drawPixels', { shape: 'points', cells: ['1,1'] })).toMatchObject(
      {
        ok: false,
        refusal: 'badInput',
      },
    )
  })

  /**
   * Outside the grid is DROPPED, never folded back: a cell at 40 on a grid of 32 is a mistake,
   * and painting it at 8 would answer a request nobody made.
   */
  it('refuses when every cell asked for falls outside the grid', async () => {
    onGrid(16)

    expect(
      await runAction('canvas.drawPixels', { shape: 'points', cells: ['99,99'], color: '#ff0000' }),
    ).toMatchObject({ ok: false, refusal: 'badInput' })
  })

  // 🛑 One count alone was DROPPED and answered `ok`: the model then placed its cells on a grid
  // of the document's own size, believing it had asked for 32.
  it('refuses one count of a grid without the other', async () => {
    expect(await runAction('canvas.setPixelArt', { enabled: true, columns: 32 })).toMatchObject({
      ok: false,
      refusal: 'badInput',
    })
  })

  /**
   * By id OR by NAME, as every other layer gesture of this file: `canvas.state` answers both, and
   * a name copied out of it came back « no such layer ».
   */
  it('finds the layer a call names, and says so when nothing answers to it', async () => {
    onGrid(16)

    expect(
      await runAction('canvas.drawPixels', {
        shape: 'points',
        cells: ['1,1'],
        color: '#ff0000',
        layerId: 'Nowhere',
      }),
    ).toMatchObject({ ok: false, refusal: 'notFound' })
  })

  // The three shapes the points case does not reach: a rectangle hollow or filled, a line between
  // two corners, and a fill falling back on the whole layer when no box is named.
  it('lays each shape on the cells it covers', async () => {
    onGrid(16)
    const laid: number[] = []
    drop = holdCanvas(DOCUMENT, () =>
      canvasHostStub({
        paintCells: (_layer, rects) => {
          laid.push(rects.length)
          return true
        },
      }),
    )

    const red = { color: '#ff0000' }
    await runAction('canvas.drawPixels', { shape: 'rectangle', x: 0, y: 0, toX: 3, toY: 3, ...red })
    await runAction('canvas.drawPixels', {
      shape: 'rectangle',
      x: 0,
      y: 0,
      toX: 3,
      toY: 3,
      filled: true,
      ...red,
    })
    await runAction('canvas.drawPixels', { shape: 'line', x: 0, y: 0, toX: 5, toY: 5, ...red })
    await runAction('canvas.drawPixels', { shape: 'fill', ...red })

    expect(laid).toEqual([12, 16, 6, 32 * 32])
  })

  /**
   * 🛑 A box far larger than the grid is CLIPPED before it is walked, never after: every cell it
   * drops was going to be dropped anyway, and « fill 0 to 99 999 » cost 264 ms of the UI thread.
   */
  it('fills the part of an oversized box that lands on the grid', async () => {
    onGrid(16)
    const laid: number[] = []
    drop = holdCanvas(DOCUMENT, () =>
      canvasHostStub({
        paintCells: (_layer, rects) => {
          laid.push(rects.length)
          return true
        },
      }),
    )

    await runAction('canvas.drawPixels', {
      shape: 'rectangle',
      x: 0,
      y: 0,
      toX: 99_999,
      toY: 99_999,
      filled: true,
      color: '#ff0000',
    })

    expect(laid).toEqual([32 * 32])
  })

  // 🛑 `Number('')` is zero, so a bare "3" used to land on row nought without a word said.
  it('refuses a cell that does not name both of its coordinates', async () => {
    onGrid(16)

    expect(
      await runAction('canvas.drawPixels', { shape: 'points', cells: ['3'], color: '#ff0000' }),
    ).toMatchObject({ ok: false, refusal: 'badInput' })
    expect(
      await runAction('canvas.drawPixels', { shape: 'points', cells: ['3,'], color: '#ff0000' }),
    ).toMatchObject({ ok: false, refusal: 'badInput' })
  })

  // No engine is mounted under a headless run, so the port answers nothing and the refusal names
  // what a caller can act on rather than reporting a success that painted nothing.
  it('says so when nothing was painted', async () => {
    onGrid(16)

    expect(
      await runAction('canvas.drawPixels', { shape: 'points', cells: ['1,1'], color: '#ff0000' }),
    ).toMatchObject({ ok: false, refusal: 'notFound' })
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
   * The rule `command.runStudioCommand` already follows: an action of this family speaks to the image tab in
   * front, and there is no second way of naming a document. Without a check the commands would
   * run against a default state and report success.
   */
  it('refuses every action of the family while no image is in front', async () => {
    useDocuments.setState({ documents: {}, activeId: null })

    expect(await runAction('canvas.state', {})).toMatchObject({
      ok: false,
      refusal: 'wrongSurface',
    })
    expect(await runAction('layer.remove', { layerId: 'layer-a' })).toMatchObject({
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
      fill: '#ff0000',
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
      fill: '#00ff00',
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
    expect(await runAction('layer.add', { kind: 'shape', name: 'Cadre' })).toMatchObject({
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

    await runAction('layer.editTextLayer', { layerId: id, width: 900, align: 'center' })

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
    await runAction('layer.editTextLayer', { layerId: id, width: 900, height: 400 })

    await runAction('layer.editTextLayer', { layerId: id, width: 500 })

    const written = canvas().layers.at(-1)
    if (written?.kind !== 'text') throw new Error('the layer is not a caption')
    expect(written.box).toEqual({ width: 500, height: 400 })
  })

  // A row in the panel that changes nothing is the one thing a layer must never be.
  it('refuses an adjustment layer that names no dial', async () => {
    expect(await runAction('layer.add', { kind: 'adjustment', name: 'Étalonnage' })).toMatchObject({
      ok: false,
      refusal: 'badInput',
    })
    expect(canvas().layers).toHaveLength(2)
  })

  it('removes, renames and reorders by id', async () => {
    await runAction('layer.rename', { layerId: 'layer-a', name: 'Ciel' })
    expect(canvas().layers[0]?.name).toBe('Ciel')

    await runAction('layer.reorderInStack', { layerId: 'layer-a', index: 1 })
    expect(layerIds()).toEqual(['layer-b', 'layer-a'])

    await runAction('layer.remove', { layerId: 'layer-b' })
    expect(layerIds()).toEqual(['layer-a'])
  })

  /**
   * A command whose layer is gone answers by returning the state untouched, so without this
   * check every miss would be reported as done — the whole reason the id is looked up first.
   */
  it('refuses a layer the stack does not hold rather than reporting a no-op as done', async () => {
    expect(await runAction('layer.rename', { layerId: 'layer-z', name: 'Rien' })).toMatchObject({
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
   * 🛑 By NAME as well as by id, as every other layer gesture: a name copied out of `canvas.state`
   * was answered « not at the top of the stack », which blames the stack for a lookup never made.
   */
  it('groups the layers a call names, not only the ones it numbers', async () => {
    expect(
      await runAction('layer.group', { layerIds: ['Fond', 'Sujet'], name: 'Décor' }),
    ).toMatchObject({ ok: true })

    expect(canvas().layers.map(one => one.kind)).toEqual(['group'])
  })

  /**
   * `groupLayers` gathers TOP-LEVEL layers only and hands the state back when it finds none, so
   * an id that names nothing — or one already inside a group — was answered with the id of a
   * group no layer carries.
   */
  it('refuses to group an id that is not a layer of the top level', async () => {
    expect(await runAction('layer.group', { layerIds: ['layer-z'], name: 'Décor' })).toMatchObject({
      ok: false,
      refusal: 'notFound',
    })
    expect(canvas().layers.map(one => one.kind)).toEqual(['pixel', 'pixel'])
  })

  /** `moveLayer` refuses a parent that is no group by handing the state back — done, said twice. */
  it('refuses a move under something that is not a group', async () => {
    expect(
      await runAction('layer.reorderInStack', {
        layerId: 'layer-a',
        parentId: 'layer-b',
        index: 0,
      }),
    ).toMatchObject({ ok: false, refusal: 'badInput' })
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
    await runAction('layer.setOpacityBlendAndVisibility', { layerId: 'layer-a', opacity: 0.5 })

    expect(canvas().layers[0]).toMatchObject({ opacity: 0.5, blend: 'normal', visible: true })
  })

  /**
   * Three dials, three entries, and that is the right answer rather than a shortcoming: history
   * coalescing merges commands that share an `id`, keeping the FIRST one's `revert` — a gesture
   * around three different dials would undo the opacity and leave the blend mode set.
   */
  it('takes several dials in one call, each undoable on its own', async () => {
    await runAction('layer.setOpacityBlendAndVisibility', {
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

  it('answers the dials it set, and only those', async () => {
    expect(
      await runAction('layer.setOpacityBlendAndVisibility', {
        layerId: 'layer-a',
        opacity: 0.5,
        blend: 'multiply',
      }),
    ).toEqual({ ok: true, data: { opacity: 0.5, blend: 'multiply' } })
  })

  it('answers where the layer landed, the rotation in degrees as it came in', async () => {
    expect(
      await runAction('layer.transform', {
        layerId: 'layer-a',
        x: 10,
        rotation: 90,
        relative: true,
      }),
    ).toEqual({ ok: true, data: { x: 10, rotation: 90 } })
  })

  it('writes a text layer’s words, and refuses one that holds pixels', async () => {
    withLayers(textLayer('layer-t', 'Titre', { x: 0, y: 0 }), pixelLayer('layer-p', 'Fond'))

    await runAction('layer.editTextLayer', { layerId: 'layer-t', text: 'Générique', size: 64 })
    expect(canvas().layers[0]).toMatchObject({ text: 'Générique', size: 64 })

    expect(
      await runAction('layer.editTextLayer', { layerId: 'layer-p', text: 'Rien' }),
    ).toMatchObject({
      ok: false,
      refusal: 'badInput',
    })
  })

  it('reads a colour written as #rrggbb', async () => {
    withLayers(textLayer('layer-t', 'Titre', { x: 0, y: 0 }))

    await runAction('layer.editTextLayer', { layerId: 'layer-t', color: '#ff8800' })
    expect(canvas().layers[0]).toMatchObject({ color: 0xff8800 })
  })

  /**
   * `fonts.list` named faces nothing could then set — the one action of discovery this registry
   * published with no way to act on what it found.
   */
  it('sets the typeface, telling a shipped face from an installed one', async () => {
    withLayers(textLayer('layer-t', 'Titre', { x: 0, y: 0 }))

    await runAction('layer.editTextLayer', { layerId: 'layer-t', fontFamily: 'Helvetica Neue' })
    expect(canvas().layers[0]).toMatchObject({
      font: { source: 'system', family: 'Helvetica Neue' },
    })

    const shipped = EMBEDDED_FONTS[0]?.family ?? ''
    await runAction('layer.editTextLayer', { layerId: 'layer-t', fontFamily: shipped })

    expect(canvas().layers[0]).toMatchObject({ font: { source: 'embedded', family: shipped } })
  })

  /**
   * `source` carries one promise — that the document opens the same on the next machine — and an
   * `embedded` face the studio does not ship breaks exactly that one, silently.
   */
  it('refuses a face claimed as shipped that the studio does not ship', async () => {
    withLayers(textLayer('layer-t', 'Titre', { x: 0, y: 0 }))

    const outcome = await runAction('layer.editTextLayer', {
      layerId: 'layer-t',
      fontFamily: 'Helvetica Neue',
      fontSource: 'embedded',
    })

    expect(outcome).toMatchObject({ ok: false, refusal: 'badInput' })
  })
})

describe('the padlocks of a layer', () => {
  it('sets the one it was given and leaves the others alone', async () => {
    await runAction('layer.lock', { layerId: 'layer-a', pixels: true })

    expect(canvas().layers[0]?.locked).toEqual({ pixels: true, position: false, alpha: false })

    await runAction('layer.lock', { layerId: 'layer-a', alpha: true })

    expect(canvas().layers[0]?.locked).toEqual({ pixels: true, position: false, alpha: true })
  })

  it('refuses a call that names no padlock', async () => {
    expect(await runAction('layer.lock', { layerId: 'layer-a' })).toMatchObject({
      ok: false,
      refusal: 'badInput',
    })
  })
})

describe('repainting a shape long after it was drawn', () => {
  const drawn = async (): Promise<string> => {
    const made = await runAction('layer.add', {
      kind: 'shape',
      name: 'Cadre',
      shape: 'rectangle',
      width: 100,
      height: 50,
    })
    return made.ok ? (made.data as { layerId: string }).layerId : ''
  }

  it('changes the fill and the outline of a shape already on the stack', async () => {
    const layerId = await drawn()

    await runAction('layer.editShapeLayer', {
      layerId,
      fill: '#ff0000',
      stroke: '#0000ff',
      strokeWidth: 6,
    })

    expect(layerNamed('Cadre')).toMatchObject({
      fill: 0xff0000,
      stroke: { color: 0x0000ff, width: 6 },
    })
  })

  // The panel hides the fill switch for these two, and `paintShape` leaves their path open: an
  // `ok` here would be paint nobody can see.
  it('refuses to fill a line, which has no inside', async () => {
    const made = await runAction('layer.add', {
      kind: 'shape',
      name: 'Trait',
      shape: 'line',
      width: 100,
      height: 0.5,
    })
    const layerId = made.ok ? (made.data as { layerId: string }).layerId : ''

    expect(await runAction('layer.editShapeLayer', { layerId, filled: true })).toMatchObject({
      ok: false,
      refusal: 'badInput',
    })
    expect(layerNamed('Trait')).toMatchObject({ fill: null })
  })

  /**
   * The panel answers this by switching the other one back on, which is right under a finger and
   * wrong from outside: a client that asked for both to go hears that it cannot have that.
   */
  it('refuses to leave a shape with neither fill nor outline', async () => {
    const layerId = await drawn()
    await runAction('layer.editShapeLayer', { layerId, filled: true, stroked: false })

    expect(await runAction('layer.editShapeLayer', { layerId, filled: false })).toMatchObject({
      ok: false,
      refusal: 'badInput',
    })
    expect(layerNamed('Cadre')).toMatchObject({ fill: expect.any(Number) })
  })
})

describe('the dial of an adjustment layer', () => {
  const adjusting = async (): Promise<string> => {
    const made = await runAction('layer.add', {
      kind: 'adjustment',
      name: 'Expo',
      adjustment: 'exposure',
    })
    return made.ok ? (made.data as { layerId: string }).layerId : ''
  }

  it('moves the dial the layer carries', async () => {
    const layerId = await adjusting()

    await runAction('layer.setAdjustmentAmount', { layerId, exposure: 1.5 })

    expect(layerNamed('Expo')).toMatchObject({ values: { exposure: 1.5, contrast: 1 } })
  })

  // Written into the stack it would be carried, neutral and invisible, by a pass that never
  // reads it — so the call says so instead.
  it('refuses a dial that is not the layer’s own', async () => {
    const layerId = await adjusting()

    expect(await runAction('layer.setAdjustmentAmount', { layerId, contrast: 1.4 })).toMatchObject({
      ok: false,
      refusal: 'badInput',
    })
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

    await runAction('canvas.flipOrRotate', { turn: 'rotateClockwise' })
    expect(canvas()).toMatchObject({ width: 200, height: 100 })
  })
})

describe('what a mask does, once the engine has carved one', () => {
  const masked = () => ({
    ...pixelLayer('layer-a', 'Fond'),
    mask: { enabled: true, linked: true },
  })

  it('says whether it hides and whether it travels, one field at a time', async () => {
    withLayers(masked(), pixelLayer('layer-b', 'Sujet'))

    expect(await runAction('layer.setMaskOptions', { layerId: 'layer-a', linked: false })).toEqual({
      ok: true,
    })
    expect(canvas().layers[0]?.mask).toEqual({ enabled: true, linked: false })
  })

  it('takes it off, and refuses to say what it does in the same breath', async () => {
    withLayers(masked())

    expect(
      await runAction('layer.setMaskOptions', { layerId: 'layer-a', remove: true, enabled: false }),
    ).toMatchObject({ ok: false, refusal: 'badInput' })

    expect(await runAction('layer.setMaskOptions', { layerId: 'layer-a', remove: true })).toEqual({
      ok: true,
    })
    expect(canvas().layers[0]?.mask).toBeUndefined()
  })

  /** Carving one is the engine's, through a command: a record with no pixels behind it hides all. */
  it('refuses a layer wearing none rather than giving it an empty one', async () => {
    expect(
      await runAction('layer.setMaskOptions', { layerId: 'layer-a', enabled: false }),
    ).toMatchObject({
      ok: false,
      refusal: 'badInput',
    })
  })
})

describe('the guides of an image', () => {
  it('offers exactly the two ways a guide may run', () => {
    expect([
      ...(assistantAction('guide.add')?.fields.find(f => f.key === 'axis')?.options ?? []),
    ]).toEqual([...GUIDE_AXES])
  })

  it('lays one, moves it, and takes it away by the id it answered', async () => {
    const laid = await runAction('guide.add', { axis: 'x', position: 120 })
    const guideId = laid.ok ? (laid.data as { guideId: string }).guideId : ''

    expect(canvas().guides).toEqual([{ id: guideId, axis: 'x', position: 120 }])

    expect(await runAction('guide.move', { guideId, position: 40 })).toEqual({ ok: true })
    expect(canvas().guides[0]?.position).toBe(40)

    expect(await runAction('guide.remove', { guideId })).toEqual({ ok: true })
    expect(canvas().guides).toEqual([])
  })

  it('refuses an id nothing answers to rather than writing nothing', async () => {
    expect(await runAction('guide.move', { guideId: 'guide-z', position: 40 })).toMatchObject({
      ok: false,
      refusal: 'notFound',
    })
    expect(await runAction('guide.remove', { guideId: 'guide-z' })).toMatchObject({
      ok: false,
      refusal: 'notFound',
    })
  })
})

/**
 * 🛑 Measured on the bench pass of 2026-08-31 against deepseek-chat: `layer.mask` was refused
 * twelve times on a bare `badInput`, and the very same call came back word for word.
 */
describe('what a refused mask says', () => {
  const detailOf = (outcome: { ok: boolean; detail?: string }): string => outcome.detail ?? ''

  it('says the layer wears no mask, and which fields it would have taken', async () => {
    const outcome = await runAction('layer.setMaskOptions', { layerId: 'layer-a', enabled: false })

    expect(outcome).toMatchObject({ ok: false, refusal: 'badInput' })
    expect(detailOf(outcome)).toContain('canvas.state')
    expect(detailOf(outcome)).toContain('mask')
  })

  it('says the two halves cannot travel together', async () => {
    const outcome = await runAction('layer.setMaskOptions', {
      layerId: 'layer-a',
      remove: true,
      linked: true,
    })

    expect(outcome).toMatchObject({ ok: false, refusal: 'badInput' })
    expect(detailOf(outcome)).toContain('remove')
    expect(detailOf(outcome)).toContain('linked')
  })

  it('names the layer it could not find, and the call that lists them', async () => {
    const outcome = await runAction('layer.setMaskOptions', {
      layerId: 'layer-nowhere',
      enabled: true,
    })

    expect(outcome).toMatchObject({ ok: false, refusal: 'notFound' })
    expect(detailOf(outcome)).toContain('layer-nowhere')
    expect(detailOf(outcome)).toContain('canvas.state')
  })
})
