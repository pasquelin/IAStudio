import { deserialize, serialize } from 'node:v8'
import { bench, describe } from 'vitest'
import { DOCUMENT_VERSION, type DocumentFile } from '@shared/domain/document'
import { splitDocument } from './documents'

/**
 * What one save and one open cost the main process.
 *
 * One cost per save now, not two: the content arrives already serialized, so all the main
 * thread does is decode the structured clone `ipcMain` hands it and concatenate two strings.
 * The `JSON.stringify` of the document itself happens in the window that owns it.
 *
 * The comparison is the point of keeping this: `stringify` of the whole file is measured beside
 * it, and it is what the main thread used to pay per save. A main thread busy for more than
 * 16 ms freezes every window of the studio, detached ones included — CLAUDE.md, invariant 6.
 * `node:v8` is the serializer Electron's IPC uses.
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
    // Already a string when it crosses the boundary — that is the whole point of the format.
    content: JSON.stringify({ nodes }),
  }
}

/** What `createDocumentFiles` writes: the envelope on one line, the content under it. */
function bodyOf(file: DocumentFile): string {
  const { content, ...envelope } = file
  return `${JSON.stringify(envelope)}\n${content}`
}

const SIZES: readonly number[] = [50, 500, 5_000, 10_000, 15_000, 50_000]

describe('writing a document: the whole main-thread cost of one save', () => {
  for (const count of SIZES) {
    const clone = serialize(sceneOf(count))
    bench(`${count} nodes`, () => {
      bodyOf(deserialize(clone))
    })
  }
})

// What the main thread used to pay per save, kept as the measure of what was moved out of it.
describe('writing a document: serializing the content, as it no longer does', () => {
  for (const count of SIZES) {
    const file = sceneOf(count)
    bench(`${count} nodes`, () => {
      JSON.stringify(JSON.parse(file.content))
    })
  }
})

describe('reading a document: the whole main-thread cost of one open', () => {
  for (const count of SIZES) {
    const body = bodyOf(sceneOf(count))
    bench(`${count} nodes`, () => {
      serialize(splitDocument(body))
    })
  }
})
