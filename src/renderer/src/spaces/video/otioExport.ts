import type { Asset } from '@shared/domain/asset'
import { otioTimelineOf, type OtioSource } from '@/engines/timeline/otioTimeline'
import type { Clip, SequenceState } from '@/engines/timeline/timelineState'
import { getBridge } from '@/services/bridge'
import { reportFailure } from '@/services/diagnostics'
import { assetsById, useAssets } from '@/stores/assets'
import { useDocuments } from '@/stores/documents'
import { useProject } from '@/stores/project'

/**
 * An absolute path as a URL another application resolves.
 *
 * Absolute rather than relative to the file being written: the montage lands wherever the save
 * dialog goes, which is rarely the project folder — and a relative link from there would resolve
 * to nothing. The cost is that moving the project breaks the links, which no encoding avoids.
 */
export function fileUrlOf(projectPath: string, relative: string): string {
  const joined = `${projectPath.replaceAll('\\', '/').replace(/\/$/, '')}/${relative}`
  const url = new URL('file:///')
  // Through the parser rather than `encodeURIComponent`, which escapes the `:` of a Windows
  // drive letter too. The leading slash is what keeps that letter out of the host.
  url.pathname = joined.startsWith('/') ? joined : `/${joined}`
  return url.href
}

function sourceOf(clip: Clip, projectPath: string, assets: ReadonlyMap<string, Asset>): OtioSource {
  if (clip.sceneId) {
    const scene = useDocuments.getState().documents[clip.sceneId]
    // No url whatever we answer — a scene is rendered, not read — but the NAME is what another
    // application shows in place of the missing picture.
    return { name: scene?.title ?? clip.sceneId, url: null }
  }

  const asset = assets.get(clip.assetId)
  return {
    name: asset?.name ?? clip.assetId,
    url: asset?.path ? fileUrlOf(projectPath, asset.path) : null,
  }
}

/**
 * Writes the montage out as an OpenTimelineIO file — the cut, not a film of it.
 *
 * Composed by the WINDOW, like every other export here: only this side holds the catalogue a
 * clip's media is resolved against, and the main process would have nothing to turn an asset id
 * into a path with.
 *
 * Answers the file name, or `null` when the dialog was dismissed or nothing could be written.
 */
export async function exportOtio(sequence: SequenceState, title: string): Promise<string | null> {
  const bridge = getBridge()
  const projectPath = useProject.getState().project?.path
  if (!bridge || !projectPath) return null

  try {
    const assets = assetsById(useAssets.getState())
    const timeline = otioTimelineOf(sequence, {
      name: title,
      sourceOf: clip => sourceOf(clip, projectPath, assets),
    })

    return await bridge.montage.export({
      name: title,
      data: new TextEncoder().encode(JSON.stringify(timeline, null, 2)),
    })
  } catch (error) {
    reportFailure('sequence.export', title, error)
    return null
  }
}
