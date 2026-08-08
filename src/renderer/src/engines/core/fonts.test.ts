import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EMBEDDED_FONTS, type FontRef } from '@shared/domain/font'
import { bridgeWatchingLogs } from '@/services/fake-bridge'
import { forgetReportedFailures } from '@/services/diagnostics'
import { createFontLibrary, type FontSource } from './fonts'
import moduleSource from './fonts.ts?raw'

/**
 * `parse` is stubbed rather than fed a real face: reading one would need a filesystem, which the
 * renderer project has neither the types nor the business to touch. That the three files the
 * studio ships really are fonts is asserted where a filesystem exists — `main/fonts/sfnt.test.ts`
 * reads each of them and hands it to the same library. What is under test here is the caching,
 * the ordering and the reporting around the parse.
 */
const parse = vi.hoisted(() => vi.fn())

vi.mock('opentype.js', () => ({ parse }))

const lato: FontRef = { source: 'embedded', family: 'Lato' }
const installed: FontRef = { source: 'system', family: 'Futura' }

/**
 * A view into a larger buffer, deliberately: that is what a face lifted out of a collection is,
 * and handing `parse` the whole buffer instead of the view is the mistake the copy guards against.
 */
const outlines = Uint8Array.from([9, 9, 9, 9, 0, 1, 0, 0, 5, 6, 7, 8, 9, 9]).subarray(4, 12)

/** A source that answers the same thing to everyone, and names whatever the machine is said to have. */
function sourceOf(
  bytes: FontSource['bytes'],
  families: readonly string[] = [],
): FontSource & { bytes: ReturnType<typeof vi.fn> } {
  return { installed: async () => [...families], bytes: vi.fn(bytes) }
}

beforeEach(() => {
  forgetReportedFailures()
  bridgeWatchingLogs()
  parse.mockReset()
  parse.mockImplementation(() => ({ unitsPerEm: 1000 }))
})

describe('what the studio can set text in', () => {
  it('offers its own faces before the ones the machine adds', async () => {
    const library = createFontLibrary(sourceOf(async () => null, ['Futura']))

    const offered = await library.families()

    expect(offered.slice(0, EMBEDDED_FONTS.length).map(font => font.family)).toEqual(
      EMBEDDED_FONTS.map(font => font.family),
    )
    expect(offered.at(-1)).toEqual(installed)
  })

  // A machine with nothing installed, or none the studio could read, still sets text.
  it('offers its own faces when the machine adds none', async () => {
    const library = createFontLibrary(sourceOf(async () => null))

    expect(await library.families()).toHaveLength(EMBEDDED_FONTS.length)
  })
})

describe('loading a face', () => {
  it('parses the outlines it was handed', async () => {
    const font = await createFontLibrary(sourceOf(async () => outlines)).load(lato)

    expect(font).toEqual({ unitsPerEm: 1000 })
    // The face and nothing else: `parse` reads the whole buffer it is given, so handing it the
    // one the view sits in would have it read the neighbours as tables.
    expect(new Uint8Array(parse.mock.calls[0]?.[0])).toEqual(Uint8Array.from(outlines))
  })

  // Two nodes born in the same frame ask at once: caching only what has landed would read and
  // parse half a megabyte of glyph tables twice.
  it('reads a face once however many ask for it', async () => {
    const source = sourceOf(async () => outlines)
    const library = createFontLibrary(source)

    const [one, other] = await Promise.all([library.load(lato), library.load(lato)])

    expect(source.bytes).toHaveBeenCalledTimes(1)
    expect(one).toBe(other)
  })

  // A machine with Lato installed offers a face under the same name as the shipped one, and
  // they are not the same file.
  it('tells the same family apart by where it comes from', async () => {
    const source = sourceOf(async () => outlines)
    const library = createFontLibrary(source)

    await library.load(lato)
    await library.load({ source: 'system', family: 'Lato' })

    expect(source.bytes).toHaveBeenCalledTimes(2)
  })

  it('asks again once told to forget', async () => {
    const source = sourceOf(async () => outlines)
    const library = createFontLibrary(source)

    await library.load(lato)
    library.forget()
    await library.load(lato)

    expect(source.bytes).toHaveBeenCalledTimes(2)
  })
})

/**
 * The missing-font hole a shared document opens. Said rather than swapped: a document that opens
 * looking almost right on a machine without the face is worse than one that opens plainly wrong.
 */
describe('a face nothing can produce', () => {
  it('comes back empty and is written to the log', async () => {
    const failures = bridgeWatchingLogs()

    const font = await createFontLibrary(sourceOf(async () => null)).load(installed)

    expect(font).toBeNull()
    expect(failures.entries()).toEqual([
      expect.objectContaining({ scope: 'font.face', message: expect.stringContaining('Futura') }),
    ])
  })

  it('comes back empty when the bytes are not a font at all', async () => {
    parse.mockImplementation(() => {
      throw new Error('Unsupported OpenType signature')
    })

    expect(await createFontLibrary(sourceOf(async () => outlines)).load(lato)).toBeNull()
  })

  it('comes back empty when the source itself throws', async () => {
    const source = sourceOf(async () => {
      throw new Error('the disk said no')
    })

    expect(await createFontLibrary(source).load(installed)).toBeNull()
  })

  // Reported once per face: an engine is rebuilt whenever a panel is detached, and each rebuild
  // asks for the same missing family again.
  it('is written down once however often it is asked for', async () => {
    const failures = bridgeWatchingLogs()
    const library = createFontLibrary(sourceOf(async () => null))

    await library.load(installed)
    library.forget()
    await library.load(installed)

    expect(failures.entries()).toHaveLength(1)
  })
})

// Read from the source rather than from behaviour: the build is green either way, and the weight
// only shows up in a bundle measurement nobody takes on the way past.
describe('the opentype.js import', () => {
  it('is found at all, so the rule below cannot pass on a renamed import', () => {
    expect(moduleSource).toContain("'opentype.js'")
  })

  // What it costs to get this wrong is beside the dynamic import itself, in `fonts.ts`.
  it('is never a value import at module scope', () => {
    expect(moduleSource).not.toMatch(/^import (?!type\b).*'opentype\.js'/m)
    // Both halves, or hoisting the `import()` to module scope would pass the line above while
    // fetching the parser as soon as this module is evaluated — which is on the first screen.
    expect(moduleSource).toMatch(/await import\('opentype\.js'\)/)
  })
})
