import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setChannel } from '@/engines/texture/commands'
import { installFakeBridge } from '@/services/fake-bridge'
import { useDocuments } from '@/stores/documents'
import { installTexture } from '@/stores/texture-fixtures'
import { useTextureViews } from '@/stores/texture-views'
import { useTextures } from '@/stores/textures'
import { TextureDocument } from './TextureDocument'

// jsdom has no WebGL context: what the engine draws is exercised by hand, not here. This covers
// the document handing it the right state — same reason as `SkyboxDocument.test`.
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
  const listen = (): { listeners: () => number; unsubscribed: () => number } => {
    let listeners = 0
    let released = 0

    installFakeBridge({
      menu: {
        onTextureExport: () => {
          listeners += 1
          return () => {
            released += 1
          }
        },
      },
    })

    return { listeners: () => listeners, unsubscribed: () => released }
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
})
