import { mdiImagePlusOutline } from '@mdi/js'
import { useState } from 'react'
import type { UseFormRegisterReturn } from 'react-hook-form'
import { assetUrl } from '@shared/domain/asset'
import { assetIdFromDrag } from '@/helpers/asset-drag'
import { cn } from '@/helpers/cn'
import { FIELD } from './styles'
import { Thumbnail } from './Thumbnail'
import { UiIcon } from './UiIcon'

export type AssetDropFieldProps = {
  registration: UseFormRegisterReturn
  /** What the form starts with, so a preset filled by an edit action shows its picture. */
  initial?: string
  placeholder: string
}

/** The thumbnail matches the control gauge, so the field is exactly one row tall. */
const THUMBNAIL = 'size-(--sc-control)'

/**
 * A picture, chosen by dropping one on it. The field a model asks for when it edits an image —
 * rendered as a plain text input before this existed, which is unusable for an asset id nobody
 * can type from memory.
 *
 * The input stays, underneath: an id can still be pasted, and a kind this field cannot serve
 * falls back to it rather than making the form disappear (invariant 5).
 */
export function AssetDropField({ registration, initial, placeholder }: AssetDropFieldProps) {
  const [assetId, setAssetId] = useState(initial ?? '')
  const [over, setOver] = useState(false)

  // A model switch resets the form; without this the old thumbnail outlives the value it stood
  // for. Keyed on what the form was reset to, so typing in between is not undone.
  const [seen, setSeen] = useState(initial)
  if (seen !== initial) {
    setSeen(initial)
    setAssetId(initial ?? '')
  }

  const take = (event: React.DragEvent): void => {
    event.preventDefault()
    // Ours alone: an editor behind this field must not also receive the drop.
    event.stopPropagation()
    setOver(false)

    const dropped = assetIdFromDrag(event)
    if (!dropped) return
    setAssetId(dropped)
    // Through the registration, or react-hook-form never hears about a value nobody typed.
    void registration.onChange({ target: { name: registration.name, value: dropped } })
  }

  return (
    <div
      className={cn('flex min-w-0 items-center gap-1', over && 'ring-accent rounded ring-1')}
      onDragOver={event => {
        event.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={take}
    >
      {assetId ? (
        <Thumbnail url={assetUrl(assetId)} className={THUMBNAIL} />
      ) : (
        <span className={cn(THUMBNAIL, 'text-muted grid shrink-0 place-items-center')}>
          <UiIcon path={mdiImagePlusOutline} size={14} />
        </span>
      )}

      {/* Controlled, so a drop shows in the field as well as in the thumbnail — and so the
          reset a model switch performs empties both together. */}
      <input
        type="text"
        placeholder={placeholder}
        className={cn(FIELD, 'min-w-0 flex-1')}
        {...registration}
        value={assetId}
        onChange={event => {
          setAssetId(event.target.value)
          void registration.onChange(event)
        }}
      />
    </div>
  )
}
