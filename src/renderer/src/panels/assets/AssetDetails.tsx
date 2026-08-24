import { useTranslation } from 'react-i18next'
import { SectionFoldScope } from '@/design/SectionFoldScope'
import { ROW_DETAIL } from '@/design/styles'
import { AssetInspector } from './AssetInspector/AssetInspector'
import type { AssetRowModel } from './rows'

/**
 * What one row of the shelf opens onto — the inspector describes the document in front and only
 * that, so an asset reads out where it was picked.
 *
 * Only a row the catalogue holds has any of this to say: a library line has no file here and a
 * running job has no asset yet, and both are told by the chevron being drawn on nothing.
 */
export function AssetDetails({ row }: { row: AssetRowModel }) {
  const { t } = useTranslation()
  if (row.from !== 'local') return null

  return (
    // Outside the inspector's fold order: these sections must not answer for the button its
    // title row carries — see `SectionFoldScope`.
    <SectionFoldScope value={false}>
      <section className={ROW_DETAIL} aria-label={t('assets.details')}>
        <AssetInspector asset={row.asset} />
      </section>
    </SectionFoldScope>
  )
}
