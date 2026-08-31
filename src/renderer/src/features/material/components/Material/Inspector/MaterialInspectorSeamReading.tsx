import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/Button'
import { PropertyRow } from '@/components/PropertyRow'
import { seamVerdict, type SeamVerdict } from '@shared/domain/material'
import { materialOf, useMaterials } from '@/stores/materials'
import { seamOf, useMaterialViews } from '@/stores/materialViews'
import { HINT_LEFT } from '@/helpers/tooltip'

/** i18n key of a verdict — never the label itself, as `SHAPE_LABELS` does next door. */
const SEAM_LABELS: Record<SeamVerdict, string> = {
  none: 'material.seamNone',
  faint: 'material.seamFaint',
  visible: 'material.seamVisible',
}

/**
 * What the wrap edge of this texture measures, and the button that asks. On demand rather than
 * on every change: it is a GPU pass over the base colour, and a reading nobody looked at is a
 * context opened for nothing.
 */
export function MaterialInspectorSeamReading({ documentId }: { documentId: string }) {
  const { t } = useTranslation()
  const source = useMaterials(
    state => materialOf(state, documentId).channels.baseColor?.assetId ?? null,
  )
  const seam = useMaterialViews(state => seamOf(state, documentId))
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
      const { measureMaterialSeam } = await import('@/features/material/measureSeam')
      await measureMaterialSeam(documentId)
    } finally {
      setMeasuring(false)
    }
  }

  return (
    <PropertyRow label={t('material.seams')}>
      <div className="flex items-center justify-end gap-2">
        {verdict && !measuring && (
          <span className="text-muted truncate">{t(SEAM_LABELS[verdict])}</span>
        )}
        <Button
          // Said rather than hidden: an empty base colour is something to go and fill.
          disabled={!source || measuring}
          {...HINT_LEFT(source ? t('material.measureSeamHint') : t('material.seamNoSource'))}
          onClick={() => void measure()}
        >
          {t(measuring ? 'material.measuringSeam' : 'material.measureSeam')}
        </Button>
      </div>
    </PropertyRow>
  )
}
