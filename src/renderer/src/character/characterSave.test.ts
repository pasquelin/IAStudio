import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Asset } from '@shared/domain/asset'
import type { RigBone } from '@shared/domain/rig'
import type { Rig } from '@shared/domain/rig'
import { IDENTITY_TRANSFORM } from '@shared/domain/transform'
import { setCharacterBoneRest } from '@/engines/character/characterCommands'
import { installFakeBridge } from '@/services/fakeBridge'
import { isCharacterDirty, seedCharacter, useCharacters } from '@/stores/character'
import { clearCharacters } from '@/stores/character-fixtures'
import { saveCharacter } from './characterSave'

/** Each container the port was asked to rebuild, held open until a case lets it land. */
const writes = vi.hoisted((): { bones: readonly RigBone[]; land: () => void }[] => [])

vi.mock('@/engines/scene/glbWrite.worker?worker', () => ({ default: class {} }))

vi.mock('@/engines/scene/glbWriter', () => ({
  createGlbWriter: () => ({
    write: (_file: Uint8Array, patch: { bones: readonly RigBone[] }) =>
      new Promise(resolve => {
        writes.push({ bones: patch.bones, land: () => resolve(new Uint8Array([1])) })
      }),
    dispose: () => {},
  }),
}))

vi.mock('@/helpers/assetFetch', () => ({
  assetBytes: () => Promise.resolve(new Uint8Array([1, 2])),
}))

const ASSET = 'asset-hero'
const RIG: Rig = {
  origin: 'local',
  bones: [{ name: 'Spine', parent: null, rest: IDENTITY_TRANSFORM }],
}

const raised = (y: number) => ({ ...IDENTITY_TRANSFORM, position: { x: 0, y, z: 0 } })
const poseSpine = (y: number): void =>
  useCharacters.getState().runCommand(ASSET, setCharacterBoneRest('Spine', raised(y)))
const dirty = (): boolean => isCharacterDirty(useCharacters.getState(), ASSET)

const filed: Asset = {
  id: ASSET,
  name: 'Héros',
  type: 'mesh',
  location: 'local',
  tags: [],
  createdAt: '2026-09-02T00:00:00.000Z',
}

beforeEach(() => {
  writes.length = 0
  clearCharacters()
  installFakeBridge({ assets: { saveMesh: () => Promise.resolve(filed) } })
  seedCharacter(ASSET, RIG, {})
})

describe('writing a character back to its own file', () => {
  // 🛑 Rebuilding tens of megabytes takes seconds and a hand goes on posing through them. Read
  // after the write, the mark counted those poses as being in a file that does not hold them.
  it('does not count a pose made while the file was being written as saved', async () => {
    const saving = saveCharacter(ASSET, [])
    await vi.waitFor(() => expect(writes).toHaveLength(1))

    poseSpine(0.2)
    writes[0]?.land()

    expect(await saving).toBe(true)
    expect(dirty()).toBe(true)
  })

  // A second ⌘S is pressed precisely because the first showed nothing. Answered with the first
  // one's promise it wrote no byte and still said `true`.
  it('writes the skeleton as it stands when a save waits its turn behind another', async () => {
    const first = saveCharacter(ASSET, [])
    await vi.waitFor(() => expect(writes).toHaveLength(1))

    poseSpine(0.2)
    const second = saveCharacter(ASSET, [])
    writes[0]?.land()
    await vi.waitFor(() => expect(writes).toHaveLength(2))
    writes[1]?.land()

    expect([await first, await second]).toEqual([true, true])
    expect(writes[0]?.bones[0]?.rest.position.y).toBe(0)
    expect(writes[1]?.bones[0]?.rest.position.y).toBeCloseTo(0.2, 5)
    // And the second landing IS what makes the character clean: its own mark, its own answer.
    expect(dirty()).toBe(false)
  })
})
