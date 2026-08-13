import { afterEach, describe, expect, it } from 'vitest'
import { followWindowLanguage, setWindowLanguage, windowLanguage } from './language'

const stop: (() => void)[] = []

/** The module holds process-wide state: a follower left behind would hear the next case. */
function follow(listener: (language: string) => void): void {
  stop.push(followWindowLanguage(listener))
}

afterEach(() => {
  for (const unfollow of stop.splice(0)) unfollow()
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
  it('tells the surfaces built once, so none of them keeps the previous one', () => {
    const heard: string[] = []
    follow(language => heard.push(language))

    setWindowLanguage('en')

    expect(heard).toEqual(['en'])
  })

  it('says nothing when the language has not moved, so no surface rebuilds for nothing', () => {
    setWindowLanguage('en')
    const heard: string[] = []
    follow(language => heard.push(language))

    setWindowLanguage('en')

    expect(heard).toEqual([])
  })

  it('tells every surface, not the first one to have asked', () => {
    const heard: string[] = []
    follow(() => heard.push('menu'))
    follow(() => heard.push('about'))

    setWindowLanguage('en')

    expect(heard).toEqual(['menu', 'about'])
  })

  it('stops telling a surface that unfollowed', () => {
    const heard: string[] = []
    const unfollow = followWindowLanguage(language => heard.push(language))

    unfollow()
    setWindowLanguage('en')

    expect(heard).toEqual([])
  })
})
