/**
 * The stage: the end that OWNS the character, and the only thing the bench can drive without a
 * window. What it must do is publish — every assistant action runs in the STUDIO window, whose
 * own character store is empty.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { IDENTITY_TRANSFORM } from '@shared/domain/transform'
import type { Rig } from '@shared/domain/rig'
import { characterMessageOf, openCharacterChannel } from './characterChannel'
import { createCharacterStage, workshopIdOf } from './characterStage'
import { characterOf, useCharacters } from '@/stores/character'
import { clearCharacters } from '@/stores/character-fixtures'
import { clearScenes } from '@/stores/scene-fixtures'
import { sceneOf, useScenes } from '@/stores/scenes'

const ASSET = 'asset-hero'
const RIG: Rig = {
  origin: 'imported',
  bones: [{ name: 'Hips', parent: null, rest: IDENTITY_TRANSFORM }],
}

const renderer = () => ({ apply: vi.fn(), frameContents: vi.fn(() => true) })

/** What the other end of the channel hears. */
function listening(): { heard: unknown[]; close: () => void } {
  const channel = openCharacterChannel()
  const heard: unknown[] = []
  channel.onmessage = event => void heard.push(characterMessageOf(event.data))

  return { heard, close: () => channel.close() }
}

/**
 * A `BroadcastChannel` delivers on a turn of the loop, never on a microtask — and a single turn
 * is not a promise it has arrived: waited that way, this file went red once in fifteen runs.
 */
const heardBy = (heard: unknown[], message: unknown): Promise<void> =>
  vi.waitFor(() => expect(heard).toContainEqual(message))

beforeEach(() => {
  clearCharacters()
  clearScenes()
})

describe('editing one character', () => {
  it('lays a workshop scene holding that character and nothing else', () => {
    const stage = createCharacterStage({ renderer: renderer(), assetId: ASSET })

    const nodes = sceneOf(useScenes.getState(), workshopIdOf(ASSET)).nodes
    expect(nodes).toHaveLength(1)
    expect(nodes[0]?.type === 'model' && nodes[0].model.assetId).toBe(ASSET)
    stage.close()
  })

  // This window has no outliner to drag from: a band left to fill itself stays empty for ever.
  it('puts that character on the animation sheet, where a scene waits to be dragged there', () => {
    const stage = createCharacterStage({ renderer: renderer(), assetId: ASSET })

    const scene = sceneOf(useScenes.getState(), workshopIdOf(ASSET))
    expect(scene.animation.sheet).toEqual([scene.nodes[0]?.id])
    stage.close()
  })

  it('draws the workshop scene as soon as it is laid', () => {
    const draw = renderer()
    const stage = createCharacterStage({ renderer: draw, assetId: ASSET })

    expect(draw.apply).toHaveBeenCalled()
    stage.close()
  })

  it('holds what the engine read off the file', () => {
    const stage = createCharacterStage({ renderer: renderer(), assetId: ASSET })

    stage.read(RIG, { motions: [{ id: 'm1', name: 'Capoeira', assetId: 'a9' }] }, null)

    const held = characterOf(useCharacters.getState(), ASSET)
    expect(held.rig).toEqual(RIG)
    expect(held.motions).toHaveLength(1)
    stage.close()
  })

  // 🛑 Without this the ten skeleton actions reach nothing: they run in the studio window, and
  // its character store is filled by this message alone.
  it('publishes what it holds, so the studio can answer for it', async () => {
    const heard = listening()
    const stage = createCharacterStage({ renderer: renderer(), assetId: ASSET })

    stage.read(RIG, null, { min: { x: 0, y: 0, z: 0 }, max: { x: 1, y: 2, z: 1 } })

    await heardBy(heard.heard, {
      kind: 'holds',
      assetId: ASSET,
      rig: RIG,
      bounds: { min: { x: 0, y: 0, z: 0 }, max: { x: 1, y: 2, z: 1 } },
    })
    stage.close()
    heard.close()
  })

  // The window turns towards whichever character is opened: a store that kept them all would
  // leave every action acting on the first one it was ever told about.
  it('lets the character go on the way out, on both sides', async () => {
    const heard = listening()
    const stage = createCharacterStage({ renderer: renderer(), assetId: ASSET })
    stage.read(RIG, null, null)

    stage.close()
    await heardBy(heard.heard, { kind: 'dropped', assetId: ASSET })

    expect(characterOf(useCharacters.getState(), ASSET).rig).toBeNull()
    expect(sceneOf(useScenes.getState(), workshopIdOf(ASSET)).nodes).toEqual([])
    heard.close()
  })

  it('aims the view once, and not again as the character moves', () => {
    const draw = renderer()
    const stage = createCharacterStage({ renderer: draw, assetId: ASSET })

    stage.read(RIG, null, null)
    stage.read(RIG, null, null)

    expect(draw.frameContents).toHaveBeenCalledTimes(1)
    stage.close()
  })
})
