import { mdiTextureBox } from '@mdi/js'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { TextureLoader, type Texture } from 'three'
import { assetUrl, PICTURES, type Asset } from '@shared/domain/asset'
import { AssetDropTarget } from '@/design/AssetDropTarget'
import { EmptyState } from '@/design/EmptyState'
import { TextureRenderer } from '@/engines/texture/TextureRenderer'
import { inspectedChannel, useTextureViews } from '@/stores/texture-views'
import { textureOf, useTextures } from '@/stores/textures'
import { placeTextureChannel } from './place-channel'
import { useRestoredDocument } from '@/hooks/useRestoredDocument'

/** jsdom decodes no image; the engine takes its loader as a port for exactly that reason. */
const loadTexture = (url: string): Promise<Texture> => new TextureLoader().loadAsync(url)

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

  useRestoredDocument(documentId)

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
