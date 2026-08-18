import { z } from 'zod'
import { OTIO_EXTENSION } from '@shared/domain/otio'
import { CHANNELS, type MontageExportRequest } from '@shared/ipc'
import { handle } from '@main/ipc/handle'
import { pathSegment } from '@main/validation'
import { writePickedFile } from './writePickedFile'

export type MontageHandlerDeps = {
  /** Injected, like every dialog: `dialog` needs a live app, which no test has. */
  pickSavePath: (name: string, extension: string) => Promise<string | null>
}

/**
 * A cut is JSON, and a long one stays small: ten thousand clips come to a few megabytes. The
 * ceiling is there because the renderer is the sandboxed side, not because a montage approaches
 * it.
 */
const MAX_EXPORT_BYTES = 64 * 1024 * 1024

const montageExport = z.object({
  name: pathSegment,
  data: z.instanceof(Uint8Array).refine(bytes => bytes.byteLength <= MAX_EXPORT_BYTES),
})

/** Writing the montage out as an interchange file. The extension is this side's to decide. */
export function registerMontageHandlers({ pickSavePath }: MontageHandlerDeps): void {
  handle(CHANNELS.montageExport, async (_event, request) => {
    const { name, data }: MontageExportRequest = montageExport.parse(request)

    return writePickedFile(() => pickSavePath(name, OTIO_EXTENSION), data)
  })
}
