import { describe, expect, it } from 'vitest'
import { touchesDocuments } from './fileOp'

describe('whether a batch of file moves reaches the documents', () => {
  it('counts a document that WENT, which carries no destination to read', () => {
    // `to` is empty for the trash — the one gesture with no way back. Reading it alone would
    // leave the deleted document listed until something else made the panel walk the disk.
    expect(touchesDocuments([{ from: 'Act 1/opening.gltf', to: '' }])).toBe(true)
    expect(touchesDocuments([{ from: 'Act 1/still.png', to: '' }])).toBe(false)
  })

  it('counts a document that CAME, which carries no origin to read', () => {
    expect(touchesDocuments([{ from: '', to: 'Act 1/opening.gltf' }])).toBe(true)
  })

  it('reads where a file LANDED, not where it left, when both are named', () => {
    // A rush renamed into a document is a document from here on; the other way round it stops
    // being one. Reading the origin first would answer the previous life of the file.
    expect(touchesDocuments([{ from: 'rushes/take.png', to: 'Act 1/take.gltf' }])).toBe(true)
    expect(touchesDocuments([{ from: 'Act 1/take.gltf', to: 'rushes/take.png' }])).toBe(false)
  })

  it('leaves the panel alone when a batch moved nothing it opens', () => {
    expect(touchesDocuments([{ from: 'rushes/take.png', to: 'keep/take.png' }])).toBe(false)
  })
})
