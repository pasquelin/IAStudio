import { beforeEach, describe, expect, it } from 'vitest'
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

      await expect(useDocuments.getState().refresh()).resolves.toBeUndefined()
      expect(Object.keys(useDocuments.getState().documents)).toHaveLength(0)
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
