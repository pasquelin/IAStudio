import { beforeEach, describe, expect, it, vi } from 'vitest'
import type * as Bridge from '@/services/bridge'
import { installDocument, retitleDocument } from '@/stores/document-fixtures'
import { exportPicture, type ExportHost } from './exportPicture'

const DOCUMENT = 'doc-1'

const written = vi.fn<(name: string, image: string) => Promise<string | null>>(() =>
  Promise.resolve('/Users/someone/Pictures/Sky.png'),
)

// Partial: the stores this pulls in reach for the rest of the module, and a total mock would have
// to grow an entry every time the bridge gains one.
vi.mock('@/services/bridge', async importOriginal => ({
  ...(await importOriginal<typeof Bridge>()),
  getBridge: () => ({ dialog: { exportPicture: (...args: [string, string]) => written(...args) } }),
}))

/** The two halves the layered way out reads are empty here: the flatten is what this suite is about. */
const host: ExportHost = {
  snapshot: () => Promise.resolve('PAYLOAD'),
  pixelSnapshots: () => Promise.resolve([]),
  flatten: () => Promise.resolve(new Uint8Array([1])),
}

beforeEach(() => {
  written.mockClear()
  installDocument(DOCUMENT, 'image')
})

const titled = (title: string): void => retitleDocument(DOCUMENT, title)

describe('exporting the document', () => {
  it('writes the flattened picture under the tab title', async () => {
    titled('Sky')

    await expect(exportPicture(DOCUMENT, host)).resolves.toBe('/Users/someone/Pictures/Sky.png')
    expect(written).toHaveBeenCalledWith('Sky.png', 'PAYLOAD')
  })

  // A SPACE where a separator was, which is what every other export door writes: this one dropped
  // it, so one title came out as `Brique 12` here and `Brique 1 2` two menus away.
  it('takes a title a file system cannot hold down to one it can', async () => {
    titled('a/b:c*')

    await exportPicture(DOCUMENT, host)

    expect(written.mock.calls[0]?.[0]).toBe('a b c.png')
  })

  // Spelled out both ways on purpose: APFS stores decomposed while most keyboards send composed,
  // and left as it came, one title on screen lands on two different files.
  it('settles how an accent is spelled before it becomes a file', async () => {
    titled('Été'.normalize('NFD'))

    await exportPicture(DOCUMENT, host)

    expect(written.mock.calls[0]?.[0]).toBe('Été.png'.normalize('NFC'))
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

  /**
   * REJECTS rather than answering `null`, and the difference is what the user hears: `null` is the
   * dialog dismissed, which is not worth a word — an engine whose context is not up yet is, and
   * the two were indistinguishable from the caller that reports.
   */
  it('says so, rather than nothing, when there is nothing to flatten', async () => {
    await expect(
      exportPicture(DOCUMENT, { ...host, snapshot: () => Promise.resolve(null) }),
    ).rejects.toThrow()
    expect(written).not.toHaveBeenCalled()
  })
})
