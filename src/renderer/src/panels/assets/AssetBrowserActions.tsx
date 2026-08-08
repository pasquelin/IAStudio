import { mdiCloudUploadOutline, mdiFileImportOutline } from '@mdi/js'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useToolLying } from '@/app/tool-zone'
import { CollectionBar } from '@/design/CollectionBar'
import { ToolButton } from '@/design/ToolButton'
import { useAssets } from '@/stores/assets'
import { useCloud } from '@/stores/cloud'
import { useMedia } from '@/stores/media'
import { useProject } from '@/stores/project'
import { useSelection } from '@/stores/selection'
import { useLocationFacet } from './location-facet'
import { useTypeFacet, useTypeLabels } from './type-facet'

// The bar rides here in a band, where the row is wide and a second one would cost height the
// zone cannot spare. Not in a column: 500 px of bar in a 320 px header pushed the close button
// out of the frame, which is what put it under the title in the first place.
export function AssetBrowserActions() {
  const { t } = useTranslation()
  const count = useAssets(state => state.items.length)
  const collection = useAssets(state => state.collection)
  const setCollection = useAssets(state => state.setCollection)
  // A file cannot be linked into a catalogue that is not open.
  const project = useProject(state => state.project)
  const importMedia = useMedia(state => state.importMedia)
  const typeLabels = useTypeLabels()
  const typeFacet = useTypeFacet(typeLabels)
  const locationFacet = useLocationFacet()
  const facets = useMemo(() => [...typeFacet, ...locationFacet], [typeFacet, locationFacet])
  const lying = useToolLying()

  const selection = useSelection(state => state.selection)
  const push = useCloud(state => state.push)
  const busy = useCloud(state => state.busy)
  // Only assets can be sent, and only the ones that are selected: pushing a whole project by
  // accident is not something a single click should be able to do.
  const selected = selection.kind === 'asset' ? selection.ids : []

  return (
    <>
      {lying && (
        <CollectionBar
          state={collection}
          onChange={setCollection}
          facets={facets}
          layout="header"
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
      <ToolButton
        icon={mdiCloudUploadOutline}
        label={t('assets.push', { count: selected.length })}
        description={t('assets.pushHint')}
        variant="header"
        disabled={!project || busy || selected.length === 0}
        onClick={() => void push(selected)}
      />
    </>
  )
}
