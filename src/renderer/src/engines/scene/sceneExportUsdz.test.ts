import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from 'three'
import { describe, expect, it } from 'vitest'
import { exportObjects } from './sceneExport'

/**
 * The USDZ half of `sceneExport`, apart from the rest because it must run WITHOUT jsdom.
 *
 * `USDZExporter` zips through fflate, which tells a file from a folder by `instanceof Uint8Array`
 * — and under jsdom that test fails across realms, so every byte of `model.usda` becomes its own
 * zip entry. Measured 20/08 on one box: 4 223 bytes here, 496 168 under jsdom. A case reading the
 * crate there would be reading a file the application never writes.
 *
 * The crate itself is `.usda` text, so what a reader would see is readable here.
 */

function named(name: string): Mesh {
  const mesh = new Mesh(new BoxGeometry(), new MeshStandardMaterial())
  mesh.name = name
  return mesh
}

const defsIn = (crate: Uint8Array): string[] =>
  [...new TextDecoder().decode(crate).matchAll(/def (\w+) "([^"]+)"/g)].map(
    one => `${one[1]}:${one[2]}`,
  )

describe('exportObjects to USDZ', () => {
  it('writes one object, and writes several', async () => {
    expect(defsIn(await exportObjects([named('box-1')], 'usdz'))).toContain('Xform:box1')
    expect(defsIn(await exportObjects([named('box-1'), named('box-2')], 'usdz'))).toEqual(
      expect.arrayContaining(['Xform:box1', 'Xform:box2']),
    )
  })

  /**
   * `USDZExporter` tests `isScene` exactly as `GLTFExporter` does, so several roots handed over
   * under a `Group` were written as one more `Xform` — the node the document never held. The
   * wrapper is what the second half measures: three writes it, and `exportObjects` no longer.
   */
  it('hangs several roots side by side, adding no node of its own', async () => {
    const several = defsIn(await exportObjects([named('box-1'), named('box-2')], 'usdz'))

    expect(several.filter(one => one.startsWith('Xform:'))).toEqual([
      'Xform:Root',
      'Xform:Scene',
      'Xform:box1',
      'Xform:box2',
    ])

    const wrapped = new Group()
    wrapped.add(named('box-1'), named('box-2'))
    expect(defsIn(await exportObjects([wrapped], 'usdz'))).toContain('Xform:Object')
  })
})
