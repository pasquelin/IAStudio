import { useTranslation } from 'react-i18next'
import { SectionFoldScope } from '@/design/SectionFoldScope'
import { PANEL_DETAIL } from '@/design/styles'
import { selectedFilePaths, useSelection } from '@/stores/selection'
import { FileInspector } from './FileInspector'

/**
 * What the explorer has picked, read out under the tree itself — the file counterpart of
 * `AssetDetails`, and here for the same reason.
 */
export function FileDetails() {
  const { t } = useTranslation()
  const paths = useSelection(selectedFilePaths)

  // Nothing at all rather than an empty state — see `AssetDetails`.
  if (paths.length === 0) return null

  return (
    // Outside the inspector's fold order — see `AssetDetails`.
    <SectionFoldScope value={false}>
      <section className={PANEL_DETAIL} aria-label={t('explorer.details')}>
        <FileInspector paths={paths} />
      </section>
    </SectionFoldScope>
  )
}
