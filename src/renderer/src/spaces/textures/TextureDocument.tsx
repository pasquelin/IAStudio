import { mdiTextureBox } from '@mdi/js'
import { useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { assetUrl, PICTURES, type Asset } from '@shared/domain/asset'
import type { CommandId } from '@shared/domain/command'
import { safeFileName, type TextureExportTarget } from '@shared/domain/texture-export'
import { exportChannelsOf } from '@/engines/texture/export/channels'
import { getBridge } from '@/services/bridge'
import { reportFailure } from '@/services/diagnostics'
import { useShortcuts } from '@/hooks/useShortcuts'
import { useDocuments } from '@/stores/documents'
import { AssetDropTarget } from '@/design/AssetDropTarget'
import { EmptyState } from '@/design/EmptyState'
import { loadTexture } from '@/engines/scene/texture-cache'
import { TextureRenderer } from '@/engines/texture/TextureRenderer'
import { inspectedChannel, useTextureViews } from '@/stores/texture-views'
import { textureOf, useTextures } from '@/stores/textures'
import { placeTextureChannel } from './place-channel'
import { useRestoredDocument } from '@/hooks/useRestoredDocument'

/**
 * A texture handed to an engine, from the row of the native menu that was picked.
 *
 * The port is reached through `import()` rather than at the top of this file. Not for the first
 * screen — `eager-graph.test.ts` says this component is not in the opening chunk — but for the
 * one after it: statically imported, `GLTFExporter` would be downloaded by anyone who opens a
 * texture tab, and it is only ever read by somebody who exports one.
 */
async function exportTexture(documentId: string, target: TextureExportTarget): Promise<void> {
  const bridge = getBridge()
  if (!bridge) return

  try {
    const texture = textureOf(useTextures.getState(), documentId)
    // Cleaned before it is either a folder or a file name: a document is titled by hand.
    const name = safeFileName(useDocuments.getState().documents[documentId]?.title ?? 'texture')

    const { createTextureExportPort } = await import('@/engines/texture/export/export-port')

    const files = await createTextureExportPort({ loadTexture })({
      target,
      channels: exportChannelsOf(texture),
      name,
      material: texture.material,
      shape: texture.preview.shape,
    })

    // A texture with no channels resolves to no file, and a dialog asking where to put nothing
    // is a dialog that cannot be answered.
    if (files.length === 0) throw new Error('this texture has no channel to export')

    await bridge.texture.export({ folder: name, files })
  } catch (error) {
    reportFailure('texture.export', target, error)
  }
}

/**
 * The subject, under light, and nothing else. Every setting it shows lives in the inspector — the
 * shape it sits on and the sky that lights it included: a studio is where colours and finishes are
 * judged, and a control floating over the material is a control in the way of it.
 */
export function TextureDocument({ documentId }: { documentId: string }) {
  const { t } = useTranslation()
  const host = useRef<HTMLDivElement>(null)
  const engine = useRef<TextureRenderer | null>(null)

  const texture = useTextures(state => textureOf(state, documentId))
  const inspected = useTextureViews(state => inspectedChannel(state, documentId))
  const active = useDocuments(state => state.activeId === documentId)

  useRestoredDocument(documentId)

  // Channels and styles both push onto `useTextures`, and until now nothing could pop it: no
  // scope, no key, no menu row — while the manual already promised ⌘Z on an applied style.
  const onCommand = useCallback(
    (command: CommandId) => {
      const store = useTextures.getState()
      if (command === 'texture.undo') return store.undo(documentId)
      if (command === 'texture.redo') return store.redo(documentId)
    },
    [documentId],
  )

  useShortcuts({ scope: 'texture', enabled: active, onCommand })

  // Only while this tab is in front. The event goes to the window, not to a document, so two
  // open textures would otherwise both answer one click of the same menu row — and both would
  // open a folder dialog.
  useEffect(() => {
    const bridge = getBridge()
    if (!bridge || !active) return

    return bridge.menu.onTextureExport(({ target }) => {
      void exportTexture(documentId, target)
    })
  }, [documentId, active])

  useEffect(() => {
    const element = host.current
    if (!element) return

    const renderer = new TextureRenderer({ loadTexture })
    renderer.mount(element)
    engine.current = renderer

    return () => {
      renderer.dispose()
      engine.current = null
    }
  }, [documentId])

  // The engine holds no truth: every change is pushed back into it.
  useEffect(() => {
    engine.current?.apply(texture)
  }, [texture])

  /**
   * A picture dropped on the viewport becomes the base colour. It is the one channel a texture
   * cannot be judged without, and the strip of the other seven is what the next step brings.
   */
  const onDrop = (asset: Asset): void => {
    placeTextureChannel(documentId, asset)
  }

  const flat = inspected ? texture.channels[inspected] : undefined

  return (
    <AssetDropTarget accepts={PICTURES} onDrop={onDrop} className="relative size-full">
      {/* The renderer makes its own canvas in here — see `ViewportEngine.mount`. */}
      <div ref={host} className="absolute inset-0" />

      {/* Laid over the viewport rather than unmounting it: a WebGL context does not survive being
          rebuilt for a glance at a normal map, and the engine would reload all eight channels. */}
      {flat && (
        <div className="bg-viewport absolute inset-0 flex items-center justify-center p-4">
          <img
            src={assetUrl(flat.assetId)}
            alt=""
            // `pixelated`: a normal or a height map is inspected to be read, and a browser's
            // smoothing hides exactly the noise one is looking for.
            className="max-h-full max-w-full object-contain [image-rendering:pixelated]"
          />
        </div>
      )}

      {!texture.channels.baseColor && !flat && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <EmptyState icon={mdiTextureBox} message={t('texture.dropSource')} />
        </div>
      )}
    </AssetDropTarget>
  )
}
