import { mdiEyeOutline } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { MAX_FIELD_OF_VIEW, MIN_FIELD_OF_VIEW, SKYBOX_VIEWS } from '@shared/domain/skybox'
import { SKYBOX_VIEW_LABELS } from '@/spaces/skyboxes/skyboxTools'
import { Chip } from '@/design/Chip'
import { EmptyState } from '@/design/EmptyState'
import { PropertySection } from '@/design/PropertySection'
import { SliderField } from '@/design/SliderField'
import { ToggleField } from '@/design/ToggleField'
import { PropertyLabel } from '@/design/PropertyLabel'
import { FIELD_ROW, PANEL_SCROLL } from '@/design/styles'
import { activeSkyboxId, useDocuments } from '@/stores/documents'
import { useSkyboxViews, skyboxViewOf } from '@/stores/skyboxViews'

/**
 * How the document in the centre is being LOOKED AT — never what it is.
 *
 * These controls used to be a horizontal menu floating over the viewport. The centre carries the
 * toolbar and the rulers, and nothing else: a menu laid over the picture covers the one thing
 * the space exists to show, and it is the first thing to overlap once a panel is undocked.
 *
 * Only the sky has such settings today. The panel is named for the question rather than for that
 * one space, so the next viewport with a projection to choose has somewhere to put it.
 */
export function View() {
  const { t } = useTranslation()
  const documentId = useDocuments(activeSkyboxId)
  const settings = useSkyboxViews(state => (documentId ? skyboxViewOf(state, documentId) : null))

  if (!documentId || !settings) {
    return <EmptyState icon={mdiEyeOutline} message={t('view.empty')} />
  }

  const set = useSkyboxViews.getState().set

  return (
    <div className={PANEL_SCROLL}>
      <PropertySection title={t('view.projection')}>
        <div className={FIELD_ROW}>
          <PropertyLabel label={t('view.mode')} />

          <div className="flex min-w-0 flex-wrap gap-2">
            {SKYBOX_VIEWS.map(candidate => (
              <Chip
                key={candidate}
                label={t(SKYBOX_VIEW_LABELS[candidate])}
                hint={t('view.modeHint')}
                selected={settings.view === candidate}
                onClick={() => set(documentId, { view: candidate })}
              />
            ))}
          </div>
        </div>

        <SliderField
          label={t('skybox.fieldOfView')}
          value={settings.fieldOfView}
          min={MIN_FIELD_OF_VIEW}
          max={MAX_FIELD_OF_VIEW}
          step={1}
          onChange={fieldOfView => set(documentId, { fieldOfView })}
        />
      </PropertySection>

      <PropertySection title={t('view.helpers')}>
        <ToggleField
          label={t('skybox.testObjects')}
          value={settings.probes}
          onChange={probes => set(documentId, { probes })}
        />
      </PropertySection>
    </div>
  )
}
