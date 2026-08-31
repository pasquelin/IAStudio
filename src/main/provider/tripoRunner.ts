import type { AssetType } from '@shared/domain/asset'
import type { JobTarget } from '@shared/domain/job'
import { CREDIT_UNIT } from '@shared/domain/credits'
import { PROMPT_FIELD_KEY } from '@shared/domain/localFields'
import {
  tripoEntryOf,
  TRIPO_LANE_LIMITS,
  type TripoEntry,
  type TripoLane,
} from '@shared/domain/tripo'
import type { CollectableProduction } from '@main/assets/localCollector'
import type { JobRunner, RemoteJob } from './jobManager'
import { TripoError, type TripoApi, type TripoTask } from './tripoApi'

/**
 * Generations run by Tripo, behind the shape the job manager already speaks.
 *
 * Three things separate it from the Scenario runner beside it. Their result URLs expire in five
 * minutes, so a finished task is downloaded on the very poll that saw it succeed and filed by
 * the LOCAL collector — there is no library to fetch it back from. Nothing of theirs cancels:
 * their reference publishes no such endpoint, so `cancel` refuses rather than let the studio
 * report a stopped generation that is still being billed. And the polls of one beat are asked in
 * ONE request, which is what their reference recommends over N.
 */

export type TripoJobRunner = JobRunner & {
  /** What a finished task left on this disk, for the collector to file and then drop. */
  producedBy: (jobId: string) => CollectableProduction | null
  owns: (jobId: string) => boolean
}

export type TripoRunnerDeps = {
  /** The API bound to the key in force, or `null` while no Tripo account is held. */
  api: () => TripoApi | null
  /** Bytes off a signed URL. Through Electron's own stack — see `download` in `services.ts`. */
  download: (url: string) => Promise<Uint8Array>
  /** A picture or a mesh a body names by path, read to be sent up. */
  readFile: (path: string) => Promise<Uint8Array>
  /** Writes the result where `destinationFor` said. */
  writeFile: (path: string, bytes: Uint8Array) => Promise<void>
  /** Where a downloaded result lands, named after the task and the extension its URL announced. */
  destinationFor: (taskId: string, extension: string) => Promise<string>
  /** How long the polls of one beat are gathered for before the grouped request goes out. */
  gather: (ms: number) => Promise<void>
  log: (level: 'info' | 'warn', message: string) => void
  gatherMs?: number
}

/** How many settled tasks stay answerable — the same ceiling `localJobRunner` keeps. */
const REMEMBERED = 64

/** Wide enough to gather the polls of jobs that started together, short enough to go unnoticed. */
const DEFAULT_GATHER_MS = 50

/** The shelf a family lands on. Nothing of Tripo's produces anything else. */
const SHELF: Record<string, AssetType> = { '3d': 'mesh', image: 'image' }

/**
 * The extension a signed URL announces, without its dot.
 *
 * Read off the PATH and never off the whole string, which carries the signature: their URLs end
 * in `?X-Amz-…`, and the last dot of that files a mesh under `.com`.
 */
export function extensionOfUrl(url: string, fallback: string): string {
  const name = (url.split('?')[0] ?? url).split('/').pop() ?? ''
  const dot = name.lastIndexOf('.')
  const extension = dot > 0 ? name.slice(dot + 1) : ''

  return /^[a-z0-9]{1,5}$/i.test(extension) ? extension.toLowerCase() : fallback
}

/** The lane a target is counted in, or `null` for anything that is not Tripo's. */
export function tripoLaneOf(targetId: string): TripoLane | null {
  return tripoEntryOf(targetId)?.lane ?? null
}

/** How many of that lane may run at once, as Tripo publishes it. */
export function tripoLaneLimit(lane: TripoLane): number {
  return TRIPO_LANE_LIMITS[lane]
}

/** Whether a value is a path on this disk rather than a URL, a token or a task id. */
const isPath = (value: string): boolean => value.startsWith('/') || /^[a-z]:[\\/]/i.test(value)

const MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  glb: 'model/gltf-binary',
  gltf: 'model/gltf+json',
}

export function createTripoRunner(deps: TripoRunnerDeps): TripoJobRunner {
  const produced = new Map<string, CollectableProduction>()
  /** What was asked for, kept so a success can be named after it. Empty after a relaunch. */
  const asked = new Map<string, string>()
  let batch: { ids: Set<string>; answer: Promise<Map<string, TripoTask>> } | null = null

  const held = (): TripoApi => {
    const api = deps.api()
    if (!api) throw new Error('no Tripo account is held for a generation that needs one')

    return api
  }

  /** Oldest first, which is what a `Map` iterates. `owns` reads this, so nothing goes on settling. */
  const forgetOldest = (): void => {
    for (const taskId of produced.keys()) {
      if (produced.size <= REMEMBERED) return
      produced.delete(taskId)
    }
  }

  const sendUp = async (path: string): Promise<string> => {
    const extension = extensionOfUrl(path, 'png')
    const bytes = await deps.readFile(path)

    return await held().upload(
      path.split(/[\\/]/).pop() ?? `input.${extension}`,
      bytes,
      MIME[extension] ?? 'application/octet-stream',
    )
  }

  /**
   * The body their endpoint takes: the form's own keys, which ARE the API's, plus the model the
   * entry names. An empty value is left out rather than sent — their defaults are documented,
   * and an explicit null is not one of them.
   */
  const bodyFor = async (
    entry: TripoEntry,
    body: Record<string, unknown>,
  ): Promise<Record<string, unknown>> => {
    const sent: Record<string, unknown> = entry.model ? { model: entry.model } : {}

    for (const field of entry.fields) {
      const value = body[field.key]
      if (value === undefined || value === null || value === '') continue

      // A picture or a mesh arrives as a PATH: `services.ts` routes a Tripo body through the
      // LOCAL resolver, so nothing of it was ever sent to an account of another cloud.
      sent[field.key] = typeof value === 'string' && isPath(value) ? await sendUp(value) : value
    }

    return sent
  }

  /**
   * The state of one task, asked together with every other poll of the same beat.
   *
   * Their reference recommends the grouped read over one request per task, and five generations
   * being watched is five requests a beat otherwise — against a limiter nothing here can see,
   * since their responses carry no rate headers (measured).
   */
  const stateOf = async (taskId: string): Promise<TripoTask | undefined> => {
    if (!batch) {
      const ids = new Set<string>()
      const answer = (async (): Promise<Map<string, TripoTask>> => {
        await deps.gather(deps.gatherMs ?? DEFAULT_GATHER_MS)
        batch = null
        const tasks = await held().status([...ids])
        return new Map(tasks.map(task => [task.taskId, task]))
      })()
      batch = { ids, answer }
    }

    batch.ids.add(taskId)
    return (await batch.answer).get(taskId)
  }

  /** Brings the result down while its URL is still signed, and keeps where it landed. */
  const bringDown = async (entry: TripoEntry, task: TripoTask): Promise<void> => {
    if (!task.outputUrl) {
      deps.log('warn', `Tripo task ${task.taskId} succeeded with nothing to download`)
      return
    }

    const shelf = SHELF[entry.family] ?? 'mesh'
    const extension = extensionOfUrl(task.outputUrl, shelf === 'mesh' ? 'glb' : 'png')
    const destination = await deps.destinationFor(task.taskId, extension)
    await deps.writeFile(destination, await deps.download(task.outputUrl))

    // The prompt is empty after a relaunch, and that is the honest answer: the collector names
    // the asset after `authored` when the note carried one, and after the job's label otherwise.
    produced.set(task.taskId, {
      path: destination,
      type: shelf,
      prompt: asked.get(task.taskId) ?? '',
    })
    forgetOldest()
  }

  const answerFor = (task: TripoTask): RemoteJob => ({
    jobId: task.taskId,
    status: task.status,
    assetIds: [],
    ...(task.progress === undefined ? {} : { progress: task.progress }),
    // In CREDITS, and said so: a Tripo credit is not a creative unit, and the row that draws
    // the figure must not label it with the other cloud's word.
    ...(task.credits === undefined ? {} : { cost: task.credits, costUnit: CREDIT_UNIT }),
  })

  const entryFor = (target: JobTarget): TripoEntry => {
    const entry = tripoEntryOf(target.id)
    if (!entry) throw new Error(`${target.id} names no Tripo endpoint this build publishes`)

    return entry
  }

  return {
    submit: async (target, body) => {
      const entry = entryFor(target)
      const taskId = await held().create(entry.endpoint, await bodyFor(entry, body))
      const prompt = body[PROMPT_FIELD_KEY]
      asked.set(taskId, typeof prompt === 'string' ? prompt : '')

      return { jobId: taskId, status: 'queued', assetIds: [] }
    },

    poll: async (taskId, target) => {
      const task = await stateOf(taskId)
      // Rejected rather than reported failed: a task their listing left out is one this poll
      // knows nothing about, and calling it failed would drop a generation that is still running.
      if (!task) throw new Error(`Tripo said nothing about ${taskId}`)

      if (task.status === 'success' && !produced.has(taskId)) {
        await bringDown(entryFor(target), task)
      }

      return answerFor(task)
    },

    // 🛑 Refused, and it is the whole of decision 7: their reference publishes no cancellation,
    // so a job reported as stopped would go on running and go on being billed. The window greys
    // the button and says why; anything reaching here is told the same thing.
    cancel: taskId =>
      Promise.reject(new TripoError(0, 0, `Tripo does not stop a task it has started (${taskId})`)),

    forget: taskId => {
      asked.delete(taskId)
    },

    producedBy: taskId => produced.get(taskId) ?? null,

    owns: taskId => asked.has(taskId) || produced.has(taskId),
  }
}
