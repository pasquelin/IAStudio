import { Texture } from 'three'
import { vi, type Mock } from 'vitest'
import type { TextureSource } from '../scene/texture-cache'
import type { ViewportEnvironment } from './environment'

/**
 * What the three 3D workspaces need to stand in for the GPU, in one place. Every viewport test
 * repeats the same two doubles, and a member added to `ViewportEnvironment` has to reach all of
 * them — `satisfies` makes that a compile error here instead of a run-time "is not a function".
 */
export function fakeEnvironment(): ViewportEnvironment {
  return {
    setTexture: vi.fn(),
    refresh: vi.fn(),
    setStudio: vi.fn(),
    setIntensity: vi.fn(),
    setRotation: vi.fn(),
    setBackgroundVisible: vi.fn(),
    dispose: vi.fn(),
  } satisfies ViewportEnvironment
}

export type FakeTextureSource = {
  load: Mock<TextureSource>
  /** One spy per texture handed out, in the order they were asked for. */
  freed: ReturnType<typeof vi.spyOn>[]
}

/** A source whose textures report their own disposal — how a leak is caught in a cache test. */
export function fakeTextureSource(): FakeTextureSource {
  const freed: ReturnType<typeof vi.spyOn>[] = []

  return {
    load: vi.fn<TextureSource>(async () => {
      const texture = new Texture()
      freed.push(vi.spyOn(texture, 'dispose'))
      return texture
    }),
    freed,
  }
}
