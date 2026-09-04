import { scatterMaskFromGroundPaint } from '@shared/domain/groundPaintMask'
import type { ReliefLayer, ScatterLayer } from '@shared/domain/scene'
import { setScatterMask } from '@/engines/scene/scatterCommands'
import { reportFailure } from '@/services/diagnostics'
import { sceneOf, useScenes } from '@/stores/scenes'
import { loadGroundPaint, type GroundPaintCodec } from './groundPaintAsset'

export async function deriveScatterMask(
  documentId: string,
  scatterId: string,
  codec?: GroundPaintCodec,
): Promise<boolean> {
  const world = sceneOf(useScenes.getState(), documentId).world
  const scatter = world.layers.find(
    (layer): layer is ScatterLayer => layer.kind === 'scatter' && layer.id === scatterId,
  )
  const terrain = world.layers.find(
    (layer): layer is ReliefLayer => layer.kind === 'relief' && layer.groundMaterials.length > 0,
  )
  if (!scatter || !terrain) return false
  const paint = await loadGroundPaint(documentId, terrain.id, codec)
  if (!paint) return false
  try {
    useScenes.getState().runCommand(
      documentId,
      setScatterMask(scatterId, {
        kind: 'painted',
        weights: scatterMaskFromGroundPaint(paint, scatter.grain),
      }),
    )
    return true
  } catch (error) {
    reportFailure('scene.model', scatterId, error)
    return false
  }
}
