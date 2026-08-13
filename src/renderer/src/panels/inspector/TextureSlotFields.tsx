import { useTranslation } from 'react-i18next'
import { TEXTURE_SLOTS, type TextureRef, type TextureSlot } from '@shared/domain/scene'
import { PictureField } from './PictureField'

export type TextureSlotFieldsProps = {
  /** What each slot points at today. An absent or `null` slot leaves its row empty. */
  slots: Partial<Record<TextureSlot, TextureRef | null>>
  onChange: (slot: TextureSlot, assetId: string | null) => void
  /** What an empty row reads, already translated — see `PictureField`. */
  emptyLabel?: string
}

/**
 * The maps a surface wears, one row per slot, each filled from the project's own pictures.
 *
 * Shared by the material of a mesh and the overrides of an imported model: the two write into
 * different fields of a document, and there the resemblance ends — a mesh's material also carries
 * a colour and a finish, a model's file already carries both.
 */
export function TextureSlotFields({ slots, onChange, emptyLabel }: TextureSlotFieldsProps) {
  const { t } = useTranslation()

  return (
    <>
      {TEXTURE_SLOTS.map(slot => (
        <PictureField
          key={slot}
          label={t(`inspector.fields.${slot}`, slot)}
          value={slots[slot]?.assetId ?? null}
          onChange={assetId => onChange(slot, assetId)}
          emptyLabel={emptyLabel}
        />
      ))}
    </>
  )
}
