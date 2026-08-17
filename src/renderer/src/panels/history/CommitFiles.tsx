import { useTranslation } from 'react-i18next'
import type { GitCommitFile } from '@shared/domain/git'
import { QuietNote } from '@/design/QuietNote'
import { Row } from '@/design/Row'
import { PANEL_SCROLL } from '@/design/styles'

/**
 * What one recorded version changed.
 *
 * Beside the log rather than under it, because the band is WIDE: a list stacked below would push
 * the history off the top the moment a row is picked, and the row one just clicked is the one
 * thing that must stay visible.
 */
export function CommitFiles({ files }: { files: readonly GitCommitFile[] }) {
  const { t } = useTranslation()

  return (
    <div className={PANEL_SCROLL}>
      <h3 className="text-muted text-tiny px-2 py-1 font-medium tracking-wide uppercase">
        {t('git.commitFiles')}
      </h3>

      {files.length === 0 ? (
        <QuietNote>{t('git.commitEmpty')}</QuietNote>
      ) : (
        files.map(file => (
          <Row
            key={file.path}
            title={file.path.slice(file.path.lastIndexOf('/') + 1)}
            subtitle={
              file.path.includes('/') ? file.path.slice(0, file.path.lastIndexOf('/')) : undefined
            }
            hint={
              file.from === undefined
                ? `${file.path} · ${t(`git.change.${file.change}`)}`
                : `${file.from} → ${file.path}`
            }
            leading={
              <span aria-hidden className="text-muted w-3 shrink-0 text-center font-mono text-xs">
                {t(`git.changeBadge.${file.change}`)}
              </span>
            }
          />
        ))
      )}
    </div>
  )
}
