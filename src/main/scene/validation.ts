import { z } from 'zod'
import { EXPORT_FORMATS, type ExportFormat } from '@shared/domain/scene'
import type { SceneExportRequest } from '@shared/ipc'
import { pathSegment } from '@main/validation'

/**
 * An exported scene crosses the boundary as bytes. Bounded rather than trusted: the renderer is
 * the sandboxed side, and an unbounded buffer written to disk is a full partition away.
 */
const MAX_EXPORT_BYTES = 2 * 1024 * 1024 * 1024

// `z.enum` takes a NON-EMPTY tuple, which a `readonly ExportFormat[]` cannot prove it is. The
// list is the shared one either way: writing the values out here is what would let it drift.
const format = z.enum(EXPORT_FORMATS as [ExportFormat, ...ExportFormat[]])

const sceneExport = z.object({
  name: pathSegment,
  format,
  data: z.instanceof(Uint8Array).refine(bytes => bytes.byteLength <= MAX_EXPORT_BYTES),
})

export function parseSceneExport(value: unknown): SceneExportRequest {
  return sceneExport.parse(value)
}
