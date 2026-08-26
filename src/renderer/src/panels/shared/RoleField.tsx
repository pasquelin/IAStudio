import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FILE_DOMAINS, type FileDomain } from '@shared/domain/fileRole'
import { PropertyRow } from '@/design/PropertyRow'
import { SelectField } from '@/design/SelectField'
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
  /**
   * What was picked here, until the host reads it back. Not every host does: the information
   * window holds its asset in a `useState` that only a folder change refreshes, and retyping
   * moves nothing on disk — so the control showed the OLD role the moment it was corrected.
   */
  const [written, setWritten] = useState<FileDomain | null>(null)

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
    <SelectField
      label={t('inspector.role')}
      value={written ?? domain}
      options={FILE_DOMAINS.map(type => ({
        value: type,
        label: t(`assetTypes.${type}`),
        // Listed as a STATE, never as a choice: `other` is what the studio reads when no
        // extension answers, and `material` is a DOCUMENT rather than a kind of bytes — neither
        // is something a file can be retyped TO. Left out, the row showed « Image » over a file
        // that is not one — the select simply fell back to its first option.
        disabled: type === 'other' || type === 'material',
      }))}
      onChange={picked => {
        if (picked === 'other' || picked === 'material') return
        setWritten(picked)
        // Given back on a refusal: the catalogue is what decides, and a control left showing a
        // correction nobody recorded is the same lie the other way round.
        void retype(assetId, picked).catch(() => setWritten(null))
      }}
      scId="file.role"
    />
  )
}
