import { expect, it } from 'vitest'
import { glbChunksOf, glbFrom, glbJson } from '@shared/domain/glbContainer'
import { isRecord } from '@shared/guards'
import { optimizedGlbTextures } from './lossyGlbTextures'

it('replaces an embedded GLB image while preserving the rest of its binary buffer', async () => {
  const document = {
    asset: { version: '2.0' },
    buffers: [{ byteLength: 8 }],
    bufferViews: [{ buffer: 0, byteOffset: 4, byteLength: 4 }],
    images: [{ bufferView: 0, mimeType: 'image/png' }],
  }
  const source = glbFrom({
    json: new TextEncoder().encode(JSON.stringify(document)),
    bin: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]),
  })

  const optimized = await optimizedGlbTextures('model', source, async id => ({
    id,
    bytes: new Uint8Array([9, 10]),
    extension: 'jpg',
  }))
  const chunks = optimized ? glbChunksOf(optimized.bytes) : null
  const output = chunks ? glbJson(chunks.json) : null
  if (!chunks || !isRecord(output)) throw new Error('expected a GLB')
  const views = Array.isArray(output.bufferViews) ? output.bufferViews : []
  const images = Array.isArray(output.images) ? output.images : []

  expect(optimized?.extension).toBe('glb')
  expect(views[0]).toMatchObject({ byteOffset: 8, byteLength: 2 })
  expect(images[0]).toMatchObject({ mimeType: 'image/jpeg' })
  expect([...chunks.bin.slice(0, 10)]).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
})
