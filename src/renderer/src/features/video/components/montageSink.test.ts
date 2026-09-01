import { describe, expect, it, vi } from 'vitest'
import type { Asset } from '@shared/domain/asset'
import type { SceneStage, SceneStageOptions } from '@/engines/scene/sceneStage'
import { forgetRememberedAssets, useAssets } from '@/stores/assets'
import { WINDOW_SOURCES } from '@/windowSources'
import { montageSink } from './montageSink'

const MESH: Asset = {
  id: 'asset_3',
  name: 'Robot',
  type: 'mesh',
  location: 'local',
  tags: [],
  createdAt: '2026-08-16T10:00:00.000Z',
}

describe('the sink a montage reads the studio through', () => {
  /**
   * Three surfaces had each wired the same four stores themselves, so the `assetOf` fix below had
   * to be found three times over. Sorted rather than ordered: `import.meta.glob` promises no order
   * of its own, and a fourth site is what this counts.
   *
   * Read through `WINDOW_SOURCES` rather than a glob of its own: the pattern was `../../**`, which
   * meant the whole renderer from `spaces/video/` and its own folder from here. The sweep followed
   * the file and shrank to nothing, which is the trap `windowSources.ts` was extracted for.
   */
  it('is wired in exactly one place', () => {
    const wiring = Object.entries(WINDOW_SOURCES)
      .filter(([, source]) => source.includes('createStudioSink('))
      .map(([path]) => path)
      .sort()

    expect(wiring).toEqual([
      './engines/timeline/sinkPort.ts',
      './features/video/components/montageSink.ts',
    ])
  })

  /**
   * The half no guard over source text can hold: a mesh reaches its 3D path only if the catalogue
   * is read as the Map it is. Indexed with brackets instead, every model went down the media path
   * to be written off as undecodable — and each of the three sites had its own copy of that line.
   */
  it('draws a mesh the catalogue holds as 3D, never as media', async () => {
    forgetRememberedAssets()
    useAssets.setState({ items: [MESH] })
    const stage: SceneStage = { show: vi.fn(), draw: vi.fn(() => null), dispose: vi.fn() }
    // Spelled out so the recorded call keeps its type, as `scene-clip.test.ts` explains.
    const createStage = vi.fn((_options: SceneStageOptions) => stage)

    await montageSink(() => ({ width: 1920, height: 1080 }), createStage)(MESH.id)

    // Wired for the clips the file brings: that is what tells the 3D path from the media one.
    expect(createStage.mock.calls[0]?.[0]).toHaveProperty('onClips')
  })
})
