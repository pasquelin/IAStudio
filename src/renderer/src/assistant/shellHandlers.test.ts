import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Language } from '@shared/i18n/languages'
import { installFakeBridge } from '@/services/fakeBridge'
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
})
