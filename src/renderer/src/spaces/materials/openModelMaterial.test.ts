import { beforeEach, describe, expect, it } from 'vitest'
import type { DocumentDescriptor } from '@shared/domain/document'
import type { Project } from '@shared/domain/project'
import { bridgeWatchingLogs, installFakeBridge } from '@/services/fakeBridge'
import { forgetReportedFailures } from '@/services/diagnostics'
import { useDocuments } from '@/stores/documents'
import { useLayouts } from '@/stores/layouts'
import { useProject } from '@/stores/project'
import { materialOf, useMaterials } from '@/stores/materials'
import type { ChannelTexture } from '@shared/domain/ownModelTextures'
import { openModelMaterial } from './openModelMaterial'

const PROJECT: Project = {
  path: '/projects/demo',
  manifest: {
    version: 1,
    name: 'Demo',
    createdAt: '2026-08-14T10:00:00.000Z',
    updatedAt: '2026-08-14T10:00:00.000Z',
  },
}

const MODEL = { id: 'asset-model', name: 'Robot' }

const texture = (overrides: Partial<ChannelTexture> = {}): ChannelTexture => ({
  id: 'asset-base',
  name: 'Robot — Couleur de base',
  type: 'texture',
  location: 'local',
  derivedFrom: MODEL.id,
  map: 'baseColor',
  tags: [],
  createdAt: '2026-08-14T10:00:00.000Z',
  ...overrides,
})

/** The tab the gesture made. Every case here opens exactly one, which is half the promise. */
function opened(): DocumentDescriptor {
  const made = Object.values(useDocuments.getState().documents).at(-1)
  if (!made) throw new Error('expected a document to have been opened')
  return made
}

const openedCount = (): number => Object.keys(useDocuments.getState().documents).length

/**
 * A model's maps are ONE material, and opening it is what assembles them.
 *
 * Nothing is written at import, deliberately: extraction runs on every `.glb` that lands in the
 * project, so a document per imported model would be a folder full of files nobody opened.
 */
describe('opening the material of a model', () => {
  beforeEach(() => {
    useDocuments.setState({ documents: {}, stored: [], activeId: null })
    useLayouts.setState({ layout: null, activeWorkspace: 'video', home: false })
    useProject.setState({ project: PROJECT, known: true })
    installFakeBridge()
    forgetReportedFailures()
  })

  it('puts every named map into the channel it plays, in one document', async () => {
    await openModelMaterial(MODEL, [
      texture(),
      texture({ id: 'asset-normal', map: 'normal' }),
      texture({ id: 'asset-ao', map: 'ao' }),
    ])

    const channels = materialOf(useMaterials.getState(), opened().id).channels
    expect(channels.baseColor).toMatchObject({ assetId: 'asset-base', origin: 'imported' })
    expect(channels.normal).toMatchObject({ assetId: 'asset-normal' })
    expect(channels.ao).toMatchObject({ assetId: 'asset-ao' })
    expect(useLayouts.getState().activeWorkspace).toBe('materials')
  })

  it('names the tab after the model, and links it back', async () => {
    await openModelMaterial(MODEL, [texture()])

    expect(opened()).toMatchObject({
      title: 'Robot',
      sourceAssetId: 'asset-model',
      kind: 'material',
    })
  })

  /**
   * Two tabs onto one material are two histories of it, and reassembling would undo whatever was
   * picked in between — the whole reason the assembly happens once, on the way in.
   */
  it('comes back to the tab already assembled rather than making a second one', async () => {
    await openModelMaterial(MODEL, [texture()])
    const first = opened().id

    await openModelMaterial(MODEL, [texture({ id: 'asset-other' })])

    expect(openedCount()).toBe(1)
    expect(materialOf(useMaterials.getState(), first).channels.baseColor).toMatchObject({
      assetId: 'asset-base',
    })
  })

  /**
   * A picture the cloud still holds has no file to decode. Asked before a tab is made, the way
   * `openAsset` asks it: left to `placeMaterialChannel`, which refuses one by one, the gesture
   * would leave an empty tab standing where a refusal belonged.
   */
  it('opens nothing, and says so, for a material the cloud still holds', async () => {
    const bridge = bridgeWatchingLogs()

    await openModelMaterial(MODEL, [texture({ location: 'cloud' })])

    expect(openedCount()).toBe(0)
    expect(bridge.report).toHaveBeenCalledWith(
      expect.objectContaining({ level: 'error', scope: 'assets.open' }),
    )
  })
})
