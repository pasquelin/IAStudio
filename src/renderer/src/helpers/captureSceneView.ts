import type { CaptureQuality } from '@shared/domain/sceneCapture'
import { bytesToBase64 } from '@/helpers/base64'
import { getBridge } from '@/services/bridge'
import { reportFailure } from '@/services/diagnostics'
import { documentExportName, useDocuments } from '@/stores/documents'
import { sceneEngineOf } from '@/stores/sceneEngines'

/**
 * A still of the view, into the project's pictures — where every other image of the project
 * lives, so it is one drag away from a montage and one click away from being posted.
 *
 * The picture is named after the document: two captures of one scene are two assets, the second
 * suffixed by the writer, which is what a series of takes wants.
 *
 * Answers whether it landed, which the menu row does not need and an outside client does: a
 * capture asked for with no viewport mounted is a refusal rather than a silence.
 */
export async function captureSceneView(
  documentId: string,
  quality: CaptureQuality,
): Promise<boolean> {
  const bridge = getBridge()
  const engine = sceneEngineOf(documentId)
  if (!bridge || !engine) return false

  try {
    const png = await engine.captureStill(quality)
    await bridge.assets.savePicture({
      name: documentExportName(useDocuments.getState(), documentId, 'scene'),
      png: bytesToBase64(png),
    })
    return true
  } catch (error) {
    reportFailure('scene.capture', quality, error)
    return false
  }
}
