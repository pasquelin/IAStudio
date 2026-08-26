import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { PropertySection } from '@/design/PropertySection'
import { SelectField, type SelectOption } from '@/design/SelectField'
import { useDocuments } from '@/stores/documents'

/** No material: the model wears the maps and the finish its own file carries. */
const OWN_FILE = ''

export type ModelMaterialSectionProps = {
  materialDocumentId: string | undefined
  onChange: (materialDocumentId: string | null) => void
}

/**
 * The material an imported model wears, named by its document.
 *
 * A REFERENCE and not a copy, which is the whole of this panel: editing that material — swapping
 * the picture in a channel, turning a dial — reaches every model wearing it, with no gesture here.
 * That is why there is no slot to fill: a material already holds one per channel, and a second,
 * poorer list on the node is what used to keep an edit from arriving.
 */
export function ModelMaterialSection({ materialDocumentId, onChange }: ModelMaterialSectionProps) {
  const { t } = useTranslation()
  // Both, so a material saved but not open is offered: `stored` is the folder, `documents` the
  // tabs. Selected APART and joined in a memo — a selector building the list would hand zustand a
  // fresh array on every notification, which is a render loop.
  const stored = useDocuments(state => state.stored)
  const open = useDocuments(state => state.documents)

  const options = useMemo(
    () => [
      { value: OWN_FILE, label: t('inspector.modelOwnMaterial') },
      // Keyed by id, because a material open in a tab is also listed in the folder.
      ...new Map<string, SelectOption<string>>(
        [...stored, ...Object.values(open)]
          .filter(one => one.kind === 'material')
          .map(one => [one.id, { value: one.id, label: one.title }]),
      ).values(),
    ],
    [stored, open, t],
  )

  return (
    <PropertySection title={t('inspector.modelMaterial')} scId="modelMaterial">
      <SelectField
        label={t('inspector.modelMaterialField')}
        scId="modelMaterial"
        value={materialDocumentId ?? OWN_FILE}
        options={options}
        onChange={value => onChange(value === OWN_FILE ? null : value)}
      />
    </PropertySection>
  )
}
