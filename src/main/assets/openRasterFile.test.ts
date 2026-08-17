import { strFromU8, unzipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { ORA_MIMETYPE, type OraDocument, type OraLayer } from '@shared/domain/openRaster'
import { packOpenRaster, unpackOpenRaster } from './openRasterFile'

/** One transparent pixel, which is all any of this needs to be real PNG bytes. */
const PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

const layer = (name: string, src: string, over: Partial<OraLayer> = {}): OraLayer => ({
  kind: 'layer',
  name,
  src,
  x: 0,
  y: 0,
  opacity: 1,
  visible: true,
  composite: 'svg:src-over',
  png: PNG,
  ...over,
})

const document = (over: Partial<OraDocument> = {}): OraDocument => ({
  width: 64,
  height: 32,
  nodes: [layer('Top', 'data/p_a.png'), layer('Bottom', 'data/p_b.png')],
  merged: PNG,
  studio: '{"layers":[]}',
  extras: {},
  ...over,
})

const entriesOf = (bytes: Uint8Array): Record<string, string> =>
  Object.fromEntries(
    Object.entries(unzipSync(bytes)).map(([name, data]) => [name, strFromU8(data)]),
  )

describe('writing an OpenRaster container', () => {
  /**
   * The one structural rule of the format: `mimetype` comes first and uncompressed, so a reader
   * can identify the file from its first bytes without inflating anything. A container that gets
   * this wrong opens nowhere, and nothing else in it would say why.
   */
  it('puts the mimetype first, stored rather than deflated', () => {
    const bytes = packOpenRaster(document())

    // Local file header: compression method at 8, then the name at 30.
    expect([bytes[8], bytes[9]]).toEqual([0, 0])
    expect(strFromU8(bytes.slice(30, 38))).toBe('mimetype')
    expect(entriesOf(bytes).mimetype).toBe(ORA_MIMETYPE)
  })

  it('writes the flattened picture the spec requires, and a thumbnail', () => {
    const entries = entriesOf(packOpenRaster(document()))

    expect(entries['mergedimage.png']).toBeDefined()
    expect(entries['Thumbnails/thumbnail.png']).toBeDefined()
  })

  it('names each layer in the stack, top first, with the bytes beside it', () => {
    const entries = entriesOf(packOpenRaster(document()))

    expect(entries['stack.xml']).toContain('<image version="0.0.3" w="64" h="32">')
    expect(entries['stack.xml']?.indexOf('Top')).toBeLessThan(
      entries['stack.xml']?.indexOf('Bottom') ?? 0,
    )
    expect(entries['data/p_a.png']).toBeDefined()
    expect(entries['data/p_b.png']).toBeDefined()
  })

  it('nests a group as a stack of its own, which is how the format carries one', () => {
    const stack = entriesOf(
      packOpenRaster(
        document({
          nodes: [
            {
              kind: 'group',
              name: 'Sky',
              x: 0,
              y: 0,
              opacity: 1,
              visible: true,
              composite: 'svg:src-over',
              isolation: 'isolate',
              children: [layer('Cloud', 'data/p_c.png')],
            },
          ],
        }),
      ),
    )['stack.xml']

    expect(stack).toContain('<stack name="Sky"')
    expect(stack).toContain('isolation="isolate"')
    expect(stack).toContain('name="Cloud"')
  })

  it('escapes a layer name that would otherwise break the XML', () => {
    const stack = entriesOf(
      packOpenRaster(document({ nodes: [layer('R&D <draft>', 'data/p_a.png')] })),
    )['stack.xml']

    expect(stack).toContain('R&amp;D &lt;draft&gt;')
    expect(stack).not.toContain('<draft>')
  })

  it('carries the studio state no standard field could hold', () => {
    const entries = entriesOf(packOpenRaster(document({ studio: '{"guides":[1]}' })))

    expect(entries['scenario/document.json']).toBe('{"guides":[1]}')
  })

  /** A file written elsewhere has nothing of ours in it, and must still be a valid container. */
  it('writes no studio entry when there is no studio state', () => {
    expect(entriesOf(packOpenRaster(document({ studio: '' })))).not.toHaveProperty(
      'scenario/document.json',
    )
  })
})

describe('reading an OpenRaster container back', () => {
  it('gives back the stack it was handed', () => {
    const written = document()

    expect(unpackOpenRaster(packOpenRaster(written))).toEqual(written)
  })

  it('gives back a nested group with its children', () => {
    const written = document({
      nodes: [
        {
          kind: 'group',
          name: 'Sky',
          x: 4,
          y: 8,
          opacity: 0.5,
          visible: false,
          composite: 'svg:multiply',
          isolation: 'isolate',
          children: [layer('Cloud', 'data/p_c.png', { x: 2, y: 3, opacity: 0.25 })],
        },
      ],
    })

    expect(unpackOpenRaster(packOpenRaster(written))).toEqual(written)
  })

  /**
   * The case the whole feature is about: a `.ora` another editor wrote holds no studio entry, and
   * opening it must give back what it DOES hold rather than refusing.
   */
  it('reads a container written without any studio state', () => {
    const foreign = unpackOpenRaster(packOpenRaster(document({ studio: '' })))

    expect(foreign.studio).toBe('')
    expect(foreign.nodes).toHaveLength(2)
  })

  /**
   * A mask has no element in the standard, so no `<layer>` names its file — and it still has to
   * come back. Another application ignores the entry; this one is the only reader that wants it.
   */
  it('carries back the pixels no layer element names', () => {
    const written = document({ extras: { 'data/m_a.png': PNG } })

    expect(unpackOpenRaster(packOpenRaster(written)).extras).toEqual({ 'data/m_a.png': PNG })
  })

  it('refuses bytes that are not an OpenRaster container', () => {
    expect(() => unpackOpenRaster(packOpenRaster(document()).slice(0, 20))).toThrow()
  })
})
