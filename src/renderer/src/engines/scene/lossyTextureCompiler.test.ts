import { describe, expect, it, vi } from 'vitest'
import { NO_LOSSY_OPTIMIZATION, type ExportedAssetOverride } from '@shared/domain/gameExport'
import { compileLossyTextures } from './lossyTextureCompiler'

describe('LOSSY textures compiled for a game export', () => {
  it('does no asset work while every texture choice is off', async () => {
    const read = vi.fn()
    const transform = vi.fn()

    expect(
      await compileLossyTextures(['texture'], NO_LOSSY_OPTIMIZATION, {}, { read, transform }),
    ).toEqual([])
    expect(read).not.toHaveBeenCalled()
    expect(transform).not.toHaveBeenCalled()
  })

  it('reads and transforms each texture with policy values and reports progress', async () => {
    const onProgress = vi.fn()
    const transform = vi.fn(async (id: string): Promise<ExportedAssetOverride> => ({
      id,
      bytes: new Uint8Array([7]),
      extension: 'jpg',
    }))

    const compiled = await compileLossyTextures(
      ['one', 'two'],
      {
        ...NO_LOSSY_OPTIMIZATION,
        textureReduction: 'half',
        textureCompression: 'balanced',
      },
      { onProgress },
      { read: async () => new Uint8Array([1]), transform },
    )

    expect(compiled.map(asset => asset.id)).toEqual(['one', 'two'])
    expect(transform).toHaveBeenCalledWith('one', new Uint8Array([1]), 0.5, 0.75, undefined)
    expect(onProgress.mock.calls).toEqual([
      [1, 2],
      [2, 2],
    ])
  })

  it('stops before reading another texture after cancellation', async () => {
    const controller = new AbortController()
    const read = vi.fn(async () => new Uint8Array([1]))
    const transform = vi.fn(async (id: string): Promise<ExportedAssetOverride> => {
      controller.abort()
      return { id, bytes: new Uint8Array([2]), extension: 'png' }
    })

    await expect(
      compileLossyTextures(
        ['one', 'two'],
        { ...NO_LOSSY_OPTIMIZATION, textureReduction: 'half' },
        { signal: controller.signal },
        { read, transform },
      ),
    ).rejects.toMatchObject({ name: 'AbortError' })
    expect(read).toHaveBeenCalledTimes(1)
  })

  it('leaves a missing texture for the package report instead of failing preparation', async () => {
    const transform = vi.fn()

    expect(
      await compileLossyTextures(
        ['lost'],
        { ...NO_LOSSY_OPTIMIZATION, textureReduction: 'half' },
        {},
        { read: async () => null, transform },
      ),
    ).toEqual([])
    expect(transform).not.toHaveBeenCalled()
  })
})
