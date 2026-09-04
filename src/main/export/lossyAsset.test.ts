import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NO_LOSSY_OPTIMIZATION } from '@shared/domain/gameExport'

const calls = vi.hoisted(() => ({ jpeg: [] as number[], resize: [] as unknown[] }))

vi.mock('electron', () => ({
  nativeImage: {
    createFromBuffer: () => ({
      isEmpty: () => false,
      getSize: () => ({ width: 800, height: 400 }),
      resize: (options: unknown) => {
        calls.resize.push(options)
        return {
          toPNG: () => new Uint8Array([4]),
          toJPEG: (quality: number) => {
            calls.jpeg.push(quality)
            return new Uint8Array([5])
          },
        }
      },
      toPNG: () => new Uint8Array([2]),
      toJPEG: (quality: number) => {
        calls.jpeg.push(quality)
        return new Uint8Array([3])
      },
    }),
  },
}))

import { optimizeLossyAsset } from './lossyAsset'

describe('LOSSY export images', () => {
  beforeEach(() => {
    calls.jpeg.length = 0
    calls.resize.length = 0
  })

  it('leaves bytes and names untouched while every LOSSY texture option is off', async () => {
    const source = { name: 'map.png', bytes: new Uint8Array([1]) }

    expect(await optimizeLossyAsset(source, NO_LOSSY_OPTIMIZATION)).toBe(source)
  })

  it('halves both image dimensions and keeps lossless PNG when only resize was requested', async () => {
    const result = await optimizeLossyAsset(
      { name: 'map.webp', bytes: new Uint8Array([1]) },
      { ...NO_LOSSY_OPTIMIZATION, textureReduction: 'half' },
    )

    expect(calls.resize).toEqual([{ width: 400, height: 200, quality: 'good' }])
    expect(result).toEqual({ name: 'map.png', bytes: new Uint8Array([4]) })
  })

  it('uses the explicit lossy quality and files the result as JPEG', async () => {
    const result = await optimizeLossyAsset(
      { name: 'map.png', bytes: new Uint8Array([1]) },
      { ...NO_LOSSY_OPTIMIZATION, textureCompression: 'aggressive' },
    )

    expect(calls.jpeg).toEqual([55])
    expect(result).toEqual({ name: 'map.jpg', bytes: new Uint8Array([3]) })
  })

  it('does not reinterpret an unsupported container', async () => {
    const source = { name: 'height.exr', bytes: new Uint8Array([1]) }

    expect(
      await optimizeLossyAsset(source, {
        ...NO_LOSSY_OPTIMIZATION,
        textureCompression: 'balanced',
      }),
    ).toBe(source)
  })
})
