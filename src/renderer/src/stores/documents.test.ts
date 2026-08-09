import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DocumentDescriptor } from '@shared/domain/document'
import { installFakeBridge } from '@/services/fake-bridge'
import { documentsIn, panelIds, useDocuments } from './documents'
import { showPanels } from './layout-fixtures'
import { useLayouts } from './layouts'

const POSTER: DocumentDescriptor = {
  id: 'from-disk',
  kind: 'image',
  title: 'Poster',
  workspace: 'image',
}

const showing = (...ids: readonly string[]): void => showPanels('image', ...ids)

describe('documents store', () => {
  beforeEach(() => {
    localStorage.clear()
    useDocuments.setState({ documents: {}, activeId: null })
    useLayouts.setState({ layouts: {}, projectPath: null })
    installFakeBridge()
  })

  // The bug this store was rewritten for: `localStorage` belongs to the application, not to the
  // project, so opening another one showed the previous project's tabs — pointing at files that
  // are not there, or at a file of the same id in another project entirely.
  it('keeps nothing in local storage, the project folder being what says a document exists', async () => {
    await useDocuments.getState().create('3d')

    expect(localStorage.getItem('scenario-studio:documents')).toBeNull()
  })

  // A file per tab opened and never typed in would litter the project with empty documents
  // that only a hand could remove. A document reaches the folder when it holds something.
  it('writes nothing until the document holds something', async () => {
    const written: string[] = []
    installFakeBridge({
      documents: {
        write: id => {
          written.push(id)
          return Promise.resolve()
        },
      },
    })

    await useDocuments.getState().create('3d')
    expect(written).toEqual([])
  })

  // Counting the open tabs alone handed the same name twice: a document saved under "Sans
  // titre 1" and closed is still called that, and the folder is what remembers it.
  it('numbers a new document against the folder as much as against the tabs', async () => {
    installFakeBridge({
      documents: {
        list: () =>
          Promise.resolve([
            { id: 'saved-then-closed', kind: 'scene', title: 'Untitled 1', workspace: '3d' },
          ]),
      },
    })

    const created = await useDocuments.getState().create('3d')
    expect(created?.title).not.toBe('Untitled 1')
  })

  describe('refresh', () => {
    it('replaces what it holds with what the project answers', async () => {
      await useDocuments.getState().create('3d')
      showing(POSTER.id)
      installFakeBridge({ documents: { list: () => Promise.resolve([POSTER]) } })

      await useDocuments.getState().refresh()

      expect(Object.keys(useDocuments.getState().documents)).toEqual([POSTER.id])
    })

    it('keeps only the documents a layout still shows', async () => {
      showing('other')
      installFakeBridge({ documents: { list: () => Promise.resolve([POSTER]) } })

      await useDocuments.getState().refresh()

      expect(useDocuments.getState().documents[POSTER.id]).toBeUndefined()
    })

    // A tab of the project being left cannot stay in front of the one being opened.
    it('puts nothing in front', async () => {
      useDocuments.setState({ activeId: 'from-the-other-project' })
      await useDocuments.getState().refresh()

      expect(useDocuments.getState().activeId).toBeNull()
    })

    // The main process opens the last project on launch, which broadcasts a change while the
    // first listing is still in flight: the last answer to arrive is not the one asked for last.
    it('ignores a listing that comes back after another was asked for', async () => {
      showing(POSTER.id, 'second')
      const second: DocumentDescriptor = { ...POSTER, id: 'second', title: 'Later' }
      let release = (): void => {}
      const slow = new Promise<DocumentDescriptor[]>(resolve => {
        release = () => resolve([POSTER])
      })

      installFakeBridge({ documents: { list: () => slow } })
      const first = useDocuments.getState().refresh()

      installFakeBridge({ documents: { list: () => Promise.resolve([second]) } })
      await useDocuments.getState().refresh()

      release()
      await first

      expect(Object.keys(useDocuments.getState().documents)).toEqual(['second'])
    })

    // No project open, or a folder that went away while it was: an empty centre beats a throw
    // nobody catches.
    it('empties the centre rather than throwing when the project cannot answer', async () => {
      installFakeBridge({ documents: { list: () => Promise.reject(new Error('no project')) } })

      await expect(useDocuments.getState().refresh()).resolves.toBe(false)
      expect(Object.keys(useDocuments.getState().documents)).toHaveLength(0)
    })

    // An empty centre is honest about a folder that went away and says nothing about which
    // tabs deserve to survive it: whoever settles those has to tell the two apart.
    it('says the folder answered when it did, empty or not', async () => {
      installFakeBridge({ documents: { list: () => Promise.resolve([]) } })

      await expect(useDocuments.getState().refresh()).resolves.toBe(true)
    })

    it('says nothing of a listing another refresh overtook', async () => {
      let release = (): void => {}
      const slow = new Promise<DocumentDescriptor[]>(resolve => {
        release = () => resolve([])
      })
      installFakeBridge({ documents: { list: () => slow } })

      const overtaken = useDocuments.getState().refresh()
      installFakeBridge({ documents: { list: () => Promise.resolve([]) } })
      await useDocuments.getState().refresh()
      release()

      await expect(overtaken).resolves.toBe(false)
    })
  })

  it('creates a scene document in the 3d workspace', async () => {
    const created = await useDocuments.getState().create('3d')
    expect(created?.kind).toBe('scene')
    expect(created?.workspace).toBe('3d')
  })

  it('creates a texture document in the textures workspace', async () => {
    const created = await useDocuments.getState().create('textures')
    expect(created?.kind).toBe('texture')
  })

  it('numbers untitled documents per workspace', async () => {
    const { create } = useDocuments.getState()
    const first = await create('3d')
    const second = await create('3d')
    const other = await create('image')

    expect(first?.title).not.toBe(second?.title)
    // Numbering restarts per workspace: an image document is not "Untitled 3" because the
    // 3D workspace already holds two.
    expect(other?.title).toBe(first?.title)
  })

  it('gives every document its own id', async () => {
    const { create } = useDocuments.getState()
    expect((await create('3d'))?.id).not.toBe((await create('3d'))?.id)
  })

  it('forgets a closed document', async () => {
    const created = await useDocuments.getState().create('3d')
    if (!created) throw new Error('expected a document')

    useDocuments.getState().close(created.id)
    expect(useDocuments.getState().documents[created.id]).toBeUndefined()
  })

  it('lists only the documents of the asked workspace', async () => {
    const { create } = useDocuments.getState()
    await create('3d')
    await create('image')

    expect(documentsIn(useDocuments.getState(), '3d')).toHaveLength(1)
  })
})

describe('panelIds', () => {
  it('gathers what every workspace shows, across layouts', () => {
    expect(panelIds({ '3d': { panels: { a: {} } }, image: { panels: { b: {} } } })).toEqual(
      new Set(['a', 'b']),
    )
  })

  it('survives a layout that has no panels recorded at all', () => {
    expect(panelIds({ image: undefined })).toEqual(new Set())
  })
})

/**
 * `relist` reads the folder and settles nothing else. That separation is the whole point: a
 * panel that wants a listing must not decide which tabs are open, because `create` posts a
 * descriptor without writing a file and a reconciliation would evict it mid-session.
 */
describe('relist', () => {
  beforeEach(() => {
    localStorage.clear()
    useDocuments.setState({ documents: {}, stored: [], activeId: null })
    useLayouts.setState({ layouts: {}, projectPath: null })
  })

  it('reads what the folder holds, open or not', async () => {
    installFakeBridge({ documents: { list: () => Promise.resolve([POSTER]) } })

    await useDocuments.getState().relist()
    expect(useDocuments.getState().stored).toEqual([POSTER])
  })

  it('leaves the open documents exactly as they were', async () => {
    const unwritten: DocumentDescriptor = {
      id: 'unwritten',
      kind: 'scene',
      title: 'Untitled 1',
      workspace: '3d',
    }
    useDocuments.setState({ documents: { unwritten } })
    installFakeBridge({ documents: { list: () => Promise.resolve([POSTER]) } })

    await useDocuments.getState().relist()
    expect(useDocuments.getState().documents).toEqual({ unwritten })
  })

  // A list that reshuffles between two reads is a list nobody can point at.
  it('sorts by title', async () => {
    const zulu: DocumentDescriptor = { id: 'z', kind: 'scene', title: 'Zulu', workspace: '3d' }
    const alpha: DocumentDescriptor = { id: 'a', kind: 'scene', title: 'Alpha', workspace: '3d' }
    installFakeBridge({ documents: { list: () => Promise.resolve([zulu, alpha]) } })

    await useDocuments.getState().relist()
    expect(useDocuments.getState().stored.map(document => document.title)).toEqual([
      'Alpha',
      'Zulu',
    ])
  })

  /**
   * The two questions have their own counter. Sharing one looked harmless and was not: the
   * Explorer relists from a mount effect while `followProject` is still awaiting its own read,
   * and the relist made the refresh abandon — leaving every restored tab without its descriptor.
   */
  it('does not make a refresh in flight abandon', async () => {
    // The refresh's own read is the slow one; the relist that overtakes it answers at once.
    let answerRefresh = (documents: DocumentDescriptor[]): void => void documents
    let reads = 0
    installFakeBridge({
      documents: {
        list: () => {
          reads += 1
          if (reads > 1) return Promise.resolve([POSTER])
          return new Promise<DocumentDescriptor[]>(resolve => (answerRefresh = resolve))
        },
      },
    })
    showing(POSTER.id)

    const refreshing = useDocuments.getState().refresh()
    await useDocuments.getState().relist()
    answerRefresh([POSTER])
    await refreshing

    expect(Object.keys(useDocuments.getState().documents)).toEqual([POSTER.id])
  })

  it('answers an empty list when no project is open', async () => {
    installFakeBridge({ documents: { list: () => Promise.reject(new Error('no project')) } })

    await useDocuments.getState().relist()
    expect(useDocuments.getState().stored).toEqual([])
  })
})

describe('adopt', () => {
  beforeEach(() => {
    useDocuments.setState({ documents: {}, stored: [], activeId: null })
  })

  it('takes in a document no tab was showing', () => {
    useDocuments.getState().adopt(POSTER)
    expect(useDocuments.getState().documents[POSTER.id]).toBe(POSTER)
  })

  // The open descriptor is the one the tab has been renaming; the listing it came from is a
  // snapshot, and overwriting would hand back the name the file had when it was last read.
  it('never overwrites the descriptor a tab is already holding', () => {
    const renamed: DocumentDescriptor = { ...POSTER, title: 'Renamed' }
    useDocuments.setState({ documents: { [POSTER.id]: renamed } })

    useDocuments.getState().adopt(POSTER)
    expect(useDocuments.getState().documents[POSTER.id]).toBe(renamed)
  })
})

/**
 * `relist` shares a listing already in flight, which is right for three surfaces asking on the
 * same paint — and wrong for a caller that has just written a file: the shared answer may have
 * been asked for before the write, and would come back without it.
 */
describe('sharing a listing', () => {
  beforeEach(() => {
    useDocuments.setState({ stored: [] })
  })

  it('answers a plain caller from the listing already travelling', async () => {
    const list = vi.fn(() => Promise.resolve([POSTER]))
    installFakeBridge({ documents: { list } })

    await Promise.all([useDocuments.getState().relist(), useDocuments.getState().relist()])

    expect(list).toHaveBeenCalledOnce()
    expect(useDocuments.getState().stored).toHaveLength(1)
  })

  it('reads again for a caller that has just written, so its own file is there', async () => {
    const written: DocumentDescriptor[] = []
    const list = vi.fn(() => Promise.resolve([...written]))
    installFakeBridge({ documents: { list } })

    const shared = useDocuments.getState().relist()
    written.push(POSTER)
    await Promise.all([shared, useDocuments.getState().relist('own-write')])

    expect(list).toHaveBeenCalledTimes(2)
    expect(useDocuments.getState().stored).toHaveLength(1)
  })
})
