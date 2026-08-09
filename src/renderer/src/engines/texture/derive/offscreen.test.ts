import { ShaderMaterial, Texture } from 'three'
import { describe, expect, it, vi } from 'vitest'
import { runOffscreenPass } from './offscreen'

/** A source that decodes, so a run reaches the pass and stops where the GPU would be. */
const decoded = (): Texture => {
  const texture = new Texture()
  texture.image = { width: 8, height: 8 }
  return texture
}

/**
 * Everything below `withRenderer` needs a GPU, and jsdom has none — which is exactly what makes
 * the order of the steps readable here: each run gets as far as building its pass, then throws.
 */
describe('an off-screen pass', () => {
  it('runs one at a time, whoever asks', async () => {
    const order: string[] = []
    const run = (name: string): Promise<number> =>
      runOffscreenPass({
        load: () => {
          order.push(`load ${name}`)
          return Promise.resolve(decoded())
        },
        url: 'asset://a',
        pass: () => {
          order.push(`pass ${name}`)
          return { material: new ShaderMaterial() }
        },
        draw: () => 1,
      })

    // Started together, as the channel grid and the measure button do: neither knows about the
    // other, and two contexts at once evict a viewport somebody was looking at.
    await Promise.allSettled([run('a'), run('b')])

    expect(order).toEqual(['load a', 'pass a', 'load b', 'pass b'])
  })

  /** One refused context must not reject every pass behind it, for the life of the window. */
  it('runs the next one when the one before it failed', async () => {
    const refused = runOffscreenPass({
      load: () => Promise.reject(new Error('the picture never decoded')),
      url: 'asset://a',
      pass: () => ({ material: new ShaderMaterial() }),
      draw: () => 1,
    })
    await expect(refused).rejects.toThrow(/never decoded/)

    const pass = vi.fn(() => ({ material: new ShaderMaterial() }))
    await expect(
      runOffscreenPass({
        load: () => Promise.resolve(decoded()),
        url: 'asset://b',
        pass,
        draw: () => 1,
      }),
    ).rejects.toThrow()

    expect(pass).toHaveBeenCalled()
  })

  /**
   * The frame a reduction draws into is one texel; what the pass reads is still the whole
   * picture, and one texel OF IT is what its uv step measures. Only the second half is visible
   * from jsdom — the frame the renderer was sized to needs a GPU to be read back.
   */
  it('builds the pass on the source, whatever frame it draws into', async () => {
    const sizes: { width: number; height: number }[] = []

    await expect(
      runOffscreenPass({
        load: () => Promise.resolve(decoded()),
        url: 'asset://a',
        pass: (_source, size) => {
          sizes.push(size)
          return { material: new ShaderMaterial() }
        },
        frame: () => ({ width: 1, height: 1 }),
        draw: () => 1,
      }),
    ).rejects.toThrow()

    expect(sizes).toEqual([{ width: 8, height: 8 }])
  })

  /** A material built for a run that never reached the GPU is a program left on the card. */
  it('frees the pass it built even when the draw never happened', async () => {
    const material = new ShaderMaterial()
    const freed = vi.spyOn(material, 'dispose')

    await expect(
      runOffscreenPass({
        load: () => Promise.resolve(decoded()),
        url: 'asset://a',
        pass: () => ({ material }),
        draw: () => 1,
      }),
    ).rejects.toThrow()

    expect(freed).toHaveBeenCalled()
  })
})
