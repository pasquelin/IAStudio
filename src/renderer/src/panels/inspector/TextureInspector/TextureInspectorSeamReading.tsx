import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/design/Button'
import { PropertyRow } from '@/design/PropertyRow'
import { seamVerdict, type SeamVerdict } from '@shared/domain/texture'
import { textureOf, useTextures } from '@/stores/textures'
import { seamOf, useTextureViews } from '@/stores/texture-views'
import { HINT_LEFT } from '@/helpers/tooltip'

/** i18n key of a verdict — never the label itself, as `SHAPE_LABELS` does next door. */
const SEAM_LABELS: Record<SeamVerdict, string> = {
  none: 'texture.seamNone',
  faint: 'texture.seamFaint',
  visible: 'texture.seamVisible',
}

/**
 * What the wrap edge of this texture measures, and the button that asks. On demand rather than
 * on every change: it is a GPU pass over the base colour, and a reading nobody looked at is a
 * context opened for nothing.
 */
export function TextureInspectorSeamReading({ documentId }: { documentId: string }) {
  const { t } = useTranslation()
  const source = useTextures(
    state => textureOf(state, documentId).channels.baseColor?.assetId ?? null,
  )
  const seam = useTextureViews(state => seamOf(state, documentId))
  const [measuring, setMeasuring] = useState(false)

  // Only for the picture it was read off: a base colour replaced since leaves words on screen
  // about pixels the document no longer points at.
  const verdict = seam && seam.assetId === source ? seamVerdict(seam.ratio) : null

  /**
   * Reached by an `import()` rather than at the top of the file: the panels are in the opening
   * chunk, and the measurement carries three.js and a WebGL renderer behind it. A seam is
   * measured once in a while, by hand — the wait to fetch its chunk is the click itself.
   */
  const measure = async (): Promise<void> => {
    setMeasuring(true)
    try {
      const { measureTextureSeam } = await import('@/spaces/textures/measure-seam')
      await measureTextureSeam(documentId)
    } finally {
      setMeasuring(false)
    }
  }

  return (
    <PropertyRow label={t('texture.seams')}>
      <div className="flex items-center justify-end gap-2">
        {verdict && !measuring && (
          <span className="text-muted truncate">{t(SEAM_LABELS[verdict])}</span>
        )}
        <Button
          // Said rather than hidden: an empty base colour is something to go and fill.
          disabled={!source || measuring}
          {...HINT_LEFT(source ? t('texture.measureSeamHint') : t('texture.seamNoSource'))}
          onClick={() => void measure()}
        >
          {t(measuring ? 'texture.measuringSeam' : 'texture.measureSeam')}
        </Button>
      </div>
    </PropertyRow>
  )
}
