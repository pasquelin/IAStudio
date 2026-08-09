import { readFileSync } from 'node:fs'
import { Texture } from 'three'
import { describe, expect, it } from 'vitest'
import { CROSS_CELLS, CROSS_COLUMNS, CROSS_ROWS, CUBE_FACES } from '@shared/domain/skybox'
import { createProjectionPass, LAYOUT_ASPECT } from './projection-shader'

const shaderOf = (): string => createProjectionPass().material.fragmentShader

describe('the projection shader', () => {
  /**
   * The one thing that cannot be approximated. three maps a direction onto an equirectangular
   * picture in `common.glsl.js`, and the immersive background of this very viewport uses it: a
   * formula that merely looks right would show the unfolded cross a quarter turn off the sky
   * beside it, and nothing on screen would say which of the two is wrong.
   *
   * Read out of three rather than restated, so a change upstream fails here instead of on screen.
   */
  it('maps a direction the way three does, read out of three', () => {
    const common = readFileSync(
      'node_modules/three/src/renderers/shaders/ShaderChunk/common.glsl.js',
      'utf8',
    )

    // The two lines of `equirectUv`, stripped of the spacing three writes them with.
    const bare = common.replace(/\s+/g, '')
    expect(bare).toContain('atan(dir.z,dir.x)')
    expect(bare).toContain('asin(clamp(dir.y,-1.0,1.0))')

    const ours = shaderOf().replace(/\s+/g, '')
    expect(ours).toContain('atan(d.z,d.x)')
    expect(ours).toContain('asin(clamp(d.y,-1.0,1.0))')
  })

  /**
   * The cross is the domain's layout, not the shader's. Written by hand a second time, the two
   * would be free to disagree — and the disagreement would look like a rendering bug.
   */
  it('places every face where the domain says, and nothing where it says nothing', () => {
    const shader = shaderOf()

    for (const [index, face] of CUBE_FACES.entries()) {
      const cell = CROSS_CELLS[face]
      expect(shader).toContain(
        `if (column == ${cell.column} && row == ${cell.row}) return ${index}.0;`,
      )
    }

    // Six faces on a grid of twelve cells: the other six are holes, and a hole is discarded.
    const branches = shader.match(/if \(column == \d+ && row == \d+\)/g)
    expect(branches).toHaveLength(CUBE_FACES.length)
    expect(CROSS_COLUMNS * CROSS_ROWS).toBeGreaterThan(CUBE_FACES.length)
  })

  /** Each layout is fitted whole into the frame: a sky judged on a stretched picture is not judged. */
  it('knows the shape each layout wants', () => {
    expect(LAYOUT_ASPECT.equirect).toBe(2)
    expect(LAYOUT_ASPECT.cross).toBe(CROSS_COLUMNS / CROSS_ROWS)
    expect(LAYOUT_ASPECT.single).toBe(1)
  })
})

describe('a projection pass', () => {
  it('carries the layout and its shape together', () => {
    const pass = createProjectionPass()

    pass.setLayout('cross')

    expect(pass.uniforms.uLayout.value).toBe(1)
    expect(pass.uniforms.uLayoutAspect.value).toBe(LAYOUT_ASPECT.cross)
  })

  /** The export's mode: one face, filling the frame, named by the domain's own order. */
  it('takes a face for the single layout', () => {
    const pass = createProjectionPass()

    pass.setLayout('single', 'nz')

    expect(pass.uniforms.uLayout.value).toBe(3)
    expect(pass.uniforms.uFace.value).toBe(CUBE_FACES.indexOf('nz'))
  })

  it('keeps the face it was last given when a layout arrives without one', () => {
    const pass = createProjectionPass()

    pass.setLayout('single', 'py')
    pass.setLayout('cross')

    expect(pass.uniforms.uFace.value).toBe(CUBE_FACES.indexOf('py'))
  })

  it('reads the frame as a ratio, and survives one with no height', () => {
    const pass = createProjectionPass()

    pass.setFrame(1600, 800)
    expect(pass.uniforms.uFrameAspect.value).toBe(2)

    // A panel folded to nothing measures zero, and a division by it would poison every pixel.
    pass.setFrame(1600, 0)
    expect(pass.uniforms.uFrameAspect.value).toBe(1)
  })

  it('takes the picture to sample, and lets go of it', () => {
    const pass = createProjectionPass()
    const texture = new Texture()

    pass.setSource(texture)
    expect(pass.uniforms.uSource.value).toBe(texture)

    pass.setSource(null)
    expect(pass.uniforms.uSource.value).toBeNull()
  })

  /** Drawn over a scene already rendered: depth-tested, it would lose to the ground plane. */
  it('draws over whatever is already in the frame', () => {
    const pass = createProjectionPass()

    expect(pass.material.depthTest).toBe(false)
    expect(pass.material.depthWrite).toBe(false)
  })
})
