import { mdiFileOutline } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import type { FileDomain } from '@shared/domain/fileRole'
import { Row } from '@/design/Row'
import { UiIcon } from '@/design/UiIcon'
import { assetIcon } from '@/helpers/workspaces'

/**
 * One of the six domains, standing as a root of the explorer's domain view — and the number of
 * files filed under it, which is what a reader comes to this view for.
 *
 * Not an `EntryRow`: it opens nothing and is renamed by nobody. What it shares with one is the
 * `Row` underneath, so both rhythms are the same tree's — and the glyph, read off the table the
 * rail and the shelf read, so a domain wears one face across the studio.
 */
export function DomainRow({ domain, count }: { domain: FileDomain; count: number }) {
  const { t } = useTranslation()

  return (
    <Row
      media={
        <UiIcon
          path={domain === 'other' ? mdiFileOutline : assetIcon(domain)}
          size={14}
          className="shrink-0"
        />
      }
      title={t(`assetTypes.${domain}`)}
      // Beside the name rather than after it: the count is what this row exists to say, and a
      // domain of four hundred pictures reads at a glance.
      actions={<span className="text-muted text-mini tabular-nums">{count}</span>}
    />
  )
}
