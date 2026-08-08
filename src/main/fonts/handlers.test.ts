import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CHANNELS } from '@shared/ipc'
import { invoke, resetHandlers } from '@main/ipc/test-harness'
import { registerFontHandlers } from './handlers'
import type { SystemFonts } from './system-fonts'

vi.mock('electron', async () => (await import('@main/ipc/test-harness')).mockElectron())

const outlines = Uint8Array.from([0, 1, 0, 0])

const fonts: SystemFonts = {
  families: async () => ['IBM Plex Serif', 'Lato'],
  bytesOf: async family => (family === 'Lato' ? outlines : null),
}

describe('the installed fonts handlers', () => {
  beforeEach(() => {
    resetHandlers()
    registerFontHandlers(fonts)
  })

  it('answers the picker with every family the machine has', async () => {
    expect(await invoke(CHANNELS.fontsList)).toEqual(['IBM Plex Serif', 'Lato'])
  })

  it('answers with the outlines of the face that was asked for', async () => {
    expect(await invoke(CHANNELS.fontsRead, 'Lato')).toEqual(outlines)
  })

  // The missing-font hole a shared document opens: the renderer is told, not left guessing.
  it('answers nothing for a family this machine has not got', async () => {
    expect(await invoke(CHANNELS.fontsRead, 'Futura')).toBeNull()
  })

  // A family never becomes a path — the index resolves it — but the sandboxed side is trusted
  // for nothing all the same, exactly as the diagnostics handler treats what it receives.
  it.each([
    ['a number', 12],
    ['an object', { path: '/etc/passwd' }],
    ['nothing', undefined],
  ])('answers nothing when asked with %s', async (_case, family) => {
    expect(await invoke(CHANNELS.fontsRead, family)).toBeNull()
  })

  // The index answers a readonly list, and a readonly array does not survive the structured
  // clone as one — so the copy is made here rather than discovered in a window.
  it('hands the list over as an array the boundary can carry', async () => {
    expect(Array.isArray(await invoke(CHANNELS.fontsList))).toBe(true)
  })
})
