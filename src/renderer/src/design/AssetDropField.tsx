import { mdiImagePlusOutline } from '@mdi/js'
import { useState } from 'react'
import type { UseFormRegisterReturn } from 'react-hook-form'
import { ASSET_TYPES, assetUrl, posterUrl, type Asset } from '@shared/domain/asset'
import { cn } from '@/helpers/cn'
import { AssetDropTarget } from './AssetDropTarget'
import { FIELD_FILL, FIELD_THUMBNAIL } from './styles'
import { Thumbnail } from './Thumbnail'
import { UiIcon } from './UiIcon'

export type AssetDropFieldProps = {
  /** Worn by the text input, which is the control the form's label names. */
  id?: string
  registration: UseFormRegisterReturn
  /** What the form starts with, so a preset filled by an edit action shows its picture. */
  initial?: string
  placeholder: string
}

/**
 * A picture, chosen by dropping one on it. The field a model asks for when it edits an image —
 * rendered as a plain text input before this existed, which is unusable for an asset id nobody
 * can type from memory.
 *
 * The input stays, underneath: an id can still be pasted, and a kind this field cannot serve
 * falls back to it rather than making the form disappear (invariant 5).
 */
export function AssetDropField({ id, registration, initial, placeholder }: AssetDropFieldProps) {
  const [assetId, setAssetId] = useState(initial ?? '')
  /**
   * The dropped picture's stamped URL, kept beside the id so a ⌘S that overwrote it repaints.
   *
   * Only what was DROPPED, never what the form was reset to: stamping needs the asset, and
   * nothing in `design/` reads a store — no component here does, and this field is not the one
   * to open that door for a preset's thumbnail.
   */
  const [poster, setPoster] = useState<string | null>(null)

  // A model switch resets the form; without this the old thumbnail outlives the value it stood
  // for. Keyed on what the form was reset to, so typing in between is not undone.
  const [seen, setSeen] = useState(initial)
  if (seen !== initial) {
    setSeen(initial)
    setAssetId(initial ?? '')
    setPoster(null)
  }

  const take = (dropped: Asset): void => {
    setAssetId(dropped.id)
    setPoster(posterUrl(dropped))
    // Through the registration, or react-hook-form never hears about a value nobody typed.
    void registration.onChange({ target: { name: registration.name, value: dropped.id } })
  }

  return (
    <AssetDropTarget
      accepts={ASSET_TYPES}
      onDrop={take}
      // Ours alone: an editor behind this field must not also receive the drop.
      exclusive
      className="flex min-w-0 items-center gap-2 rounded"
    >
      {assetId ? (
        <Thumbnail url={poster ?? assetUrl(assetId)} className={FIELD_THUMBNAIL} />
      ) : (
        <span className={cn(FIELD_THUMBNAIL, 'text-muted grid shrink-0 place-items-center')}>
          <UiIcon path={mdiImagePlusOutline} size={14} />
        </span>
      )}

      {/* Controlled, so a drop shows in the field as well as in the thumbnail — and so the
          reset a model switch performs empties both together. */}
      <input
        id={id}
        type="text"
        placeholder={placeholder}
        className={FIELD_FILL}
        {...registration}
        value={assetId}
        onChange={event => {
          setAssetId(event.target.value)
          void registration.onChange(event)
        }}
      />
    </AssetDropTarget>
  )
}
