import { bench, describe } from 'vitest'
import { MeshStandardMaterial, SphereGeometry } from 'three'
import { NO_LOSSY_OPTIMIZATION } from '@shared/domain/gameExport'
import { lossyGeometryFor } from './lossyGeometry'

const geometry = new SphereGeometry(1, 64, 32)
const material = new MeshStandardMaterial()

describe('explicit geometry losses', () => {
  bench('keeps the original geometry path', async () => {
    const build = await lossyGeometryFor(NO_LOSSY_OPTIMIZATION)
    await build.build(geometry, material)
    build.dispose()
  })

  bench('generates distance levels', async () => {
    const build = await lossyGeometryFor({ ...NO_LOSSY_OPTIMIZATION, generateLods: true })
    await build.build(geometry, material)
    build.dispose()
  })

  bench('builds one aggressive representation', async () => {
    const build = await lossyGeometryFor({
      ...NO_LOSSY_OPTIMIZATION,
      geometrySimplification: 'aggressive',
    })
    await build.build(geometry, material)
    build.dispose()
  })
})
