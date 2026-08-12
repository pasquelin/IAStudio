import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { TextureExportCommand, FolderExportRequest } from '@shared/ipc'
import type { TextureExportTarget } from '@shared/domain/texture-export'
import { setChannel } from '@/engines/texture/commands'
import { reportFailure } from '@/services/diagnostics'
import { installFakeBridge } from '@/services/fake-bridge'
import { useDocuments } from '@/stores/documents'
import { installTexture } from '@/stores/texture-fixtures'
import { useTextureViews } from '@/stores/texture-views'
import { textureOf, useTextures } from '@/stores/textures'
import { TextureDocument } from './TextureDocument'

// jsdom has no WebGL context: what the engine draws is exercised by hand, not here. This covers
// the document handing it the right state — same reason as `SkyboxDocument.test`.
vi.mock('@/services/diagnostics', () => ({ reportFailure: vi.fn() }))

vi.mock('@/engines/texture/TextureRenderer', () => ({
  TextureRenderer: class {
    mount = vi.fn()
    apply = vi.fn()
    dispose = vi.fn()
  },
}))

const DOCUMENT = 'tex-1'

const fill = (channel: 'baseColor' | 'normal', assetId = 'img-1'): void => {
  useTextures
    .getState()
    .runCommand(DOCUMENT, setChannel(channel, { assetId, origin: 'imported', width: 8, height: 8 }))
}

beforeEach(() => {
  installTexture(DOCUMENT)
  useTextureViews.setState({ inspected: {} })
})

/**
 * The history this store has always recorded, and that nothing could reach until `texture.undo`
 * was registered: no scope, no key, no menu row — while the manual already promised ⌘Z on an
 * applied style. `stores/history-scopes.test.ts` is the guard that now refuses the next one.
 */
describe('the texture history', () => {
  it('takes back a channel edit on the key', async () => {
    fill('normal')
    render(<TextureDocument documentId={DOCUMENT} />)

    await userEvent.keyboard('{Meta>}{z}{/Meta}')

    expect(textureOf(useTextures.getState(), DOCUMENT).channels.normal).toBeUndefined()
  })

  it('puts it back on redo', async () => {
    fill('normal')
    render(<TextureDocument documentId={DOCUMENT} />)

    await userEvent.keyboard('{Meta>}{z}{/Meta}')
    await userEvent.keyboard('{Shift>}{Meta>}{z}{/Meta}{/Shift}')

    expect(textureOf(useTextures.getState(), DOCUMENT).channels.normal).toBeDefined()
  })
})

describe('TextureDocument', () => {
  it('asks for a picture while the base colour is empty', () => {
    render(<TextureDocument documentId={DOCUMENT} />)

    expect(
      screen.getByText('Glissez une image du projet pour la poser en couleur de base'),
    ).toBeInTheDocument()
  })

  it('stops asking once there is something to judge', () => {
    fill('baseColor')
    render(<TextureDocument documentId={DOCUMENT} />)

    expect(screen.queryByText(/Glissez une image du projet/)).toBeNull()
  })

  describe('a channel looked at on its own', () => {
    it('draws the picture of the inspected channel', () => {
      fill('normal', 'normal-1')
      useTextureViews.getState().inspect(DOCUMENT, 'normal')
      render(<TextureDocument documentId={DOCUMENT} />)

      expect(screen.getByRole('presentation')).toHaveAttribute('src', 'scenario://asset/normal-1')
    })

    it('draws nothing flat while the material is what is shown', () => {
      fill('normal', 'normal-1')
      render(<TextureDocument documentId={DOCUMENT} />)

      expect(screen.queryByRole('presentation')).toBeNull()
    })

    /** The channel can be emptied while it is the one being looked at. */
    it('falls back to the material when the inspected channel loses its pixels', () => {
      fill('normal', 'normal-1')
      useTextureViews.getState().inspect(DOCUMENT, 'normal')
      useTextures.getState().runCommand(DOCUMENT, setChannel('normal', null))
      render(<TextureDocument documentId={DOCUMENT} />)

      expect(screen.queryByRole('presentation')).toBeNull()
    })

    // Two documents, one session store: the flat view of one must not follow into the other.
    it('reads the channel inspected in this document, not in another', () => {
      fill('normal', 'normal-1')
      useTextureViews.getState().inspect('other-doc', 'normal')
      render(<TextureDocument documentId={DOCUMENT} />)

      expect(screen.queryByRole('presentation')).toBeNull()
    })
  })
})

/**
 * The export itself needs a GPU and a save dialog; what this covers is the wiring around it —
 * which tab answers a menu row, and which one stays quiet.
 */
describe('the export menu row', () => {
  type Menu = {
    listeners: () => number
    unsubscribed: () => number
    fire: (target: TextureExportTarget) => void
    exported: () => FolderExportRequest[]
  }

  const listen = (): Menu => {
    const callbacks: ((command: TextureExportCommand) => void)[] = []
    const exported: FolderExportRequest[] = []
    let released = 0

    installFakeBridge({
      menu: {
        onTextureExport: callback => {
          callbacks.push(callback)
          return () => {
            released += 1
          }
        },
      },
      texture: {
        export: request => {
          exported.push(request)
          return Promise.resolve(request.folder)
        },
      },
    })

    return {
      listeners: () => callbacks.length,
      unsubscribed: () => released,
      fire: target => {
        for (const callback of callbacks) callback({ target })
      },
      exported: () => exported,
    }
  }

  it('is listened to while the tab is in front', () => {
    const menu = listen()
    useDocuments.setState({ activeId: DOCUMENT })

    render(<TextureDocument documentId={DOCUMENT} />)

    expect(menu.listeners()).toBe(1)
  })

  /** Two open textures would both answer one click, and both would open a folder dialog. */
  it('is not listened to by a tab that is not in front', () => {
    const menu = listen()
    useDocuments.setState({ activeId: 'another-document' })

    render(<TextureDocument documentId={DOCUMENT} />)

    expect(menu.listeners()).toBe(0)
  })

  it('lets go of the menu when the tab goes away', () => {
    const menu = listen()
    useDocuments.setState({ activeId: DOCUMENT })
    const { unmount } = render(<TextureDocument documentId={DOCUMENT} />)

    unmount()

    expect(menu.unsubscribed()).toBe(1)
  })

  /**
   * The port needs a GPU, so what a fired row can be held to here is everything around it: that
   * a texture with no channel never reaches the dialog, and that a title that reads as a path
   * never becomes one. Both were mutable in silence before this.
   */
  it('sends nothing across when the texture has no channel to export', async () => {
    const menu = listen()
    useDocuments.setState({ activeId: DOCUMENT })
    render(<TextureDocument documentId={DOCUMENT} />)

    menu.fire('raw')
    await waitFor(() => expect(reportFailure).toHaveBeenCalled())

    expect(menu.exported()).toEqual([])
    expect(reportFailure).toHaveBeenCalledWith('texture.export', 'raw', expect.anything())
  })

  it('reports the failure under the target the row named, not under another', async () => {
    const menu = listen()
    useDocuments.setState({ activeId: DOCUMENT })
    render(<TextureDocument documentId={DOCUMENT} />)

    menu.fire('roblox')
    await waitFor(() => expect(reportFailure).toHaveBeenCalled())

    expect(reportFailure).toHaveBeenCalledWith('texture.export', 'roblox', expect.anything())
  })
})
