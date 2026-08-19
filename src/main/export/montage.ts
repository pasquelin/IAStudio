import { basename } from 'node:path'
import { z } from 'zod'
import { exportTargetOf } from '@shared/domain/exportRegistry'
import { CHANNELS, type MontageExportRequest } from '@shared/ipc'
import { handle } from '@main/ipc/handle'
import { fileInsideProject } from '@main/project/fileInsideProject'
import { pathSegment } from '@main/validation'
import { MissingMediumError, writeOtiozFile } from './otiozFile'
import { writePickedFile } from './writePickedFile'

export type MontageHandlerDeps = {
  /** Injected, like every dialog: `dialog` needs a live app, which no test has. */
  pickSavePath: (name: string, extension: string) => Promise<string | null>
  /** Where the open project sits, or nothing when none is. Injected as the folder writer's is. */
  projectPath: () => string | null
}

/**
 * A cut is JSON, and a long one stays small: ten thousand clips come to a few megabytes. The
 * ceiling is there because the renderer is the sandboxed side, not because a montage approaches
 * it.
 */
const MAX_CONTENT_BYTES = 64 * 1024 * 1024

/** The widest a cut gets. A bundle carries the media beside it, never a clip each. */
const MAX_MEDIA = 2048

const medium = z.object({ source: z.string(), entry: z.string() })

const montageExport = z.object({
  name: pathSegment,
  target: z.union([z.literal('montage.otio'), z.literal('montage.otioz')]),
  content: z.string().refine(text => text.length <= MAX_CONTENT_BYTES),
  media: z.array(medium).max(MAX_MEDIA).optional(),
})

/**
 * Writing the montage out. The cut alone, or the cut with its media inside it.
 *
 * The bundle is the one that settles the Media Pool of another application, and it is also the
 * one that reads files: every url is resolved against the OPEN PROJECT before anything is opened,
 * so a montage naming `/etc/passwd` packs nothing.
 */
export function registerMontageHandlers({ pickSavePath, projectPath }: MontageHandlerDeps): void {
  handle(CHANNELS.montageExport, async (_event, request) => {
    const { name, target, content, media }: MontageExportRequest = montageExport.parse(request)
    const { extension } = exportTargetOf(target)

    if (target === 'montage.otio') {
      return writePickedFile(() => pickSavePath(name, extension), new TextEncoder().encode(content))
    }

    const root = projectPath()
    // A bundle names its media relative to the project, so without one there is nothing to
    // resolve them against — and every path would be refused one by one for the wrong reason.
    if (!root) return null

    const resolved = []
    for (const one of media ?? []) {
      const path = await fileInsideProject(root, one.source)
      if (!path) throw new MissingMediumError(one.entry)
      resolved.push({ ...one, path })
    }

    const destination = await pickSavePath(name, extension)
    if (!destination) return null

    await writeOtiozFile(destination, { content, media: resolved })
    // The name, never the path: where a file sits is this process's business, as everywhere here.
    return basename(destination)
  })
}
