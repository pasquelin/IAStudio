import { useTranslation } from 'react-i18next'
import type { Asset } from '@shared/domain/asset'
import { SectionFoldScope } from '@/design/SectionFoldScope'
import { ROW_DETAIL } from '@/design/styles'
import { AssetInspector } from './AssetInspector/AssetInspector'
import { CloudAssetInspector } from './AssetInspector/CloudAssetInspector'
import type { AssetRowModel } from './rows'

/**
 * What one row opens onto.
 *
 * Two readings of the same line, and which one it gets is whether this project already holds it.
 * With a twin on disk there is a catalogue row to read out, a file to reveal and a name to
 * change; without one there is what the library says about it — and the PROMPT above all, which
 * is the field someone weighs before spending a download on it.
 */
export function AssetDetails({
  row,
  twin,
}: {
  row: AssetRowModel
  twin: Asset | null | undefined
}) {
  const { t } = useTranslation()
  if (row.from !== 'remote') return null

  return (
    // Outside the inspector's fold order: these sections must not answer for the button its
    // title row carries — see `SectionFoldScope`.
    <SectionFoldScope value={false}>
      <section className={ROW_DETAIL} aria-label={t('assets.details')}>
        {twin ? <AssetInspector asset={twin} /> : <CloudAssetInspector asset={row.asset} />}
      </section>
    </SectionFoldScope>
  )
}
