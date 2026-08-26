import { useTranslation } from 'react-i18next'
import { QuietNote } from '@/design/QuietNote'
import type { LinkOption } from '@/design/LinkField/LinkField'
import { withMaterialAt } from '@shared/domain/scene'
import { useDocumentOptions } from '@/hooks/useDocumentOptions'
import { ModelDressSectionRow } from './ModelDressSectionRow'

export type ModelDressSectionMaterialsProps = {
  worn: readonly string[]
  /** The project's pictures, asked ONCE by the section and handed down — a row would ask per slot. */
  pictures: readonly LinkOption[]
  /** How many materials the model's own file carries. Zero while its file has not landed. */
  slots: number
  onChange: (documentIds: readonly string[]) => void
  onAssemble: (slot: number) => void
}

/**
 * The material slots of a model, as Blender and Unreal draw them. The list is the USER'S, not the
 * file's — a row past what the file carries is kept and SAID rather than dropped.
 */
export function ModelDressSectionMaterials({
  worn,
  pictures,
  slots,
  onChange,
  onAssemble,
}: ModelDressSectionMaterialsProps) {
  const { t } = useTranslation()
  const options = useDocumentOptions('material')

  return (
    <>
      {worn.map((documentId, slot) => (
        <ModelDressSectionRow
          key={slot}
          slot={slot}
          documentId={documentId}
          options={options}
          pictures={pictures}
          // Beyond what the file carries — the row is kept, and does nothing until the model has
          // that many materials. Said on the note below rather than on every row.
          inert={slots > 0 && slot >= slots}
          onChange={next => onChange(withMaterialAt(worn, slot, next))}
          onAssemble={() => onAssemble(slot)}
        />
      ))}

      {worn.length > slots && slots > 0 && (
        <QuietNote>
          {t('inspector.modelDressExtraSlots', { count: worn.length - slots, slots })}
        </QuietNote>
      )}
    </>
  )
}
