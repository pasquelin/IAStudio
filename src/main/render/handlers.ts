import { basename } from 'node:path'
import { z } from 'zod'
import { CHANNELS, type RenderFrameRequest, type RenderStartRequest } from '@shared/ipc'
import { handle } from '@main/ipc/handle'
import { pathSegment } from '@main/validation'
import { startRender, type RenderDeps, type RenderSession } from './session'

/**
 * A frame crosses the boundary as bytes. Bounded rather than trusted, exactly as an exported
 * scene is: the renderer is the sandboxed side, and a render is thousands of these.
 */
const MAX_FRAME_BYTES = 64 * 1024 * 1024

const startSchema = z.object({
  name: pathSegment,
  // A film of one frame per hour is not a film, and one of a thousand per second is a mistake.
  fps: z.number().int().min(1).max(240),
})

const frameSchema = z.object({
  id: z.string().min(1),
  index: z.number().int().min(0),
  png: z.instanceof(Uint8Array).refine(bytes => bytes.byteLength <= MAX_FRAME_BYTES),
})

export type RenderHandlerDeps = RenderDeps & {
  /** Injected, like every dialog: `dialog` needs a live app, which no test has. */
  pickSavePath: (name: string, extension: string) => Promise<string | null>
  /** Ids are handed out here so a test can predict them. */
  newId: () => string
}

type Live = { session: RenderSession; destination: string; fps: number }

/**
 * The three steps of a render, and the sessions in flight between them.
 *
 * The save dialog is answered FIRST, before a single frame is computed: a render is minutes of
 * work, and asking where it goes at the end is how one throws it away by pressing Escape.
 */
export function registerRenderHandlers(deps: RenderHandlerDeps): void {
  const live = new Map<string, Live>()

  handle(CHANNELS.renderStart, async (_event, request) => {
    const { name, fps }: RenderStartRequest = startSchema.parse(request)

    const destination = await deps.pickSavePath(name, '.mp4')
    if (!destination) return null

    const id = deps.newId()
    live.set(id, { session: await startRender(deps), destination, fps })
    return id
  })

  handle(CHANNELS.renderFrame, async (_event, request) => {
    const { id, index, png }: RenderFrameRequest = frameSchema.parse(request)

    const held = live.get(id)
    // A frame for a session that has finished or been cancelled is dropped rather than throwing:
    // frames are in flight when a cancel lands, and each of them would report a failure.
    if (!held) return
    await held.session.frame(index, png)
  })

  handle(CHANNELS.renderFinish, async (_event, id) => {
    const held = live.get(z.string().parse(id))
    if (!held) return null

    live.delete(z.string().parse(id))
    await held.session.finish(held.destination, held.fps)
    // The name, never the path: where a file sits is this side's business.
    return basename(held.destination)
  })

  handle(CHANNELS.renderCancel, async (_event, id) => {
    const key = z.string().parse(id)
    const held = live.get(key)
    if (!held) return

    live.delete(key)
    await held.session.cancel()
  })
}
