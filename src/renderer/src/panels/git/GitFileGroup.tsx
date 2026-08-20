import {
  mdiCloseOctagonOutline,
  mdiMinusBoxMultipleOutline,
  mdiPlusBoxMultipleOutline,
} from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { pathsOf, type GitFile, type GitStage } from '@shared/domain/git'
import { PANEL_GROUP_LABEL_WIDE } from '@/design/styles'
import { ToolButton } from '@/design/ToolButton'
import { TIP_LEFT } from '@/helpers/tooltip'
import { useGit } from '@/stores/git'
import { GitFileRow } from './GitFileRow'

/**
 * One heading and the files under it.
 *
 * The heading carries the gesture for the whole group, because the alternative is thirty clicks:
 * a project touched by an import has as many changed files as the import wrote. A BUTTON rather
 * than a tri-state tick — half a group ticked would leave the box indeterminate, which is a
 * state nobody can act on and a name no reader can be given.
 */
export function GitFileGroup({ stage, files }: { stage: GitStage; files: readonly GitFile[] }) {
  const { t } = useTranslation()
  const busy = useGit(state => state.busy)
  const stageAll = useGit(state => state.stage)
  const unstageAll = useGit(state => state.unstage)
  const abortMerge = useGit(state => state.abortMerge)

  return (
    <section>
      {/* `px-1`, the same gutter the rows below carry inside `Row`: the heading's word and the
          rows' names start on the same column, and their two buttons end on the same one. */}
      <div className="flex items-center gap-2 px-1 py-1">
        <h3 className={PANEL_GROUP_LABEL_WIDE}>{t(`git.stage.${stage}`)}</h3>
        <span className="text-muted text-tiny shrink-0 tabular-nums">{files.length}</span>
        {/* The way OUT of a merge, and it belongs on the heading rather than on a row: what it
            undoes is the whole operation, not one file. Only offered while there is one to
            undo — a repository not mid-merge would refuse it, and a button that only ever fails
            is worse than no button. */}
        {stage === 'conflicted' && (
          <ToolButton
            icon={mdiCloseOctagonOutline}
            label={t('git.abortMerge')}
            description={t('git.abortMergeHint')}
            tooltip={TIP_LEFT}
            variant="row"
            disabled={busy}
            onClick={() => void abortMerge()}
          />
        )}

        <ToolButton
          icon={stage === 'staged' ? mdiMinusBoxMultipleOutline : mdiPlusBoxMultipleOutline}
          // Named for its GROUP: three headings carried three buttons a reader heard the same
          // way, and the one under the pointer was the only clue which group was meant.
          label={t(stage === 'staged' ? 'git.unstageAllIn' : 'git.stageAllIn', {
            group: t(`git.stage.${stage}`),
          })}
          description={t(stage === 'staged' ? 'git.unstageAllHint' : 'git.stageAllHint')}
          tooltip={TIP_LEFT}
          variant="row"
          disabled={busy}
          // Deduplicated: a file modified in both halves is listed twice, and git refuses the
          // same path given twice in one command with a lock error that reads like a defect.
          onClick={() => void (stage === 'staged' ? unstageAll : stageAll)(pathsOf(files))}
        />
      </div>

      {files.map(file => (
        // The stage belongs in the key: one path can sit under two headings at once, and React
        // would otherwise be handed the same key twice on the same list.
        <GitFileRow key={`${stage}/${file.path}`} file={file} />
      ))}
    </section>
  )
}
