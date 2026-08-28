import { mdiGaugeFull, mdiMenu, mdiPauseCircleOutline, mdiRectangleOutline } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { UI_TEMPLATE_IDS, type UiTemplateId } from '@shared/domain/uiTemplates'
import { NewDocumentTemplateTile } from './NewDocumentTemplateTile'

/** No still is shipped for these: an interface template is four elements, and a glyph says more. */
const ICONS: Record<UiTemplateId, string> = {
  empty: mdiRectangleOutline,
  hud: mdiGaugeFull,
  mainMenu: mdiMenu,
  pause: mdiPauseCircleOutline,
}

export type NewDocumentUiTemplatesProps = {
  value: UiTemplateId
  onChange: (id: UiTemplateId) => void
}

/**
 * What a new interface opens on. One flat row rather than the scene's two shelves: four
 * templates differ by what they ARE, and grouping four things is a heading nobody reads.
 */
export function NewDocumentUiTemplates({ value, onChange }: NewDocumentUiTemplatesProps) {
  const { t } = useTranslation()

  return (
    <ul className="grid grid-cols-4 gap-2">
      {UI_TEMPLATE_IDS.map(id => (
        <li key={id}>
          <NewDocumentTemplateTile
            id={id}
            caption={t(`documents.uiTemplates.${id}`)}
            hint={t(`documents.uiTemplateHints.${id}`)}
            icon={ICONS[id]}
            selected={value === id}
            onPick={() => onChange(id)}
          />
        </li>
      ))}
    </ul>
  )
}
