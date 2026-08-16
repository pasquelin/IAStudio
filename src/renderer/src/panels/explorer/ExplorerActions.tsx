import { mdiEyeOffOutline, mdiEyeOutline, mdiFileTreeOutline, mdiShapeOutline } from '@mdi/js'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { CollectionBar } from '@/design/CollectionBar'
import { ToolButton } from '@/design/ToolButton'
import { TIP_BOTTOM } from '@/helpers/tooltip'
import { useExplorerView } from '@/stores/explorer-view'
import { FOLDER_SORTS } from './folder-sort'

/**
 * The Explorer's own title row: what narrows the tree, and what widens it.
 *
 * In the title row rather than under it, which is what `layout="header"` means — a side column
 * is narrow and tall, and a second row of controls costs the tree three files' worth of height.
 * `display` is off: a tree has neither a grid nor thumbnails to size.
 */
export function ExplorerActions() {
  const { t } = useTranslation()
  const collection = useExplorerView(state => state.collection)
  const setCollection = useExplorerView(state => state.setExplorerCollection)
  const hidden = useExplorerView(state => state.hidden)
  const toggleHidden = useExplorerView(state => state.toggleExplorerHidden)
  const mode = useExplorerView(state => state.mode)
  const setMode = useExplorerView(state => state.setExplorerMode)

  const sorts = useMemo(
    () => FOLDER_SORTS.map(value => ({ value, label: t(`explorer.sort.${value}`) })),
    [t],
  )

  return (
    <>
      <CollectionBar
        state={collection}
        onChange={setCollection}
        sorts={sorts}
        layout="header"
        display={false}
      />
      {/* Two readings of one folder, and the pair is drawn as a pair: which one is on is what
          says the other exists at all. */}
      <ToolButton
        icon={mdiFileTreeOutline}
        label={t('explorer.byFolder')}
        description={t('explorer.byFolderHint')}
        tooltip={TIP_BOTTOM}
        variant="header"
        active={mode === 'folder'}
        accented={mode === 'folder'}
        onClick={() => setMode('folder')}
      />
      <ToolButton
        icon={mdiShapeOutline}
        label={t('explorer.byDomain')}
        description={t('explorer.byDomainHint')}
        tooltip={TIP_BOTTOM}
        variant="header"
        active={mode === 'domain'}
        accented={mode === 'domain'}
        onClick={() => setMode('domain')}
      />
      {/* The eye is the gesture every file browser draws for this, and what it reveals stays
          read-only: `.index/` and `.project.json` refuse every gesture, on both sides. */}
      <ToolButton
        icon={hidden ? mdiEyeOutline : mdiEyeOffOutline}
        label={t('explorer.hidden')}
        description={t('explorer.hiddenHint')}
        tooltip={TIP_BOTTOM}
        variant="header"
        active={hidden}
        onClick={toggleHidden}
      />
    </>
  )
}
