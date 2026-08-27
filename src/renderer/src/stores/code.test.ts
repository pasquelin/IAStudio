import { beforeEach, describe, expect, it, vi } from 'vitest'
import { installFakeBridge } from '@/services/fakeBridge'
import { codeFilesOf, freeScriptPath, isCodeDirty, useCode } from './code'

const WALK = 'script:Scripts/Walk.ts'

describe('the scripts an editor holds', () => {
  beforeEach(() => {
    useCode.setState({ files: {}, open: [], active: null, problems: [] })
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

  it('closes a tab onto the one beside it rather than onto nothing', () => {
    useCode.getState().show('script:A.ts')
    useCode.getState().show('script:B.ts')

    useCode.getState().close('script:B.ts')

    expect(useCode.getState().active).toBe('script:A.ts')
  })

  it('never offers a path the project already holds', async () => {
    installFakeBridge({
      game: { scripts: () => Promise.resolve([{ path: 'Script.ts', source: '' }]) },
    })
    await useCode.getState().reload()

    expect(freeScriptPath(useCode.getState(), 'Script')).toBe('script:Script-2.ts')
  })
})
