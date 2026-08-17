import { beforeEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_CANVAS,
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
      refusal: 'badInput',
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
