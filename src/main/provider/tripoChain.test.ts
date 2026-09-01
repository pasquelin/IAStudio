import { createServer } from 'node:http'
import { existsSync } from 'node:fs'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Asset } from '@shared/domain/asset'
import type { Job } from '@shared/domain/job'
import { TRIPO_CATALOGUE, tripoModelId } from '@shared/domain/tripo'
import { createLocalCollector } from '@main/assets/localCollector'
import type { LocalBackend } from '@main/assets/localBackend'
import { createJobManager, type JobAccount } from './jobManager'
import { createTripoApi } from './tripoApi'
import { createTripoRunner, tripoLaneOf } from './tripoRunner'

/**
 * The CHAIN, against a real socket: submit, follow, bring the result down, file it.
 *
 * Every link has its own suite; nothing measured them TOGETHER, and that is where the defects of
 * an integration live — a body composed one way and read another, a poll that never settles, a
 * file downloaded to a path nobody collects. No credit is spent: the service here is ours.
 */

type Recorded = { path: string; body: unknown; authorization: string | null }

const MESH_ENTRY = TRIPO_CATALOGUE.find(
  one => one.endpoint === 'generation/text-to-model' && one.model === 'v3.1-20260211',
)
const PICTURE_ENTRY = TRIPO_CATALOGUE.find(one => one.endpoint === 'generation/text-to-image')

const MESH_TARGET = { id: tripoModelId(MESH_ENTRY ?? TRIPO_CATALOGUE[0]!) }

const GLB = new Uint8Array([0x67, 0x6c, 0x54, 0x46])

/** What the catalogue answers once the file is in: only its id is read back here. */
const asset = (): Asset => ({
  id: 'asset-1',
  name: 'A wooden chest',
  type: 'mesh',
  location: 'local',
  tags: [],
  createdAt: '2026-08-31T10:00:00.000Z',
})

/** What their service answers, reduced to what this chain asks of it. */
function fakeTripo(state: { status: string; progress: number }) {
  const seen: Recorded[] = []
  let downloads = 0

  const server = createServer((request, response) => {
    const chunks: Buffer[] = []
    request.on('data', chunk => chunks.push(chunk as Buffer))
    request.on('end', () => {
      const path = request.url ?? ''
      const raw = Buffer.concat(chunks).toString()
      const body: unknown = raw ? JSON.parse(raw) : null
      seen.push({ path, body, authorization: request.headers.authorization ?? null })

      const send = (payload: unknown): void => {
        response.writeHead(200, { 'content-type': 'application/json' })
        response.end(JSON.stringify(payload))
      }

      if (path.endsWith('/generation/text-to-model') || path.endsWith('/generation/text-to-image'))
        return send({ code: 0, status: 'success', data: { task_id: 'task-uuid-1' } })

      if (path.endsWith('/tasks/list'))
        return send({
          code: 0,
          status: 'success',
          // Indexed by task id, as the live service answers — measured 2026-08-31.
          data: {
            tasks: {
              'task-uuid-1': {
                status: state.status,
                progress: state.progress,
                credits_consumed: 10,
                ...(state.status === 'success'
                  ? { output: { model_url: `http://127.0.0.1:${port()}/cdn/out.glb?X-Amz=1` } }
                  : {}),
              },
            },
          },
        })

      if (path.startsWith('/cdn/')) {
        downloads += 1
        response.writeHead(200, { 'content-type': 'model/gltf-binary' })
        return response.end(Buffer.from(GLB))
      }

      response.writeHead(404, { 'content-type': 'application/json' })
      response.end(JSON.stringify({ code: 1000, status: 'error', message: 'no such endpoint' }))
    })
  })

  const port = (): number => (server.address() as AddressInfo).port

  return { server, seen, port, downloads: () => downloads }
}

describe('a Tripo generation, end to end over a real socket', () => {
  let service: ReturnType<typeof fakeTripo>
  let folder: string
  const state = { status: 'running', progress: 40 }
  const imported: { request: unknown; source: string }[] = []

  beforeAll(async () => {
    service = fakeTripo(state)
    await new Promise<void>(resolve => service.server.listen(0, '127.0.0.1', resolve))
    folder = await mkdtemp(join(tmpdir(), 'tripo-chain-'))
  })

  afterAll(async () => {
    await new Promise<void>(resolve => void service.server.close(() => resolve()))
    await rm(folder, { recursive: true, force: true })
  })

  const runnerOf = () => {
    // ONE client, as `services.ts` holds one: it remembers whether their grouped read is served,
    // and a fresh client per call would never exercise that latch.
    const api = createTripoApi({
      key: () => 'the-key',
      baseUrl: `http://127.0.0.1:${service.port()}/v3`,
    })
    return createTripoRunner({
      api: () => api,
      download: async url => new Uint8Array(await (await fetch(url)).arrayBuffer()),
      readFile: path => readFile(path),
      writeFile: (path, bytes) => writeFile(path, bytes),
      destinationFor: (taskId, extension) => Promise.resolve(join(folder, `${taskId}${extension}`)),
      gather: () => Promise.resolve(),
      gatherMs: 0,
      log: () => {},
    })
  }

  /**
   * The one door of the port this chain reaches. `as`: `LocalBackend` publishes nine, and the
   * eight others are unreachable from here — a stub of all nine would assert nothing more.
   */
  const backend = (): LocalBackend =>
    ({
      importFromFile: (request: unknown, sourcePath: string) => {
        imported.push({ request, source: sourcePath })
        return Promise.resolve(asset())
      },
    }) as unknown as LocalBackend

  it('sends the form, follows the task, brings the result down and files it', async () => {
    const tripo = runnerOf()
    const account: JobAccount = {
      runner: tripo,
      collect: createLocalCollector({
        producedBy: jobId => tripo.producedBy(jobId),
        discard: path => rm(path, { force: true }),
        backend: backend(),
        newId: () => 'asset-1',
        log: () => {},
      }),
    }

    const settled = new Promise<Job>(resolve => {
      const manager = createJobManager({
        accounts: { active: () => ({ id: 'tripo', account }), of: () => account },
        projectPath: () => '/projects/kingdom',
        projectNameOf: () => 'Royaume',
        persist: () => {},
        concurrency: () => 2,
        maxRetries: () => 1,
        resolveAssetInputs: body => Promise.resolve(body),
        onProgress: progress => {
          // The whole point of following: the studio learns it is running before it is done.
          if (progress.status === 'succeeded') resolve(progress as unknown as Job)
        },
        onListChanged: () => {},
        record: () => {},
        now: () => '2026-08-31T10:00:00.000Z',
        newId: () => 'job-1',
        sleep: () => Promise.resolve(),
        pollIntervalMs: 1,
        cancellableTarget: targetId => tripoLaneOf(targetId) === null,
      })

      manager.submit(MESH_TARGET, 'Tripo v3.1', { prompt: 'a wooden chest', texture: false })
      // Their task turns while the studio is watching it, exactly as a real one would.
      setTimeout(() => {
        state.status = 'success'
        state.progress = 100
      }, 20)
    })

    const job = await settled

    // 1. what LEFT: the endpoint the entry names, the model beside it, the key on the header.
    const created = service.seen.find(one => one.path.endsWith('/generation/text-to-model'))
    expect(created?.authorization).toBe('Bearer the-key')
    expect(created?.body).toEqual({
      model: 'v3.1-20260211',
      prompt: 'a wooden chest',
      texture: false,
    })

    // 2. the FOLLOW went through the grouped read, never one request per task.
    expect(service.seen.some(one => one.path.endsWith('/tasks/list'))).toBe(true)
    expect(service.seen.some(one => one.path.includes('/tasks/task-uuid-1'))).toBe(false)

    // 3. the result came DOWN while its URL was signed, and the bytes are theirs.
    expect(service.downloads()).toBe(1)
    expect(imported).toHaveLength(1)
    expect(imported[0]?.source).toBe(join(folder, 'task-uuid-1.glb'))
    // Dropped once the project holds it: the hand-off is ours to file AND ours to delete.
    expect(existsSync(join(folder, 'task-uuid-1.glb'))).toBe(false)

    // 4. and the studio settled on it, in THEIR unit.
    expect(job.status).toBe('succeeded')
    expect(job.cost).toBe(10)
    expect(job.costUnit).toBe('credits')
  })

  /**
   * Their picture lane admits ONE at a time. Measured here rather than deduced: the manager holds
   * the second submission itself, so nothing leaves and no 429 is spent to discover it.
   */
  it('holds a second picture back rather than spend a refusal to learn the ceiling', async () => {
    const started: string[] = []
    const target = { id: tripoModelId(PICTURE_ENTRY ?? TRIPO_CATALOGUE[0]!) }
    const held = new Promise<void>(() => {})

    const account: JobAccount = {
      runner: {
        submit: target => {
          started.push(target.id)
          return held as Promise<never>
        },
        poll: () => held as Promise<never>,
        cancel: () => Promise.resolve(),
      },
      collect: () => Promise.resolve({ ids: [], workspaces: [] }),
    }

    const manager = createJobManager({
      accounts: { active: () => ({ id: 'tripo', account }), of: () => account },
      projectPath: () => '/projects/kingdom',
      projectNameOf: () => 'Royaume',
      persist: () => {},
      concurrency: () => 5,
      maxRetries: () => 0,
      resolveAssetInputs: body => Promise.resolve(body),
      onProgress: () => {},
      onListChanged: () => {},
      record: () => {},
      now: () => '2026-08-31T10:00:00.000Z',
      newId: () => `job-${started.length}`,
      sleep: () => Promise.resolve(),
      lane: tripoLaneOf,
    })

    manager.submit(target, 'One', { prompt: 'a hat' })
    manager.submit(target, 'Two', { prompt: 'a boat' })
    await new Promise(resolve => setImmediate(resolve))

    expect(started).toEqual([target.id])
    expect(tripoLaneOf(target.id)).toEqual({ name: 'image', limit: 1 })
  })
})
