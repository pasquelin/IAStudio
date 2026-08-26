import { Data3DTexture } from 'three'
import { describe, expect, it, vi } from 'vitest'
import { createLutCache } from './lutCache'

/** A table with a spy on its own freeing — how a leak is caught without a GPU. */
function table(): { texture: Data3DTexture; freed: ReturnType<typeof vi.spyOn> } {
  const texture = new Data3DTexture()
  return { texture, freed: vi.spyOn(texture, 'dispose') }
}

/** Lets the microtasks the cache queued settle, which is when a load lands. */
const settled = () => new Promise(resolve => setTimeout(resolve, 0))

describe('the tables a grade samples', () => {
  it('answers nothing on the first ask and the table once it has landed', async () => {
    const first = table()
    const cache = createLutCache({ load: async () => first.texture })

    expect(cache.get('lut-1')).toBeNull()
    await settled()

    expect(cache.get('lut-1')).toBe(first.texture)
  })

  it('asks once while a load is in flight, however many frames draw', async () => {
    const load = vi.fn(async () => table().texture)
    const cache = createLutCache({ load })

    cache.get('lut-1')
    cache.get('lut-1')
    cache.get('lut-1')
    await settled()

    expect(load).toHaveBeenCalledTimes(1)
  })

  /**
   * The whole reason this is a module: an asset id NEVER moves. Keyed on the id alone, the first
   * table is handed back for good — ⌘S over a LUT then shows the old grade for the life of the
   * scene, while `loadLutTexture` carries a version stamp that would only ever load once.
   */
  it('reads the table again once the catalogue says the asset has moved', async () => {
    const first = table()
    const second = table()
    let stamp = 'v1'
    const load = vi.fn(async () => (stamp === 'v1' ? first.texture : second.texture))
    const cache = createLutCache({ load, stampOf: () => stamp })

    cache.get('lut-1')
    await settled()
    expect(cache.get('lut-1')).toBe(first.texture)

    stamp = 'v2'
    expect(cache.get('lut-1')).toBeNull()
    await settled()

    expect(cache.get('lut-1')).toBe(second.texture)
    expect(load).toHaveBeenCalledTimes(2)
  })

  // Or a save over a LUT leaves one 3D texture on the GPU per save, asked for by nothing.
  it('frees what the asset was worth before', async () => {
    const first = table()
    let stamp = 'v1'
    const cache = createLutCache({
      load: async () => (stamp === 'v1' ? first.texture : table().texture),
      stampOf: () => stamp,
    })

    cache.get('lut-1')
    await settled()
    stamp = 'v2'
    cache.get('lut-1')
    await settled()

    expect(first.freed).toHaveBeenCalled()
  })

  // A file that failed to parse fails every time: asking again would do it once per frame.
  it('remembers a refusal rather than asking on every frame', async () => {
    const load = vi.fn(async () => {
      throw new Error('not a lut')
    })
    const cache = createLutCache({ load })

    cache.get('lut-1')
    await settled()
    cache.get('lut-1')
    cache.get('lut-1')
    await settled()

    expect(load).toHaveBeenCalledTimes(1)
  })

  it('asks for a frame once something that was loading has arrived', async () => {
    const onReady = vi.fn()
    const cache = createLutCache({ load: async () => table().texture, onReady })

    cache.get('lut-1')
    expect(onReady).not.toHaveBeenCalled()
    await settled()

    expect(onReady).toHaveBeenCalledTimes(1)
  })

  it('frees every table it holds when the scene goes', async () => {
    const one = table()
    const cache = createLutCache({ load: async () => one.texture })

    cache.get('lut-1')
    await settled()
    cache.dispose()

    expect(one.freed).toHaveBeenCalled()
    // And it forgets them: a table freed and handed back again would be sampled after its GPU
    // memory was released.
    expect(cache.get('lut-1')).toBeNull()
  })
})
