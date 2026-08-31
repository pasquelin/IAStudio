import { useTranslation } from 'react-i18next'
import type { Asset } from '@shared/domain/asset'
import { SectionFoldScope } from '@/components/SectionFoldScope'
import { ROW_DETAIL } from '@/components/styles'
import { AssetInspector } from './Inspector/AssetInspector'
import { CloudAssetInspector } from '../CloudAssetInspector'
import type { AssetRowModel } from './rows'

/**
 * What one row opens onto — two readings, and which it gets is whether the project holds a twin.
 * Without one there is what the library says, the PROMPT above all: the field someone weighs
 * before spending a download.
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
