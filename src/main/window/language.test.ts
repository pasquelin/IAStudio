import { afterEach, describe, expect, it } from 'vitest'
import { followWindowLanguage, setWindowLanguage, windowLanguage } from './language'

afterEach(() => {
  setWindowLanguage('fr')
})

describe('the language the native surfaces speak', () => {
  it('is what was last set', () => {
    setWindowLanguage('en')

    expect(windowLanguage()).toBe('en')
  })

  /**
   * The case that matters: the menu and the About panel are each built once, so they are told
   * rather than asked. Without this, switching to English left the confirmation dialogs in
   * French under an English menu bar — and the whole suite stayed green.
   */
  it('tells every surface built once, not the first one to have asked', () => {
    const heard: string[] = []
    followWindowLanguage(language => heard.push(`menu:${language}`))
    followWindowLanguage(language => heard.push(`about:${language}`))

    setWindowLanguage('en')

    expect(heard).toEqual(['menu:en', 'about:en'])
  })

  /**
   * The About panel follows second. Before this, a throw from it aborted the loop and travelled
   * back into the settings `onChange`, which then never broadcast the change — every window kept
   * the previous language, with nothing logged.
   */
  it('carries on when a surface fails, so its neighbours and the broadcast still happen', () => {
    const heard: string[] = []
    followWindowLanguage(() => {
      throw new Error('setAboutPanelOptions refused')
    })
    followWindowLanguage(language => heard.push(language))

    expect(() => setWindowLanguage('en')).not.toThrow()
    expect(heard).toEqual(['en'])
  })

  it('says nothing when the language has not moved, so no surface rebuilds for nothing', () => {
    setWindowLanguage('en')
    const heard: string[] = []
    followWindowLanguage(language => heard.push(language))

    setWindowLanguage('en')

    expect(heard).toEqual([])
  })
})
