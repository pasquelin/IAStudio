import { assetUrl } from '@shared/domain/asset'
import { loadTexture } from '@/engines/scene/texture-cache'
import { createSeamPort, type SeamPort } from '@/engines/texture/derive/seam-port'
import { reportFailure } from '@/services/diagnostics'
import { textureOf, useTextures } from '@/stores/textures'
import { useTextureViews } from '@/stores/texture-views'

/** The GPU port, built once. It holds nothing: a context is made and released per measurement. */
const gpuSeam = createSeamPort({ loadTexture })

/**
 * How visible the wrap edge of this texture is, measured and remembered for the session.
 *
 * The base colour and nothing else: it is the channel a seam is seen in, and the eight are laid
 * out together — a normal map whose edges disagree disagrees at the same places. Measuring all
 * eight would open eight contexts to answer the same question.
 *
 * Answers whether it ran. Failures are reported rather than thrown: the caller is a button.
 */
export async function measureTextureSeam(
  documentId: string,
  measure: SeamPort = gpuSeam,
): Promise<boolean> {
  const source = textureOf(useTextures.getState(), documentId).channels.baseColor
  if (!source) {
    reportFailure('texture.channel', 'baseColor', new Error('baseColor is empty'))
    return false
  }

  try {
    const ratio = await measure(assetUrl(source.assetId))
    useTextureViews.getState().setSeam(documentId, ratio)
    return true
  } catch (error) {
    reportFailure('texture.channel', 'baseColor', error)
    return false
  }
}
