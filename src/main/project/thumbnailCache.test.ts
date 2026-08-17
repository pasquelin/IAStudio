import { mkdir, mkdtemp, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { THUMBNAILS_FOLDER } from '@shared/domain/project'
import { createThumbnailCache, type ThumbnailCacheDeps } from './thumbnailCache'

let root = ''

const rendered = (bytes = 16): Uint8Array => new Uint8Array(bytes).fill(7)

const cache = (overrides: Partial<ThumbnailCacheDeps> = {}) =>
  createThumbnailCache({
    projectPath: () => root,
    render: async () => rendered(),
    concurrency: () => 2,
    ...overrides,
  })

const put = async (relative: string, bytes = new Uint8Array([1, 2, 3])): Promise<void> => {
  await mkdir(join(root, dirname(relative)), { recursive: true })
  await writeFile(join(root, relative), bytes)
}

const held = (): Promise<string[]> => readdir(join(root, THUMBNAILS_FOLDER))

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'thumbs-'))
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

describe('createThumbnailCache', () => {
  it('renders a preview once and keeps it under the project index', async () => {
    await put('Images/facade.jpg')
    const render = vi.fn(async () => rendered())
    const thumbnails = cache({ render })

    const first = await thumbnails.of('Images/facade.jpg')
    const second = await thumbnails.of('Images/facade.jpg')

    expect(first).toBe(second)
    expect(first).toContain(THUMBNAILS_FOLDER)
    expect(render).toHaveBeenCalledOnce()
  })

  /**
   * Keyed on what the file IS, not on its name: a picture overwritten in place keeps its path,
   * and a cache keyed on the path alone would answer with the picture that is gone.
   */
  it('renders again once the file behind it has changed', async () => {
    await put('Images/facade.jpg')
    const render = vi.fn(async () => rendered())
    const thumbnails = cache({ render })
    const before = await thumbnails.of('Images/facade.jpg')

    await put('Images/facade.jpg', new Uint8Array([9, 9, 9, 9, 9, 9]))
    const after = await thumbnails.of('Images/facade.jpg')

    expect(after).not.toBe(before)
    expect(render).toHaveBeenCalledTimes(2)
  })

  it('answers nothing for what it cannot draw, and writes nothing either', async () => {
    await put('Models/chair.glb')
    await mkdir(join(root, 'Textures'), { recursive: true })
    const thumbnails = cache({ render: async () => null })

    expect(await thumbnails.of('Models/chair.glb')).toBeNull()
    expect(await thumbnails.of('Textures')).toBeNull()
    expect(await thumbnails.of('Images/gone.jpg')).toBeNull()
    await expect(held()).rejects.toThrow()
  })

  // The path comes from a window, and this is the one host of the scheme named by a path.
  it('refuses a path that walks out of the project', async () => {
    const render = vi.fn(async () => rendered())

    expect(await cache({ render }).of('../../.ssh/id_rsa')).toBeNull()
    expect(render).not.toHaveBeenCalled()
  })

  it('answers nothing while no project is open', async () => {
    expect(await cache({ projectPath: () => null }).of('Images/facade.jpg')).toBeNull()
  })

  /**
   * The least recently READ goes, not the first written — which is why a hit touches the file
   * it serves. A cache that dropped the oldest entry would evict the folder the user lives in.
   */
  it('drops the least recently read once the ceiling is passed', async () => {
    await put('Images/one.jpg')
    await put('Images/two.jpg')
    await put('Images/three.jpg')
    let clock = new Date('2026-08-17T10:00:00.000Z')
    const thumbnails = cache({
      render: async () => rendered(64),
      maxBytes: 140,
      now: () => (clock = new Date(clock.getTime() + 1000)),
    })

    const one = await thumbnails.of('Images/one.jpg')
    const two = await thumbnails.of('Images/two.jpg')
    // A HIT on the first: `two` becomes the stalest of the two, though it was written second.
    await thumbnails.of('Images/one.jpg')
    await thumbnails.of('Images/three.jpg')

    expect(await stat(one!).catch(() => null)).not.toBeNull()
    expect(await stat(two!).catch(() => null)).toBeNull()
    expect(await held()).toHaveLength(2)
  })
})
