import { useTranslation } from 'react-i18next'
import { QuietNote } from '@/design/QuietNote'
import { PANEL_GROUP_LABEL } from '@/design/styles'
import { useGitBlobUrl } from '@/hooks/useGitBlobUrl'

export type DiffImagesProps = {
  path: string
  /** The version being compared against, or `null` for the last recorded one. */
  commit: string | null
}

/**
 * Two versions of a picture, side by side.
 *
 * The comparison this studio exists for, and the one a line-by-line diff cannot give: git says
 * "Binary files differ" about a PNG, which is true and useless. What a person wants there is to
 * SEE the two.
 *
 * `HEAD` for the earlier side of a working change, the commit's own first parent for one inside
 * a version — both spelled the way git spells them, so no new vocabulary crosses the boundary.
 */
export function DiffImages({ path, commit }: DiffImagesProps) {
  const { t } = useTranslation()
  const before = useGitBlobUrl(path, commit === null ? 'HEAD' : `${commit}^`)
  const after = useGitBlobUrl(path, commit)

  if (!before && !after) return <QuietNote standalone>{t('git.compareUnavailable')}</QuietNote>

  return (
    <div className="flex min-h-0 flex-1 gap-2 p-2">
      <figure className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
        <figcaption className={PANEL_GROUP_LABEL}>{t('git.compareBefore')}</figcaption>
        {/* A file being ADDED has no earlier side, and that is the answer rather than a gap: the
            column stays, so the two pictures keep their halves of the width. */}
        {before ? (
          <img
            src={before}
            alt={t('git.compareBefore')}
            className="min-h-0 flex-1 object-contain"
          />
        ) : (
          <QuietNote>{t('git.compareNoBefore')}</QuietNote>
        )}
      </figure>

      <figure className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
        <figcaption className={PANEL_GROUP_LABEL}>{t('git.compareAfter')}</figcaption>
        {after ? (
          <img src={after} alt={t('git.compareAfter')} className="min-h-0 flex-1 object-contain" />
        ) : (
          <QuietNote>{t('git.compareNoAfter')}</QuietNote>
        )}
      </figure>
    </div>
  )
}
