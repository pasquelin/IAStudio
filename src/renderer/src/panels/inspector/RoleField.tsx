import { useTranslation } from 'react-i18next'
import { ASSET_TYPES, isAssetType } from '@shared/domain/asset'
import type { FileDomain } from '@shared/domain/file-role'
import { PropertyRow } from '@/design/PropertyRow'
import { FIELD } from '@/design/styles'
import { HINT_LEFT } from '@/helpers/tooltip'
import { useAssets } from '@/stores/assets'

/**
 * What a file IS, and — where the studio has somewhere to remember it — a way to say otherwise.
 *
 * The studio reads a domain off the extension alone, and an extension cannot always tell: a
 * normal map and an albedo are both PNGs, and a `.png` of storyboard notes is neither. The
 * guess is right often and wrong silently, so the answer is offered rather than imposed.
 *
 * Correctable only for a file the CATALOGUE holds, which is not a limitation of the field: the
 * row is the only thing that remembers. A file nothing has a row for reads its guess and says
 * where a correction would have to be written — see the hint.
 */
export function RoleField({ assetId, domain }: { assetId: string | null; domain: FileDomain }) {
  const { t } = useTranslation()
  const retype = useAssets(state => state.retype)

  if (!assetId) {
    return (
      <PropertyRow label={t('inspector.role')}>
        <span className="block w-full truncate" {...HINT_LEFT(t('inspector.roleGuessed'))}>
          {t(`assetTypes.${domain}`)}
        </span>
      </PropertyRow>
    )
  }

  return (
    <PropertyRow label={t('inspector.role')}>
      {/* A native `<select>`, as `CollectionBar` uses one: the inspector is a narrow column, and
          a menu drawn inside it gets clipped by its own edge. */}
      <select
        className={FIELD}
        aria-label={t('inspector.role')}
        value={domain}
        onChange={event => {
          const picked = event.target.value
          if (isAssetType(picked)) void retype(assetId, picked)
        }}
      >
        {ASSET_TYPES.map(type => (
          <option key={type} value={type}>
            {t(`assetTypes.${type}`)}
          </option>
        ))}
      </select>
    </PropertyRow>
  )
}
