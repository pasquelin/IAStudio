import { Texture, type Material, type WebGLRenderer, type WebGLRenderTarget } from 'three'
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { NEUTRAL_ADJUSTMENTS } from '@shared/domain/adjustments'
import type * as AdjustModule from './passes/adjust'
import { createSkyGrading } from './skyGrading'

type FakeTarget = { width: number; height: number; texture: Texture; dispose: Mock<() => void> }

const targets: FakeTarget[] = []
const renderTo = vi.fn<(material: Material, target: WebGLRenderTarget) => void>()
const disposePipeline = vi.fn()

vi.mock('./gpuPipeline', () => ({
  createGpuPipeline: () => ({
    renderTo,
    renderToScreen: vi.fn(),
    createTarget: (width: number, height: number) => {
      const target: FakeTarget = { width, height, texture: new Texture(), dispose: vi.fn() }
      targets.push(target)
      return target
    },
    dispose: disposePipeline,
  }),
}))

let adjust: AdjustModule.AdjustPass

vi.mock('./passes/adjust', async importOriginal => {
  const actual = await importOriginal<typeof AdjustModule>()
  return {
    ...actual,
    createAdjustPass: () => {
      adjust = { ...actual.createAdjustPass(), setSource: vi.fn(), setAdjustments: vi.fn() }
      return adjust
    },
  }
})

/** A source that measures, so the working size is read rather than guessed. */
const sourceOf = (width: number): Texture => {
  const texture = new Texture()
  texture.image = { width, height: width / 2 }
  return texture
}

const GRADED = { ...NEUTRAL_ADJUSTMENTS, exposure: 1 }

describe('grading a sky', () => {
  // `as`: the pipeline is mocked above, and it is the only thing the renderer reaches.
  const gradingOf = () => createSkyGrading({} as WebGLRenderer)

  beforeEach(() => {
    targets.length = 0
    vi.clearAllMocks()
  })

  it('hands back the source itself when nothing is graded, drawing nothing', () => {
    const source = sourceOf(1024)

    expect(gradingOf().of(source, NEUTRAL_ADJUSTMENTS)).toBe(source)
    expect(targets).toHaveLength(0)
    expect(renderTo).not.toHaveBeenCalled()
  })

  it('draws the pass into a target and hands back what it holds', () => {
    const source = sourceOf(1024)

    const graded = gradingOf().of(source, GRADED)

    expect(adjust.setSource).toHaveBeenCalledWith(source)
    expect(adjust.setAdjustments).toHaveBeenCalledWith(GRADED)
    expect(renderTo).toHaveBeenCalledWith(adjust.material, targets[0])
    expect(graded).toBe(targets[0]?.texture)
  })

  it('grades at the source size, half as tall as it is wide', () => {
    gradingOf().of(sourceOf(1024), GRADED)

    expect(targets[0]?.width).toBe(1024)
    expect(targets[0]?.height).toBe(512)
  })

  // 8 bytes a pixel in half float: an uncapped 8192-wide source would be 268 MB of GPU memory.
  it('caps the working size, whatever the source measures', () => {
    gradingOf().of(sourceOf(8192), GRADED)

    expect(targets[0]?.width).toBe(2048)
  })

  it('keeps one target across grades of the same picture', () => {
    const grading = gradingOf()
    const source = sourceOf(1024)

    grading.of(source, GRADED)
    grading.of(source, { ...GRADED, contrast: 1.2 })

    expect(targets).toHaveLength(1)
  })

  it('takes a new target when the picture changes size, and frees the one it leaves', () => {
    const grading = gradingOf()

    grading.of(sourceOf(1024), GRADED)
    grading.of(sourceOf(512), GRADED)

    expect(targets).toHaveLength(2)
    expect(targets[0]?.dispose).toHaveBeenCalled()
  })

  it('grades nothing without a source', () => {
    expect(gradingOf().of(null, GRADED)).toBeNull()
    expect(targets).toHaveLength(0)
  })

  it('frees the target and the pass it built', () => {
    const grading = gradingOf()
    grading.of(sourceOf(1024), GRADED)

    grading.dispose()

    expect(targets[0]?.dispose).toHaveBeenCalled()
    expect(disposePipeline).toHaveBeenCalled()
  })
})
