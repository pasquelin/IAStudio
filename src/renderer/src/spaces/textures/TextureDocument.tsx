import { mdiRotate3dVariant, mdiTextureBox, mdiWeatherSunny } from '@mdi/js'
import { useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { TextureLoader, type Texture } from 'three'
import { assetUrl } from '@shared/domain/asset'
import { PICTURES } from '@shared/domain/asset'
import { AssetDropTarget } from '@/design/AssetDropTarget'
import { EmptyState } from '@/design/EmptyState'
import { ToolButton } from '@/design/ToolButton'
import { setPreview } from '@/engines/texture/commands'
import { TextureRenderer } from '@/engines/texture/TextureRenderer'
import { PREVIEW_SHAPES, type PreviewShape } from '@/engines/texture/texture-state'
import { restoreDocument } from '@/app/document-io'
import { cn } from '@/helpers/cn'
import { assetsById, useAssets } from '@/stores/assets'
import { textureOf, useTextures } from '@/stores/textures'
import { placeTextureChannel } from './place-channel'

/** i18n key of a shape — never the label itself, as the scene registry does for its primitives. */
const SHAPE_LABELS: Record<PreviewShape, string> = {
  sphere: 'texture.shapeSphere',
  box: 'texture.shapeBox',
  cylinder: 'texture.shapeCylinder',
  plane: 'texture.shapePlane',
  torusKnot: 'texture.shapeKnot',
}

/** jsdom decodes no image; the engine takes its loader as a port for exactly that reason. */
const loadTexture = (url: string): Promise<Texture> => new TextureLoader().loadAsync(url)

export function TextureDocument({ documentId }: { documentId: string }) {
  const { t } = useTranslation()
  const host = useRef<HTMLDivElement>(null)
  const engine = useRef<TextureRenderer | null>(null)

  const texture = useTextures(state => textureOf(state, documentId))
  const byId = useAssets(assetsById)

  // Fills the tab from the project when a file is there, from the default otherwise — and it is
  // what saving reads back, so the two never disagree about what this document holds.
  useEffect(() => {
    void restoreDocument(documentId)
  }, [documentId])

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

  const run = useTextures(state => state.runCommand)
  const preview = texture.preview

  /**
   * A picture dropped on the viewport becomes the base colour. It is the one channel a texture
   * cannot be judged without, and the strip of the other seven is what the next step brings.
   */
  const onDrop = useMemo(
    () => (assetId: string) => {
      const asset = byId.get(assetId)
      if (asset) placeTextureChannel(documentId, asset)
    },
    [byId, documentId],
  )

  const base = texture.channels.baseColor

  return (
    <AssetDropTarget
      accepts={type => type === null || PICTURES.includes(type)}
      onDrop={onDrop}
      className="relative size-full"
    >
      {/* The renderer makes its own canvas in here — see `ViewportEngine.mount`. */}
      <div ref={host} className="absolute inset-0" />

      {!base && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <EmptyState icon={mdiTextureBox} message={t('texture.dropSource')} />
        </div>
      )}

      <div className="bg-panel/80 absolute top-2 left-2 flex items-center gap-1 rounded-(--radius-sc-md) p-1">
        {PREVIEW_SHAPES.map(shape => (
          <button
            key={shape}
            type="button"
            onClick={() => run(documentId, setPreview('shape', shape))}
            aria-pressed={preview.shape === shape}
            className={cn(
              'h-(--sc-control) cursor-pointer rounded-(--radius-sc-sm) border-none px-2 text-xs',
              preview.shape === shape ? 'bg-elevated text-text' : 'text-muted bg-transparent',
            )}
          >
            {t(SHAPE_LABELS[shape])}
          </button>
        ))}

        <ToolButton
          icon={mdiWeatherSunny}
          label={t('texture.showBackground')}
          active={preview.showBackground}
          onClick={() => run(documentId, setPreview('showBackground', !preview.showBackground))}
        />
        <ToolButton
          icon={mdiRotate3dVariant}
          label={t('texture.autoSpin')}
          active={preview.autoSpin}
          onClick={() => run(documentId, setPreview('autoSpin', !preview.autoSpin))}
        />

        <label className="text-muted flex items-center gap-1 pl-2 text-xs">
          {t('texture.envIntensity')}
          <input
            type="range"
            min={0}
            max={3}
            step={0.05}
            value={preview.envIntensity}
            onChange={event =>
              run(documentId, setPreview('envIntensity', Number(event.target.value)))
            }
            className="accent-accent w-24"
          />
        </label>
      </div>

      {base && (
        <div className="bg-panel/80 text-muted absolute right-2 bottom-2 rounded-(--radius-sc-md) px-2 py-1 text-xs">
          <img
            src={assetUrl(base.assetId)}
            alt=""
            className="size-16 rounded-(--radius-sc-sm) object-cover"
          />
        </div>
      )}
    </AssetDropTarget>
  )
}
