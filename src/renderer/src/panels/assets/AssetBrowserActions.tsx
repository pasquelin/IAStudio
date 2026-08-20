import {
  mdiAlertOutline,
  mdiCloudUploadOutline,
  mdiFileDocumentOutline,
  mdiFileImportOutline,
  mdiTextBoxOutline,
} from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { exportContactSheet } from '@/app/contactSheetExport'
import { getBridge } from '@/services/bridge'
import { ToolButton } from '@/design/ToolButton'
import { UiIcon } from '@/design/UiIcon'
import { HINT_BOTTOM, TIP_BOTTOM } from '@/helpers/tooltip'
import { useAssets } from '@/stores/assets'
import { useCloud } from '@/stores/cloud'
import { useMedia } from '@/stores/media'
import { useProject } from '@/stores/project'
import { useSelection } from '@/stores/selection'

/** Names the chosen pictures from what the API sees in them. Nothing happens without a click. */
async function describeSelection(assetIds: readonly string[]): Promise<void> {
  await getBridge()?.assets.describe(assetIds)
}

// The bar itself is NOT here: the shelf stands in a column, where 500 px of bar in a 320 px
// header pushed the close button out of the frame. It rode here while the shelf lay in a band —
// that placement went on 17 August, and the branch with it.
export function AssetBrowserActions() {
  const { t } = useTranslation()
  // What the shelf is drawing — project, library and generations in flight, filters included.
  // Its own catalogue only while no shelf is mounted, which is the one moment nothing is drawn.
  const count = useAssets(state => state.shownCount ?? state.items.length)
  // A file cannot be linked into a catalogue that is not open.
  const project = useProject(state => state.project)
  const importMedia = useMedia(state => state.importMedia)
  const ffmpeg = useMedia(state => state.capabilities.ffmpeg)

  const selection = useSelection(state => state.selection)
  const refresh = useAssets(state => state.refresh)
  const push = useCloud(state => state.push)
  const busy = useCloud(state => state.busy)
  // Only assets can be sent, and only the ones that are selected: pushing a whole project by
  // accident is not something a single click should be able to do.
  const selected = selection.kind === 'asset' ? selection.ids : []

  return (
    <>
      {/* An icon rather than the sentence, which is 65 characters and would chase the facets out
          of the row; not a button, since nothing here can install ffmpeg. Focusable all the same:
          the tooltip is the only thing that shows the sentence, and a pointer is not the only way
          to ask for it. */}
      {!ffmpeg && (
        <span
          role="img"
          tabIndex={0}
          className="text-warning inline-flex shrink-0 items-center rounded-(--radius-sc-sm)"
          {...TIP_BOTTOM(t('ingest.noFfmpeg'))}
        >
          <UiIcon path={mdiAlertOutline} size={14} />
        </span>
      )}
      {/* A hint and not a tooltip factory: the number is already on screen, and an `aria-label`
          over it would answer to a name nobody can see (WCAG 2.5.3). What it adds is the half
          the number cannot say — which shelves it is counting. */}
      <span className="text-muted text-tiny mr-1" {...HINT_BOTTOM(t('assets.countHint'))}>
        {t('assets.count', { count })}
      </span>
      <ToolButton
        icon={mdiFileImportOutline}
        label={t('assets.import')}
        description={t('assets.importHint')}
        tooltip={TIP_BOTTOM}
        variant="header"
        disabled={!project}
        onClick={() => void importMedia()}
      />
      <ToolButton
        icon={mdiTextBoxOutline}
        label={t('assets.describe', { count: selected.length })}
        description={t('assets.describeHint')}
        tooltip={TIP_BOTTOM}
        variant="header"
        disabled={!project || selected.length === 0}
        // The names land in the catalogue, which the panel only re-reads when asked.
        onClick={() => void describeSelection(selected).then(refresh)}
      />
      <ToolButton
        icon={mdiFileDocumentOutline}
        label={t('assets.contactSheet', { count: selected.length })}
        description={t('assets.contactSheetHint')}
        tooltip={TIP_BOTTOM}
        variant="header"
        disabled={!project || selected.length === 0}
        onClick={() => void exportContactSheet(selected, t('assets.contactSheetName'))}
      />
      <ToolButton
        icon={mdiCloudUploadOutline}
        label={t('assets.push', { count: selected.length })}
        description={t('assets.pushHint')}
        tooltip={TIP_BOTTOM}
        variant="header"
        disabled={!project || busy || selected.length === 0}
        onClick={() => void push(selected)}
      />
    </>
  )
}
