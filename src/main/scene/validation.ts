import { z } from 'zod'
import { EXPORT_FORMATS, type ExportFormat } from '@shared/domain/scene'
import type { SceneExportRequest } from '@shared/ipc'

/**
 * An exported scene crosses the boundary as bytes. Bounded rather than trusted: the renderer is
 * the sandboxed side, and an unbounded buffer written to disk is a full partition away.
 */
const MAX_EXPORT_BYTES = 2 * 1024 * 1024 * 1024

const format = z.enum(EXPORT_FORMATS as [ExportFormat, ...ExportFormat[]])

const sceneExport = z.object({
  // No separator and no dots: the name is joined to an extension and handed to a save dialog.
  name: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .refine(value => !/[/\\]/.test(value)),
  format,
  data: z.instanceof(Uint8Array).refine(bytes => bytes.byteLength <= MAX_EXPORT_BYTES),
})

export function parseSceneExport(value: unknown): SceneExportRequest {
  return sceneExport.parse(value)
}
