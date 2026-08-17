import { createStudioSink, type StudioSinkDeps } from '@/engines/timeline/sinkPort'
import { assetsById, useAssets } from '@/stores/assets'
import { loadSceneSource, montageSceneOf, montageViewOf } from '@/stores/sceneSources'

/**
 * How a montage reads the studio to draw a clip's source, for the three surfaces that open one:
 * the programme monitor, the video return, the export.
 *
 * The frame size stays the caller's — a monitor follows the sequence it is watching, an export
 * the one it is writing — and so does the stage, absent outside tests for the reason
 * `StudioSinkDeps` gives.
 */
export function montageSink(
  size: StudioSinkDeps['size'],
  createStage?: StudioSinkDeps['createStage'],
): ReturnType<typeof createStudioSink> {
  return createStudioSink({
    sceneOf: montageSceneOf,
    wantScene: loadSceneSource,
    viewOf: montageViewOf,
    // A Map, never an object: indexing it with brackets answers `undefined` for every asset
    // there is, which sent every model down the media path to be written off as undecodable.
    assetOf: assetId => assetsById(useAssets.getState()).get(assetId) ?? null,
    size,
    createStage,
  })
}
