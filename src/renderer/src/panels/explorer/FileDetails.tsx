import { useTranslation } from 'react-i18next'
import { PANEL_DETAIL } from '@/design/styles'
import { selectedFilePaths, useSelection } from '@/stores/selection'
import { FileInspector } from './FileInspector'

/**
 * What the explorer has picked, read out under the tree itself — the file counterpart of
 * `AssetDetails`, and here for the same reason: the inspector describes the document in front,
 * and a file clicked in a side panel is not one.
 */
export function FileDetails() {
  const { t } = useTranslation()
  const paths = useSelection(selectedFilePaths)

  // Nothing at all rather than an empty state — see `AssetDetails`.
  if (paths.length === 0) return null

  return (
    <section className={PANEL_DETAIL} aria-label={t('explorer.details')}>
      <FileInspector paths={paths} />
    </section>
  )
}
