import { beforeEach, describe, expect, it, vi } from 'vitest'
import { installFakeBridge } from '@/services/fakeBridge'
import { codeFilesOf, isCodeDirty, useCode } from './code'
import { useDocuments } from './documents'

const WALK = 'script:Scripts/Walk.ts'

describe('the scripts an editor holds', () => {
  beforeEach(() => {
    useCode.setState({ files: {}, problems: [] })
    useDocuments.setState({ documents: {}, activeId: null })
  })

  it('reads every script of the project, keyed by its reference', async () => {
    installFakeBridge({
      game: { scripts: () => Promise.resolve([{ path: 'Scripts/Walk.ts', source: 'walk' }]) },
    })

    await useCode.getState().reload()

    expect(codeFilesOf(useCode.getState()).map(one => one.script)).toEqual([WALK])
  })

  /** 🛑 A Play re-reads every script; an author who has not saved must not lose what they typed. */
  it('keeps what is being typed when the project is read again', async () => {
    installFakeBridge({
      game: { scripts: () => Promise.resolve([{ path: 'Scripts/Walk.ts', source: 'walk' }]) },
    })
    await useCode.getState().reload()
    useCode.getState().edited(WALK, 'walk faster')

    await useCode.getState().reload()

    expect(useCode.getState().files[WALK]?.source).toBe('walk faster')
    expect(isCodeDirty(useCode.getState().files[WALK])).toBe(true)
  })

  it('says a script is clean again once the project took it', async () => {
    const writeScript = vi.fn(() => Promise.resolve(true))
    installFakeBridge({
      game: {
        scripts: () => Promise.resolve([{ path: 'Scripts/Walk.ts', source: 'walk' }]),
        writeScript,
      },
    })
    await useCode.getState().reload()
    useCode.getState().edited(WALK, 'walk faster')

    expect(await useCode.getState().save(WALK)).toBe(true)

    expect(writeScript).toHaveBeenCalledWith('Scripts/Walk.ts', 'walk faster')
    expect(isCodeDirty(useCode.getState().files[WALK])).toBe(false)
  })

  /** A refusal from the main process leaves the tab dirty rather than pretending it landed. */
  it('stays dirty when the project refused the path', async () => {
    installFakeBridge({
      game: {
        scripts: () => Promise.resolve([{ path: 'Scripts/Walk.ts', source: 'walk' }]),
        writeScript: () => Promise.resolve(false),
      },
    })
    await useCode.getState().reload()
    useCode.getState().edited(WALK, 'walk faster')

    expect(await useCode.getState().save(WALK)).toBe(false)
    expect(isCodeDirty(useCode.getState().files[WALK])).toBe(true)
  })

  it('marks a script clean at the text a save wrote, and forgets a closed one', () => {
    useCode.getState().installed('script:A.ts', 'one')
    useCode.getState().edited('script:A.ts', 'two')
    useCode.getState().committed('script:A.ts', 'two')
    expect(isCodeDirty(useCode.getState().files['script:A.ts'])).toBe(false)

    useCode.getState().forget('script:A.ts')
    expect(useCode.getState().files['script:A.ts']).toBeUndefined()
  })

  /**
   * 🛑 `holds` is read off this map, and `restoreDocument` asks it again AFTER its await: an
   * entry made by a keystroke that landed during the read would make it skip the install, and
   * the file's own text would be lost under the one letter typed. A tab always has its entry —
   * `install` or `createDefault` puts it there before anyone can type.
   */
  it('refuses a script it has never read, so a read in flight still installs', () => {
    useCode.getState().edited('script:A.ts', 'one')

    expect(useCode.getState().files['script:A.ts']).toBeUndefined()
  })

  /** 🛑 A script born in a tab has no file for the walk to find, and a Play re-reads them all. */
  it('keeps a script that has never been written when the project is read again', async () => {
    installFakeBridge({ game: { scripts: () => Promise.resolve([]) } })
    useCode.getState().installed('script:A.ts', '')
    useCode.getState().edited('script:A.ts', 'one')

    await useCode.getState().reload()

    expect(useCode.getState().files['script:A.ts']?.source).toBe('one')
  })
})
