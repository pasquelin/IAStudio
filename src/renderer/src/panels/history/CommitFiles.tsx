import { useTranslation } from 'react-i18next'
import type { GitCommitFile } from '@shared/domain/git'
import { QuietNote } from '@/design/QuietNote'
import { PANEL_SCROLL } from '@/design/styles'
import { ChangedFileRow } from '@/panels/shared/ChangedFileRow'
import { useGit } from '@/stores/git'
import { TagField } from './TagField'

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
      <div className="flex items-center gap-2 px-2 py-1">
        <h3 className="text-muted text-tiny min-w-0 flex-1 truncate font-medium tracking-wide uppercase">
          {t('git.commitFiles')}
        </h3>
        <TagField commit={commit} />
      </div>

      {files.length === 0 ? (
        <QuietNote>{t('git.commitEmpty')}</QuietNote>
      ) : (
        files.map(file => {
          const showing = compared?.path === file.path && compared.commit === commit

          return (
            // The skin belongs to the ROW, as it does in a tree — the button is only what makes
            // the line pressable. Worn here as well, the two stacked their radius and their fill.
            <button
              key={file.path}
              type="button"
              aria-pressed={showing}
              onClick={() => void compare(file.path, commit)}
              className="w-full cursor-pointer border-none bg-transparent p-0 text-left"
            >
              <ChangedFileRow file={file} selected={showing} />
            </button>
          )
        })
      )}
    </div>
  )
}
