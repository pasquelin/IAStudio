import { mdiCloseCircleOutline, mdiImagePlusOutline } from '@mdi/js'
import { useEffect, useState } from 'react'
import type { UseFormRegisterReturn } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { ASSET_TYPES, posterUrl, type Asset } from '@shared/domain/asset'
import { cn } from '@/helpers/cn'
import { useLatest } from '@/hooks/useLatest'
import { TIP_LEFT } from '@/helpers/tooltip'
import { AssetDropTarget } from './AssetDropTarget'
import { fieldHandle } from './scHandle'
import { FIELD_THUMBNAIL } from './styles'
import { Thumbnail } from './Thumbnail'
import { ToolButton } from './ToolButton'
import { UiIcon } from './UiIcon'

export type AssetDropListProps = {
  id?: string
  registration: UseFormRegisterReturn
  /** What the form starts with — a preset an edit action filled, or nothing. */
  initial?: readonly string[]
  placeholder: string
  /** The handle the MCP steers this field by. Never a translated word. */
  scId?: string
}

/**
 * Several pictures for one input, in the order they were dropped.
 *
 * 🛑 One registration for the whole list, and the value it carries is an ARRAY: a field per slot
 * would hand react-hook-form as many refs under one name, and it keeps the last.
 */
export function AssetDropList({
  id,
  registration,
  initial,
  placeholder,
  scId,
}: AssetDropListProps) {
  const { t } = useTranslation()
  const [ids, setIds] = useState<readonly string[]>(initial ?? [])
  // 🛑 Told through an effect rather than from the handler: a second picture dropped before the
  // first has re-rendered read the closure's stale array, and replaced it instead of joining it.
  const told = useLatest(registration)
  /**
   * The dropped picture's stamped URL, kept beside its id so a ⌘S that overwrote it repaints —
   * and so nothing here builds a bare `assetUrl`, which would never reload.
   */
  const [posters, setPosters] = useState<Readonly<Record<string, string>>>({})

  // A model switch resets the form; without this the old pictures outlive the value they stood for.
  const [seen, setSeen] = useState(initial)
  if (seen !== initial) {
    setSeen(initial)
    setIds(initial ?? [])
  }

  // Through the registration, or react-hook-form never hears about a value nobody typed. Said on
  // the mount too, which costs nothing: the form is handed what it already reset this field to.
  useEffect(() => {
    void told.current.onChange({ target: { name: told.current.name, value: [...ids] } })
  }, [ids, told])

  const take = (dropped: Asset): void => {
    setIds(current => [...current, dropped.id])
    // A kind with nothing to show a poster for keeps the placeholder rather than a broken frame.
    const poster = posterUrl(dropped)
    if (poster) setPosters(seen => ({ ...seen, [dropped.id]: poster }))
  }

  return (
    <div id={id} data-sc={scId && fieldHandle(scId)} className="flex flex-col gap-2">
      {ids.map((assetId, index) => (
        <div key={assetId} className="flex min-w-0 items-center gap-2">
          {posters[assetId] ? (
            <Thumbnail url={posters[assetId]} className={FIELD_THUMBNAIL} />
          ) : (
            <span className={cn(FIELD_THUMBNAIL, 'text-muted grid shrink-0 place-items-center')}>
              <UiIcon path={mdiImagePlusOutline} size={14} />
            </span>
          )}
          <span className="text-muted min-w-0 flex-1 truncate text-xs">{assetId}</span>
          <ToolButton
            icon={mdiCloseCircleOutline}
            label={t('generation.removeView')}
            tooltip={TIP_LEFT}
            onClick={() => setIds(current => current.filter((_, at) => at !== index))}
          />
        </div>
      ))}

      <AssetDropTarget
        accepts={ASSET_TYPES}
        onDrop={take}
        // Ours alone: an editor behind this field must not also receive the drop.
        exclusive
        className="flex min-w-0 items-center gap-2 rounded"
      >
        <span className={cn(FIELD_THUMBNAIL, 'text-muted grid shrink-0 place-items-center')}>
          <UiIcon path={mdiImagePlusOutline} size={14} />
        </span>
        <span className="text-muted min-w-0 flex-1 truncate text-xs">{placeholder}</span>
      </AssetDropTarget>
    </div>
  )
}
