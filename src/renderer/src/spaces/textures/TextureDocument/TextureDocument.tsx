import { mdiTextureBox } from '@mdi/js'
import { useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { assetUrl, PICTURES, posterUrl, type Asset } from '@shared/domain/asset'
import type { CommandId } from '@shared/domain/command'
import { type TextureExportTarget } from '@shared/domain/textureExport'
import { activation } from '@/helpers/activation'
import { pixelEditorIntent } from '@/helpers/assetIntents'
import { cn } from '@/helpers/cn'
import { openAsset } from '@/helpers/openAsset'
import { TIP_TOP } from '@/helpers/tooltip'
import { getBridge } from '@/services/bridge'
import { reportFailure } from '@/services/diagnostics'
import { useShortcuts } from '@/hooks/useShortcuts'
import { useDocuments } from '@/stores/documents'
import { AssetDropTarget } from '@/design/AssetDropTarget'
import { EmptyState } from '@/design/EmptyState'
import { loadTexture } from '@/engines/scene/textureCache'
import { TextureRenderer } from '@/engines/texture/TextureRenderer'
import { inspectedChannel, useTextureViews } from '@/stores/textureViews'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { isTextureDirty, textureOf, useTextures } from '@/stores/textures'
import { placeTextureChannel } from '../placeChannel'
import { textureExportFiles } from '../textureExportFiles'
import { TextureToolbar } from './TextureToolbar'
import { useRestoredDocument } from '@/hooks/useRestoredDocument'
import { useShelfRefresh } from '@/hooks/useShelfRefresh'
import { assetsById, assetVersionOf, useAssets } from '@/stores/assets'

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
    // The baking is `textureExportFiles`, which the outside door shares — including its refusal
    // of a material with no channel, which throws before any dialog is raised.
    await bridge.texture.export(await textureExportFiles(documentId, target))
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

  useDocumentTitle(
    documentId,
    useTextures(state => isTextureDirty(state, documentId)),
  )

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

    const renderer = new TextureRenderer({ loadTexture, assetVersion: assetVersionOf })
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

  useShelfRefresh(() => engine.current?.refreshMaps())

  /**
   * A picture dropped on the viewport becomes the base colour. It is the one channel a texture
   * cannot be judged without, and the strip of the other seven is what the next step brings.
   */
  const onDrop = (asset: Asset): void => {
    placeTextureChannel(documentId, asset)
  }

  const flat = inspected ? texture.channels[inspected] : undefined
  // One look-up for both the picture and the gesture over it — `usePosterUrl` did the very same
  // one, and two subscriptions to a single catalogue row are two re-renders of a viewport.
  const flatAsset = useAssets(state => (flat ? assetsById(state).get(flat.assetId) : undefined))
  const flatPoster = flat && ((flatAsset && posterUrl(flatAsset)) ?? assetUrl(flat.assetId))
  // Where its PIXELS are edited, which is not this space: a texture is assembled here and painted
  // in Images. Absent leaves the picture there to be looked at and nothing more — a channel whose
  // asset the shelf is not holding, or one that is not on this disk.
  const intent = flatAsset ? pixelEditorIntent(flatAsset) : null
  const editPixels = flatAsset && intent ? () => void openAsset(flatAsset, intent) : undefined

  return (
    <AssetDropTarget
      accepts={PICTURES}
      onDrop={onDrop}
      // No frame: see `ImageDocument`. The CHANNEL slots keep theirs — there the frame IS the
      // answer, because it says which of seven places the drop would land in.
      outlined={false}
      className="relative size-full"
    >
      {/* The renderer makes its own canvas in here — see `ViewportEngine.mount`. */}
      <div ref={host} className="absolute inset-0" />

      {/* Laid over the viewport rather than unmounting it: a WebGL context does not survive being
          rebuilt for a glance at a normal map, and the engine would reload all eight channels. */}
      {flat && (
        // A button rather than a frame: the picture on show is one double-click from the space
        // that repaints it, which is the last step of « take a model's texture out, edit it, and
        // the model follows ». The same gesture the shelf offers, so it is the same two words.
        <button
          type="button"
          disabled={!editPixels}
          {...TIP_TOP(t('assets.editPixels'), false, t('assets.editPixelsHint'))}
          {...(editPixels ? activation(editPixels) : {})}
          className={cn(
            'bg-viewport absolute inset-0 flex items-center justify-center border-none p-4',
            'cursor-pointer disabled:cursor-default',
          )}
        >
          <img
            src={flatPoster}
            alt=""
            // `pixelated`: a normal or a height map is inspected to be read, and a browser's
            // smoothing hides exactly the noise one is looking for.
            className="max-h-full max-w-full object-contain [image-rendering:pixelated]"
          />
        </button>
      )}

      {!texture.channels.baseColor && !flat && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <EmptyState icon={mdiTextureBox} message={t('texture.dropSource')} />
        </div>
      )}

      {/* Last, so it stands over the flat channel above it: that one fills the viewport, and a
          bar drawn before it would be a bar nobody can reach while inspecting a map. */}
      <TextureToolbar documentId={documentId} onFrame={() => engine.current?.resetView()} />
    </AssetDropTarget>
  )
}
