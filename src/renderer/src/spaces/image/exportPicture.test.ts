import { beforeEach, describe, expect, it, vi } from 'vitest'
import { installDocument } from '@/stores/document-fixtures'
import { useDocuments } from '@/stores/documents'
import { exportPicture } from './exportPicture'

const DOCUMENT = 'doc-1'

const written = vi.fn<(name: string, image: string) => Promise<string | null>>(() =>
  Promise.resolve('/Users/someone/Pictures/Sky.png'),
)

vi.mock('@/services/bridge', () => ({
  getBridge: () => ({ dialog: { exportPicture: (...args: [string, string]) => written(...args) } }),
}))

const host = { snapshot: () => Promise.resolve('PAYLOAD') }

beforeEach(() => {
  written.mockClear()
  installDocument(DOCUMENT, 'image')
})

/** The tab's own title, so the file is findable afterwards — an opaque id is not. */
function titled(title: string): void {
  useDocuments.setState(state => ({
    documents: {
      ...state.documents,
      [DOCUMENT]: {
        ...state.documents[DOCUMENT],
        id: DOCUMENT,
        kind: 'image',
        workspace: 'image',
        title,
        path: `documents/${title}.img`,
      },
    },
  }))
}

describe('exporting the document', () => {
  it('writes the flattened picture under the tab title', async () => {
    titled('Sky')

    await expect(exportPicture(DOCUMENT, host)).resolves.toBe('/Users/someone/Pictures/Sky.png')
    expect(written).toHaveBeenCalledWith('Sky.png', 'PAYLOAD')
  })

  // A separator would name another folder; a leading dot would hide the file.
  it('takes a title a file system cannot hold down to one it can', async () => {
    titled('a/b:c*')

    await exportPicture(DOCUMENT, host)

    expect(written.mock.calls[0]?.[0]).toBe('abc.png')
  })

  // The dots inside a name stay: `Study v1.2` is a name people rely on.
  it('keeps the version in a name that carries one', async () => {
    titled('Study v1.2')

    await exportPicture(DOCUMENT, host)

    expect(written.mock.calls[0]?.[0]).toBe('Study v1.2.png')
  })

  it('falls back to a name rather than writing one made of nothing', async () => {
    titled('///')

    await exportPicture(DOCUMENT, host)

    expect(written.mock.calls[0]?.[0]).toBe('image.png')
  })

  it('writes nothing when there is nothing to flatten', async () => {
    await expect(
      exportPicture(DOCUMENT, { snapshot: () => Promise.resolve(null) }),
    ).resolves.toBeNull()
    expect(written).not.toHaveBeenCalled()
  })
})
