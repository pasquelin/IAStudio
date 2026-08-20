import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Language } from '@shared/i18n/languages'
import { toolIsShown } from '@/helpers/revealPanel'
import { installFakeBridge } from '@/services/fakeBridge'
import { useDictation } from '@/stores/dictation'
import { useLayouts } from '@/stores/layouts'
import { runAction } from './executor'

beforeEach(() => {
  installFakeBridge()
})

describe('what surrounds the documents', () => {
  it('answers the account, the window and the update without being told anything', async () => {
    expect(await runAction('auth.state', {})).toMatchObject({ ok: true })
    expect(await runAction('updates.state', {})).toMatchObject({ ok: true })
    expect(await runAction('fonts.list', {})).toMatchObject({ ok: true })
  })

  /**
   * The language comes from the main process rather than from this side: the setting may say
   * `system`, and only that side sees what the machine really prefers.
   */
  it('answers the window with the language it actually draws in', async () => {
    const french: Language = 'fr'
    const language = vi.fn(async () => french)
    installFakeBridge({ window: { language } })

    const outcome = await runAction('window.state', {})

    expect(outcome).toMatchObject({ ok: true, data: { language: 'fr' } })
    expect(language).toHaveBeenCalled()
  })

  it('toggles full screen and opens the return, which no command could reach', async () => {
    const toggleFullScreen = vi.fn(async () => {})
    const open = vi.fn(async () => {})
    installFakeBridge({ window: { toggleFullScreen }, mirror: { open } })

    await runAction('window.fullScreen', {})
    await runAction('mirror.open', {})

    expect(toggleFullScreen).toHaveBeenCalled()
    expect(open).toHaveBeenCalled()
  })

  it('opens the settings on a section it knows, and refuses one it does not', async () => {
    const open = vi.fn(async () => {})
    installFakeBridge({ settings: { open } })

    expect(await runAction('settings.open', { section: 'general' })).toMatchObject({ ok: true })
    expect(open).toHaveBeenCalledWith('general')

    expect(await runAction('settings.open', { section: 'colours' })).toEqual({
      ok: false,
      refusal: 'badInput',
    })
  })

  it('pins and unpins a recipe, answering the whole list back', async () => {
    const pin = vi.fn(async () => [])
    const unpin = vi.fn(async () => [])
    installFakeBridge({ favorites: { pin, unpin } })

    await runAction('favorite.pin', { assetId: 'asset-1' })
    await runAction('favorite.unpin', { favoriteId: 'recipe-1' })

    expect(pin).toHaveBeenCalledWith('asset-1')
    expect(unpin).toHaveBeenCalledWith('recipe-1')
  })

  /**
   * `adopt` answers `null` for a file the studio cannot read, and a client told only "done" would
   * then go looking for an asset that was never created.
   */
  it('refuses a file the catalogue would not take rather than reporting it adopted', async () => {
    installFakeBridge({ media: { adopt: vi.fn(async () => null) } })

    expect(await runAction('media.adopt', { path: 'Plans/a.raw' })).toEqual({
      ok: false,
      refusal: 'badInput',
    })
  })

  it('installs an update that is ready, which only a quit could otherwise apply', async () => {
    const install = vi.fn(async () => {})
    installFakeBridge({ updates: { install } })

    expect(await runAction('updates.install', {})).toMatchObject({ ok: true })
    expect(install).toHaveBeenCalled()
  })
})

describe('the panels of the surface in front', () => {
  beforeEach(() => {
    useLayouts.setState({ activeWorkspace: 'image', home: false })
  })

  /**
   * Named rather than counted, and only what this surface serves: a panel the space does not
   * carry cannot be opened there, so offering it would be offering a refusal.
   */
  it('lists what this surface carries, saying which are up', async () => {
    const outcome = await runAction('panels.list', {})

    expect(outcome).toMatchObject({ ok: true })
    const listed = (outcome as { data: { id: string; open: boolean }[] }).data
    expect(listed.map(panel => panel.id)).toContain('layers')
    expect(listed.some(panel => panel.open)).toBe(true)
  })

  it('opens one, and closes it again', async () => {
    expect(await runAction('panel.open', { panel: 'assets' })).toEqual({ ok: true })
    expect(toolIsShown('assets', 'image')).toBe(true)

    expect(await runAction('panel.close', { panel: 'assets' })).toEqual({ ok: true })
    expect(toolIsShown('assets', 'image')).toBe(false)
  })

  // The Explorer sits on the home and in no space: naming it here is a refusal, not a no-op.
  it('refuses a panel this surface does not serve', async () => {
    expect(await runAction('panel.open', { panel: 'projects' })).toEqual({
      ok: false,
      refusal: 'wrongSurface',
    })
  })
})

describe('the microphone', () => {
  it('opens it, and says so rather than ok when the machine refused', async () => {
    const start = vi.fn(async () => useDictation.setState({ state: 'listening' }))
    useDictation.setState({ state: 'ready', failure: null, start })

    expect(await runAction('dictation.start', {})).toEqual({ ok: true })

    useDictation.setState({ state: 'permissionRequired', start: vi.fn(async () => {}) })
    expect(await runAction('dictation.start', {})).toEqual({
      ok: false,
      refusal: 'notAllowed',
    })
  })

  /** The two ways of ending differ exactly there: one keeps what was heard, the other drops it. */
  it('keeps what was heard, or throws it away when asked', async () => {
    const stop = vi.fn(async () => {})
    const cancel = vi.fn(async () => {})
    useDictation.setState({ stop, cancel })

    await runAction('dictation.stop', {})
    expect(stop).toHaveBeenCalled()

    await runAction('dictation.stop', { discard: true })
    expect(cancel).toHaveBeenCalled()
  })
})
