import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { QuietNote } from '@/design/QuietNote'
import { withMaterialAt } from '@shared/domain/scene'
import { documentsOfKind, useDocuments } from '@/stores/documents'
import { ModelDressSectionRow } from './ModelDressSectionRow'

export type ModelDressSectionMaterialsProps = {
  worn: readonly string[]
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
  slots,
  onChange,
  onAssemble,
}: ModelDressSectionMaterialsProps) {
  const { t } = useTranslation()
  // Both, so a material saved but not open is offered: `stored` is the folder, `documents` the
  // tabs. Selected APART and joined in a memo — a selector building the list would hand zustand a
  // fresh array on every notification, which is a render loop.
  const stored = useDocuments(state => state.stored)
  const open = useDocuments(state => state.documents)

  const options = useMemo(
    () =>
      documentsOfKind({ stored, documents: open }, 'material').map(one => ({
        id: one.id,
        name: one.title,
      })),
    [stored, open],
  )

  return (
    <>
      {worn.map((documentId, slot) => (
        <ModelDressSectionRow
          key={slot}
          slot={slot}
          documentId={documentId}
          options={options}
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
