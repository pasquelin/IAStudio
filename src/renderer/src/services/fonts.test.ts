import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FontRef } from '@shared/domain/font'
import { installFakeBridge } from './fake-bridge'
import { bridgeFonts, studioFonts } from './fonts'

const lato: FontRef = { source: 'embedded', family: 'Lato' }
const installed: FontRef = { source: 'system', family: 'Futura' }

const outlines = Uint8Array.from([0, 1, 0, 0])

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('the families the machine adds', () => {
  it('asks across the boundary', async () => {
    installFakeBridge({ fonts: { list: async () => ['Futura', 'Menlo'] } })

    expect(await bridgeFonts.installed()).toEqual(['Futura', 'Menlo'])
  })

  // A plain browser and a test have no bridge; the studio's own three are offered regardless.
  it('adds none when there is no bridge to ask', async () => {
    vi.stubGlobal('studio', undefined)

    expect(await bridgeFonts.installed()).toEqual([])
  })
})

describe('where a face’s outlines come from', () => {
  it('fetches an embedded face from the folder the studio serves', async () => {
    const fetched = vi.fn(async () => new Response(outlines.buffer))
    vi.stubGlobal('fetch', fetched)

    const read = await bridgeFonts.bytes(lato)

    // Relative, never absolute: an absolute path resolves against the drive root under `file://`
    // in a packaged build — the lesson the Draco and KTX2 decoders taught next door.
    expect(fetched).toHaveBeenCalledWith('./fonts/Lato-Regular.ttf')
    expect(read).toEqual(outlines)
  })

  it('throws when that folder answers anything but the file', async () => {
    vi.stubGlobal('fetch', async () => new Response('', { status: 404, statusText: 'Not Found' }))

    await expect(bridgeFonts.bytes(lato)).rejects.toThrow('404')
  })

  it('answers nothing for an embedded family the studio no longer ships', async () => {
    expect(await bridgeFonts.bytes({ source: 'embedded', family: 'Helvetiker' })).toBeNull()
  })

  it('asks across the boundary for an installed face', async () => {
    installFakeBridge({ fonts: { read: async () => outlines } })

    expect(await bridgeFonts.bytes(installed)).toEqual(outlines)
  })

  it('answers nothing for an installed face the machine has not got', async () => {
    installFakeBridge({ fonts: { read: async () => null } })

    expect(await bridgeFonts.bytes(installed)).toBeNull()
  })

  it('answers nothing for an installed face when there is no bridge to ask', async () => {
    vi.stubGlobal('studio', undefined)

    expect(await bridgeFonts.bytes(installed)).toBeNull()
  })
})

// One library for the whole studio, so a face is parsed once whichever workspace sets text in it.
describe('the library the workspaces share', () => {
  it('is wired to the boundary and offers the faces the studio ships', async () => {
    installFakeBridge({ fonts: { list: async () => ['Futura'] } })

    expect((await studioFonts.families()).map(font => font.family)).toContain('Futura')
  })
})
