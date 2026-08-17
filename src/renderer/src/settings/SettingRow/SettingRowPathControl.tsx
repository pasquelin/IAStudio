import { useTranslation } from 'react-i18next'
import { HINT_LEFT } from '@/helpers/tooltip'
import { getBridge } from '@/services/bridge'
import type { CommittedProps } from './controls'
import { SettingRowTextControl } from './SettingRowTextControl'

/**
 * A path, with the native picker beside it. The field stays writable: a path can be pasted, and
 * one typed before the binary is plugged in has to be storable — see `media.ffmpegPath`.
 */
export function SettingRowPathControl({
  descriptor,
  id,
  describedBy,
  stored,
  onCommit,
}: CommittedProps) {
  const { t } = useTranslation()

  const browse = async (): Promise<void> => {
    const picked = await getBridge()?.dialog.pickPath(descriptor.pathKind ?? 'file')
    // Null is a cancelled dialog, which must not clear what is already stored.
    if (picked) onCommit(picked)
  }

  return (
    <div className="flex items-center gap-2">
      <SettingRowTextControl
        descriptor={descriptor}
        id={id}
        describedBy={describedBy}
        stored={stored}
        onCommit={onCommit}
      />
      <button
        type="button"
        className="btn btn-sm shrink-0"
        {...HINT_LEFT(t('settings.browseHint'))}
        onClick={() => void browse()}
      >
        {t('settings.browse')}
      </button>
    </div>
  )
}
