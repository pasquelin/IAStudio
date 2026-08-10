import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { FRAME_PATTERN, frameName, sequenceArgs } from '../media/ffmpeg'

/** What a render needs of the outside world, so a test can hand it anything but a real encoder. */
export type RenderDeps = {
  /** Runs ffmpeg with those arguments. Resolves on success, rejects with what it said otherwise. */
  encode: (args: readonly string[]) => Promise<void>
  /** Where the frames are staged. A temp folder by default; a test hands a known one. */
  scratch?: () => Promise<string>
}

export type RenderSession = {
  /** Stages one frame. The index decides the order, never the order the calls arrive in. */
  frame: (index: number, png: Uint8Array) => Promise<void>
  /** Encodes what has been staged into `destination`, then clears the staging folder. */
  finish: (destination: string, fps: number) => Promise<void>
  /** Throws the staged frames away without encoding. Safe to call twice. */
  cancel: () => Promise<void>
}

/**
 * A render, staged on disk before it is encoded.
 *
 * Through files rather than a pipe into ffmpeg's stdin: a render is minutes of work, and a
 * pipe that breaks mid-way loses every frame already computed. Staged, the encode is a second
 * step that can be retried without rendering anything again.
 *
 * The renderer never learns where the folder is — it has no `fs`, and where things land is this
 * side's business, exactly as for a scene export.
 */
export async function startRender(deps: RenderDeps): Promise<RenderSession> {
  const folder = await (deps.scratch ?? defaultScratch)()
  await mkdir(folder, { recursive: true })

  let done = false
  const clear = async (): Promise<void> => {
    if (done) return
    done = true
    // `force`, so cancelling a render that never staged a frame is not itself a failure.
    await rm(folder, { recursive: true, force: true })
  }

  return {
    frame: (index, png) => writeFile(join(folder, frameName(index)), png),
    finish: async (destination, fps) => {
      try {
        await deps.encode(sequenceArgs(join(folder, FRAME_PATTERN), destination, fps))
      } finally {
        // Even when the encode refuses: the frames of a failed render are megabytes nobody will
        // ever look at, and leaving them behind is how a temp folder becomes a disk full.
        await clear()
      }
    },
    cancel: clear,
  }
}

function defaultScratch(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'scenario-render-'))
}
