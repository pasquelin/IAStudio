import { MeshMatcapMaterial, MeshStandardMaterial, Texture } from 'three'
import { describe, expect, it } from 'vitest'
import { createPaneMaterials } from './pane-materials'

describe('the stand-in materials a view paints with', () => {
  it('hands back nothing for a view that draws the real materials', () => {
    const materials = createPaneMaterials()

    expect(materials.materialFor('none', 0)).toBeNull()

    materials.dispose()
  })

  it('shares one material per substitute, however many meshes ask', () => {
    const materials = createPaneMaterials()

    expect(materials.materialFor('solid', 0)).toBe(materials.materialFor('solid', 0))
    expect(materials.materialFor('matcap', 0)).toBe(materials.materialFor('matcap', 0))
    expect(materials.materialFor('solid', 0)).not.toBe(materials.materialFor('matcap', 0))

    materials.dispose()
  })

  it('colours density in steps, so a crowded scene builds a handful of materials', () => {
    const materials = createPaneMaterials()

    // Same step, same material; far apart, different ones.
    expect(materials.materialFor('density', 0)).toBe(materials.materialFor('density', 1))
    expect(materials.materialFor('density', 0)).not.toBe(materials.materialFor('density', 400))

    materials.dispose()
  })

  /** Which is how a pass tells the model's own material from the one the last pass left. */
  it('recognises its own, and only its own', () => {
    const materials = createPaneMaterials()
    const solid = materials.materialFor('solid', 0)
    if (!solid) throw new Error('the solid view draws with something')

    expect(materials.owns(solid)).toBe(true)
    expect(materials.owns([solid])).toBe(true)
    expect(materials.owns(new MeshStandardMaterial())).toBe(false)
    expect(materials.owns([new MeshStandardMaterial()])).toBe(false)

    materials.dispose()
  })

  /**
   * The branch jsdom can never reach on its own: no 2D context means no drawn matcap, so the
   * half that HAS one would ship unexecuted. Handed one, the material wears it.
   */
  it('wears the matcap it is given, and falls back to clay without one', () => {
    const drawn = new Texture()
    const withMatcap = createPaneMaterials(() => drawn)
    const without = createPaneMaterials(() => null)

    const lit = withMatcap.materialFor('matcap', 0)
    const bare = without.materialFor('matcap', 0)
    if (!(lit instanceof MeshMatcapMaterial) || !(bare instanceof MeshMatcapMaterial)) {
      throw new Error('the matcap view draws with a matcap material')
    }

    expect(lit.matcap).toBe(drawn)
    expect(bare.matcap).toBeNull()

    withMatcap.dispose()
    without.dispose()
  })

  it('caps the ramp rather than growing one material per value', () => {
    const materials = createPaneMaterials()

    const built = new Set(
      Array.from({ length: 200 }, (_, index) => materials.materialFor('density', index * 7)),
    )

    // Eleven steps, zero through ten.
    expect(built.size).toBeLessThanOrEqual(11)

    materials.dispose()
  })
})
