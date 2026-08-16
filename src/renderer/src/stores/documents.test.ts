import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DocumentDescriptor, DocumentWrite } from '@shared/domain/document'
import { installFakeBridge } from '@/services/fake-bridge'
import { documentForAsset, documentsIn, panelIds, useDocuments } from './documents'
import { showPanels } from './layout-fixtures'
import { useLayouts } from './layouts'

const POSTER: DocumentDescriptor = {
  id: 'from-disk',
  kind: 'image',
  title: 'Poster',
  workspace: 'image',
  fileName: 'Poster.img',
}

const showing = (...ids: readonly string[]): void => showPanels(...ids)

describe('documents store', () => {
  beforeEach(() => {
    localStorage.clear()
    useDocuments.setState({ documents: {}, activeId: null, recent: {} })
    useLayouts.setState({ layout: null, projectPath: null })
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
          return Promise.resolve<DocumentWrite>('written')
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
            {
              id: 'saved-then-closed',
              kind: 'scene',
              title: 'Untitled 1',
              workspace: '3d',
              fileName: 'Untitled 1.scene',
            },
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

  /**
   * The numbering counts blank documents, and an asset-opened one carries the asset's name. Left
   * in the tally, three pictures opened from the shelf made the FIRST untitled document of the
   * space « Sans titre 4 ».
   */
  it('does not count asset-opened documents when numbering a blank one', async () => {
    const { create } = useDocuments.getState()
    const first = await create('image')
    await create('image', { title: 'Gemini 3.1', sourceAssetId: 'asset_1' })
    await create('image', { title: 'Gemini 3.2', sourceAssetId: 'asset_2' })

    const second = await create('image')
    expect(second?.title).not.toBe(first?.title)
    // The third blank one, had the two assets counted, would have been numbered 5.
    expect((await create('image'))?.title).toContain('3')
  })

  /**
   * Both creations await the same in-flight listing, so a state read BEFORE that await hands
   * them the same number — two tabs called « Sans titre 1 », indistinguishable everywhere.
   */
  it('numbers two creations in flight apart', async () => {
    const { create } = useDocuments.getState()
    const [one, other] = await Promise.all([create('image'), create('image')])

    expect(one?.title).not.toBe(other?.title)
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

  it('names a document after the asset it was opened for, rather than numbering it', async () => {
    const created = await useDocuments
      .getState()
      .create('image', { title: 'Gemini 3.1', sourceAssetId: 'asset_42' })

    expect(created?.title).toBe('Gemini 3.1')
    expect(created?.sourceAssetId).toBe('asset_42')
  })

  // Two assets may share a name, and the numbering is not the answer: it counts untitled
  // documents. What tells the two tabs apart is the link, which is what comes back to one.
  it('leaves two documents opened for homonymous assets under the same title', async () => {
    const { create } = useDocuments.getState()
    const first = await create('image', { title: 'Gemini 3.1', sourceAssetId: 'asset_1' })
    const second = await create('image', { title: 'Gemini 3.1', sourceAssetId: 'asset_2' })

    expect(second?.title).toBe(first?.title)
    expect(second?.id).not.toBe(first?.id)
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

describe('documentForAsset', () => {
  beforeEach(() => {
    useDocuments.setState({ documents: {}, activeId: null })
    installFakeBridge()
  })

  it('finds the tab already editing an asset', async () => {
    const created = await useDocuments
      .getState()
      .create('image', { title: 'Gemini 3.1', sourceAssetId: 'asset_42' })

    expect(documentForAsset(useDocuments.getState(), 'asset_42')?.id).toBe(created?.id)
  })

  // A document of the right kind is not a document of this asset: answering with one would send
  // the asset into a tab that already edits another, which is the whole confusion this replaces.
  it('answers nothing for an asset no tab is editing', async () => {
    await useDocuments.getState().create('image')

    expect(documentForAsset(useDocuments.getState(), 'asset_42')).toBeNull()
  })

  /**
   * The document saved for an asset and then closed lives only in the folder listing. Reading
   * the open tabs alone made the gesture build a second document beside the work it meant to
   * reopen — one asset, two files, and the first reachable only by hunting for it.
   */
  it('finds the document saved for an asset once its tab is closed', () => {
    const saved: DocumentDescriptor = {
      id: 'from-disk',
      kind: 'image',
      title: 'Poster',
      workspace: 'image',
      fileName: 'Poster.img',
      sourceAssetId: 'asset_42',
    }
    useDocuments.setState({ documents: {}, stored: [saved] })

    expect(documentForAsset(useDocuments.getState(), 'asset_42')?.id).toBe('from-disk')
  })

  // The open one wins: it is the descriptor a tab has been renaming, and the listing is a snapshot.
  it('prefers the open tab over the listing it also appears in', async () => {
    const open = await useDocuments
      .getState()
      .create('image', { title: 'Gemini 3.1', sourceAssetId: 'asset_42' })
    useDocuments.setState({
      stored: [
        {
          id: 'stale',
          kind: 'image',
          title: 'Old',
          workspace: 'image',
          fileName: 'Old.img',
          sourceAssetId: 'asset_42',
        },
      ],
    })

    expect(documentForAsset(useDocuments.getState(), 'asset_42')?.id).toBe(open?.id)
  })
})

describe('panelIds', () => {
  it('names what the arrangement shows', () => {
    expect(panelIds({ panels: { a: {}, b: {} } })).toEqual(new Set(['a', 'b']))
  })

  // A project whose centre has never reported an arrangement, which is every launch before the
  // first one lands: an empty set is the honest answer, and a throw here would be at mount.
  it('survives having no arrangement at all', () => {
    expect(panelIds(null)).toEqual(new Set())
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
    useDocuments.setState({ documents: {}, stored: [], activeId: null, recent: {} })
    useLayouts.setState({ layout: null, projectPath: null })
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
      fileName: 'Untitled 1.scene',
    }
    useDocuments.setState({ documents: { unwritten } })
    installFakeBridge({ documents: { list: () => Promise.resolve([POSTER]) } })

    await useDocuments.getState().relist()
    expect(useDocuments.getState().documents).toEqual({ unwritten })
  })

  // A list that reshuffles between two reads is a list nobody can point at.
  it('sorts by title', async () => {
    const zulu: DocumentDescriptor = {
      id: 'z',
      kind: 'scene',
      title: 'Zulu',
      workspace: '3d',
      fileName: 'Zulu.scene',
    }
    const alpha: DocumentDescriptor = {
      id: 'a',
      kind: 'scene',
      title: 'Alpha',
      workspace: '3d',
      fileName: 'Alpha.scene',
    }
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

describe('rename', () => {
  const renamed: DocumentDescriptor = { ...POSTER, title: 'Affiche', fileName: 'Affiche.img' }

  beforeEach(() => {
    useDocuments.setState({ documents: {}, stored: [], activeId: null })
  })

  /**
   * Both halves at once. `documents` is what a tab reads and `stored` is what the Explorer and
   * the document list read: writing one leaves the other showing the name the document has just
   * stopped having — the two names this whole change exists to collapse into one.
   */
  it('writes the new name where the tab reads it and where the folder is listed', async () => {
    useDocuments.setState({ documents: { [POSTER.id]: POSTER }, stored: [POSTER] })
    installFakeBridge({ documents: { rename: () => Promise.resolve(renamed) } })

    expect(await useDocuments.getState().rename(POSTER.id, 'Affiche')).toBeNull()

    expect(useDocuments.getState().documents[POSTER.id]).toEqual(renamed)
    expect(useDocuments.getState().stored[0]).toEqual(renamed)
  })

  // The id is what the layout, the recent list and the open tab all hold.
  it('leaves the id where it was, so the open tab does not notice', async () => {
    useDocuments.setState({ documents: { [POSTER.id]: POSTER }, stored: [POSTER] })
    installFakeBridge({ documents: { rename: () => Promise.resolve(renamed) } })

    await useDocuments.getState().rename(POSTER.id, 'Affiche')

    expect(Object.keys(useDocuments.getState().documents)).toEqual([POSTER.id])
  })

  // Asked here as well as in the main process: this is what puts a sentence under the field.
  it('refuses a name the folder already holds without asking the disk', async () => {
    const other: DocumentDescriptor = { ...POSTER, id: 'other', fileName: 'Affiche.img' }
    useDocuments.setState({ documents: { [POSTER.id]: POSTER }, stored: [POSTER, other] })
    const rename = vi.fn()
    installFakeBridge({ documents: { rename } })

    expect(await useDocuments.getState().rename(POSTER.id, 'Affiche')).toBe('duplicate')
    expect(rename).not.toHaveBeenCalled()
  })

  it('refuses a title the disk would have to rewrite', async () => {
    useDocuments.setState({ documents: { [POSTER.id]: POSTER }, stored: [POSTER] })
    const rename = vi.fn()
    installFakeBridge({ documents: { rename } })

    expect(await useDocuments.getState().rename(POSTER.id, 'Brique 1/2')).toBe('invalid')
    expect(rename).not.toHaveBeenCalled()
  })

  // The window believed the name was free; the folder is what decides, and it may have changed.
  it('reports the refusal the main process came back with', async () => {
    useDocuments.setState({ documents: { [POSTER.id]: POSTER }, stored: [POSTER] })
    installFakeBridge({
      documents: { rename: () => Promise.reject(new Error('duplicate-name')) },
    })

    expect(await useDocuments.getState().rename(POSTER.id, 'Affiche')).toBe('duplicate')
    expect(useDocuments.getState().documents[POSTER.id]).toEqual(POSTER)
  })

  // Closed while the field was open, or never open at all: there is nothing to rename.
  it('says so when no document of that id is anywhere', async () => {
    expect(await useDocuments.getState().rename('gone', 'Affiche')).toBe('invalid')
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
