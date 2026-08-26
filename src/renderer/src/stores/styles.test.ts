import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MaterialStyle } from '@shared/domain/style'
import { DEFAULT_TEXTURE_MATERIAL } from '@shared/domain/material'
import { installFakeBridge } from '@/services/fakeBridge'
import { useStyles } from './styles'

function styleNamed(name: string): MaterialStyle {
  return { id: name, name, createdAt: '2026-08-09T00:00:00.000Z', values: DEFAULT_TEXTURE_MATERIAL }
}

beforeEach(() => {
  useStyles.setState({ styles: [], loaded: false })
})

describe('the styles a window holds', () => {
  it('reads the file once, however many panels ask', async () => {
    const list = vi.fn(() => Promise.resolve([styleNamed('Style 1')]))
    installFakeBridge({ styles: { list } })

    await useStyles.getState().load()
    await useStyles.getState().load()

    expect(list).toHaveBeenCalledTimes(1)
    expect(useStyles.getState().styles).toHaveLength(1)
  })

  it('shows an empty panel rather than throwing when the file cannot be read', async () => {
    installFakeBridge({ styles: { list: () => Promise.reject(new Error('unreadable')) } })

    await useStyles.getState().load()

    expect(useStyles.getState()).toMatchObject({ styles: [], loaded: true })
  })

  it('names what it saves from the list it holds, under the prefix it is given', async () => {
    const save = vi.fn((style: MaterialStyle) => Promise.resolve([style]))
    installFakeBridge({ styles: { save } })
    useStyles.setState({ styles: [styleNamed('Style 1')], loaded: true })

    await useStyles.getState().save(DEFAULT_TEXTURE_MATERIAL, 'Style')

    expect(save.mock.calls[0]?.[0]).toMatchObject({ name: 'Style 2' })
  })

  /**
   * The settings handed in belong to the texture, which the next drag of a slider rewrites. A
   * style that shared the object would follow it.
   */
  it('copies the settings rather than holding the texture own', async () => {
    const save = vi.fn((style: MaterialStyle) => Promise.resolve([style]))
    installFakeBridge({ styles: { save } })
    const live = { ...DEFAULT_TEXTURE_MATERIAL, tiling: { x: 2, y: 2 } }

    await useStyles.getState().save(live, 'Style')
    live.tiling.x = 99

    expect(save.mock.calls[0]?.[0].values.tiling.x).toBe(2)
  })

  it('takes the whole list back from every write, so nothing has to guess', async () => {
    installFakeBridge({
      styles: { rename: () => Promise.resolve([styleNamed('Brushed metal')]) },
    })

    await useStyles.getState().rename('Style 1', 'Brushed metal')

    expect(useStyles.getState().styles).toMatchObject([{ name: 'Brushed metal' }])
  })
})

/**
 * The save button lives in the inspector, which does not need the panel to have ever been
 * opened. Both of these were reproduced before they were fixed.
 */
describe('saving before the panel has ever been opened', () => {
  it('does not hand out a name the file already holds', async () => {
    const saved: MaterialStyle[] = []
    installFakeBridge({
      styles: {
        list: () => Promise.resolve([styleNamed('Style 1'), styleNamed('Style 2')]),
        save: style => {
          saved.push(style)
          return Promise.resolve([style])
        },
      },
    })

    await useStyles.getState().save(DEFAULT_TEXTURE_MATERIAL, 'Style')

    expect(saved[0]?.name).toBe('Style 3')
  })

  /**
   * A read in flight is older than a write that lands during it. Answering with it would put the
   * panel back to what the disk held before, and `loaded` stops `load` ever retrying.
   *
   * Shown through `rename` because `save` cannot race any more — it waits for the read, which is
   * what the naming above needs. The other two writes do not, and must not be undone by it.
   */
  it('keeps a rename that landed while a read was still in flight', async () => {
    let answerList = (styles: MaterialStyle[]): void => void styles
    const list = (): Promise<MaterialStyle[]> =>
      new Promise(resolve => {
        answerList = resolve
      })
    installFakeBridge({
      styles: { list, rename: () => Promise.resolve([styleNamed('Brushed metal')]) },
    })

    const reading = useStyles.getState().load()
    await useStyles.getState().rename('style_1', 'Brushed metal')
    answerList([styleNamed('Style 1')])
    await reading

    expect(useStyles.getState().styles).toMatchObject([{ name: 'Brushed metal' }])
  })
})
