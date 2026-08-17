import { useTranslation } from 'react-i18next'
import type { GitCommitFile } from '@shared/domain/git'
import { nameOf, parentOf } from '@shared/domain/folder'
import { QuietNote } from '@/design/QuietNote'
import { Row } from '@/design/Row'
import { PANEL_SCROLL, rowSkin } from '@/design/styles'
import { cn } from '@/helpers/cn'
import { useGit } from '@/stores/git'

export type CommitFilesProps = {
  files: readonly GitCommitFile[]
  /** The version these belong to — what a comparison is drawn against. */
  commit: string
}

/**
 * What one recorded version changed.
 *
 * Beside the log rather than under it, because the band is WIDE: a list stacked below would push
 * the history off the top the moment a row is picked, and the row one just clicked is the one
 * thing that must stay visible.
 */
export function CommitFiles({ files, commit }: CommitFilesProps) {
  const { t } = useTranslation()
  const compared = useGit(state => state.compared)
  const compare = useGit(state => state.compare)

  return (
    <div className={PANEL_SCROLL}>
      <h3 className="text-muted text-tiny px-2 py-1 font-medium tracking-wide uppercase">
        {t('git.commitFiles')}
      </h3>

      {files.length === 0 ? (
        <QuietNote>{t('git.commitEmpty')}</QuietNote>
      ) : (
        files.map(file => {
          const showing = compared?.path === file.path && compared.commit === commit

          return (
            <button
              key={file.path}
              type="button"
              aria-pressed={showing}
              data-selected={showing ? '' : undefined}
              onClick={() => void compare(file.path, commit)}
              className={cn(rowSkin(showing), 'w-full border-none bg-transparent p-0 text-left')}
            >
              <Row
                title={nameOf(file.path)}
                subtitle={parentOf(file.path) ?? undefined}
                hint={
                  file.from === undefined
                    ? `${file.path} · ${t(`git.change.${file.change}`)}`
                    : `${file.from} → ${file.path}`
                }
                leading={
                  <span
                    aria-hidden
                    className="text-muted w-3 shrink-0 text-center font-mono text-xs"
                  >
                    {t(`git.changeBadge.${file.change}`)}
                  </span>
                }
              />
            </button>
          )
        })
      )}
    </div>
  )
}
