import { mdiFileImportOutline } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { useToolLying } from '@/app/tool-zone'
import { CollectionBar } from '@/design/CollectionBar'
import { ToolButton } from '@/design/ToolButton'
import { useAssets } from '@/stores/assets'
import { useMedia } from '@/stores/media'
import { useProject } from '@/stores/project'
import { useTypeFacet, useTypeLabels } from './type-facet'

/**
 * The shelf's own row. In a band it carries the whole filter bar: the row is wide and mostly
 * empty there, whereas a second one under it costs height a short zone cannot spare.
 *
 * In a column it carries only the count and the import button — 500 px of browser bar in a
 * 320 px header pushed the panel's own close button out of the frame.
 */
export function AssetBrowserActions() {
  const { t } = useTranslation()
  const count = useAssets(state => state.items.length)
  const collection = useAssets(state => state.collection)
  const setCollection = useAssets(state => state.setCollection)
  // A file cannot be linked into a catalogue that is not open.
  const project = useProject(state => state.project)
  const importMedia = useMedia(state => state.importMedia)
  const typeLabels = useTypeLabels()
  const facets = useTypeFacet(typeLabels)
  const lying = useToolLying()

  return (
    <>
      {lying && (
        <CollectionBar
          state={collection}
          onChange={setCollection}
          facets={facets}
          layout="inline"
          // The header draws its own row: the bar brings its controls, not a second surface.
          className="min-w-0 flex-1 border-b-0 px-0 py-0"
        />
      )}
      <span className="text-muted mr-1 text-[11px]">{t('assets.count', { count })}</span>
      <ToolButton
        icon={mdiFileImportOutline}
        label={t('assets.import')}
        description={t('assets.importHint')}
        variant="header"
        disabled={!project}
        onClick={() => void importMedia()}
      />
    </>
  )
}
