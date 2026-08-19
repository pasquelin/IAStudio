import { useTranslation } from 'react-i18next'
import {
  DEFAULT_FIELD_OF_VIEW,
  MAX_FIELD_OF_VIEW,
  MIN_FIELD_OF_VIEW,
  SKYBOX_VIEWS,
} from '@shared/domain/skybox'
import { SKYBOX_VIEW_LABELS } from '@/spaces/skyboxes/skyboxTools'
import { PropertySection } from '@/design/PropertySection'
import { SelectField } from '@/design/SelectField'
import { SliderField } from '@/design/SliderField'
import { ToggleField } from '@/design/ToggleField'
import { HINT_LEFT } from '@/helpers/tooltip'
import { useSkyboxViews, skyboxViewOf } from '@/stores/skyboxViews'

export type SkyboxInspectorViewProps = { documentId: string }

/**
 * How the document in the centre is being LOOKED AT — never what it is.
 *
 * Sections of the inspector since 2026-08-19, where they were a panel of their own: the studio has
 * one answer to « what am I looking at », and a second box beside it was one more place to learn
 * to find. What is looked at and what is looked AT IT WITH belong to the same reading.
 *
 * These controls were a menu floating over the viewport before that, which covered the one thing
 * the space exists to show.
 */
export function SkyboxInspectorView({ documentId }: SkyboxInspectorViewProps) {
  const { t } = useTranslation()
  const settings = useSkyboxViews(state => skyboxViewOf(state, documentId))
  const set = useSkyboxViews.getState().set

  return (
    <>
      <PropertySection title={t('view.projection')} scId="view">
        <SelectField
          label={t('view.mode')}
          value={settings.view}
          options={SKYBOX_VIEWS.map(candidate => ({
            value: candidate,
            label: t(SKYBOX_VIEW_LABELS[candidate]),
          }))}
          onChange={view => set(documentId, { view })}
          hint={HINT_LEFT(t('view.modeHint'))}
        />

        <SliderField
          label={t('skybox.fieldOfView')}
          value={settings.fieldOfView}
          min={MIN_FIELD_OF_VIEW}
          max={MAX_FIELD_OF_VIEW}
          step={1}
          scId="view.fieldOfView"
          onChange={fieldOfView => set(documentId, { fieldOfView })}
          onReset={
            settings.fieldOfView === DEFAULT_FIELD_OF_VIEW
              ? undefined
              : () => set(documentId, { fieldOfView: DEFAULT_FIELD_OF_VIEW })
          }
        />
      </PropertySection>

      <PropertySection title={t('view.helpers')} scId="view.helpers">
        <ToggleField
          label={t('skybox.testObjects')}
          value={settings.probes}
          onChange={probes => set(documentId, { probes })}
          scId="view.probes"
        />
      </PropertySection>
    </>
  )
}
