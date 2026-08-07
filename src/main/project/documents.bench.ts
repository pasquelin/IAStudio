import { deserialize, serialize } from 'node:v8'
import { bench, describe } from 'vitest'
import { DOCUMENT_VERSION, type DocumentFile } from '@shared/domain/document'

/**
 * What one save and one open cost the main process.
 *
 * Two costs per save, not one: the structured clone `ipcMain` decodes when the renderer's draft
 * lands, then `JSON.stringify`. Both run on the main thread, and a main thread busy for more
 * than 16 ms freezes every window of the studio, detached ones included — CLAUDE.md, invariant
 * 6. `node:v8` is the serializer Electron's IPC uses.
 *
 * `createDocumentFiles` itself is not called: what is measured is its synchronous half, and the
 * `writeFile`/`rename` around it are asynchronous and off the JS thread.
 */
function sceneOf(count: number): DocumentFile {
  const nodes = Array.from({ length: count }, (_unused, index) => ({
    id: `node_${index}`,
    parentId: null,
    name: `Mesh ${index}`,
    visible: true,
    transform: {
      position: { x: index, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
    },
    type: 'mesh',
    geometry: { kind: 'sphere', radius: 0.5, widthSegments: 32, heightSegments: 16 },
    material: {
      kind: 'standard',
      color: null,
      roughness: 1,
      metalness: 0,
      map: { assetId: 'asset_00000000-0000-0000-0000-000000000000' },
      normalMap: null,
      roughnessMap: null,
      metalnessMap: null,
      aoMap: null,
    },
  }))

  return {
    version: DOCUMENT_VERSION,
    kind: 'scene',
    title: 'Bench',
    updatedAt: '2026-08-07T10:00:00.000Z',
    content: { nodes },
  }
}

const SIZES: readonly number[] = [50, 500, 5_000, 10_000, 15_000, 50_000]

describe('writing a document: the whole main-thread cost of one save', () => {
  for (const count of SIZES) {
    const clone = serialize(sceneOf(count))
    bench(`${count} nodes`, () => {
      JSON.stringify(deserialize(clone))
    })
  }
})

describe('writing a document: serializing alone', () => {
  for (const count of SIZES) {
    const file = sceneOf(count)
    bench(`${count} nodes`, () => {
      JSON.stringify(file)
    })
  }
})

describe('reading a document: the whole main-thread cost of one open', () => {
  for (const count of SIZES) {
    const text = JSON.stringify(sceneOf(count))
    bench(`${count} nodes`, () => {
      serialize(JSON.parse(text))
    })
  }
})
