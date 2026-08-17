import { useTranslation } from 'react-i18next'
import { filesInStage, GIT_STAGES, type GitFile, type GitStatus } from '@shared/domain/git'
import { Row } from '@/design/Row'
import { cn } from '@/helpers/cn'
import { TONE_TEXT, type StatusTone } from '@/design/styles'

/**
 * How each change reads, in ink.
 *
 * `danger` is spent on the two that LOSE something — a file git will drop, and a file two sides
 * disagree about. A modification is not a warning, and painting it as one would leave nothing to
 * paint the two that are.
 */
const TONES: Record<GitFile['change'], StatusTone> = {
  added: 'success',
  modified: 'accent',
  deleted: 'danger',
  renamed: 'accent',
  copied: 'accent',
  untracked: 'muted',
  conflicted: 'danger',
}

/**
 * What has changed in the project folder, under one heading per half of git.
 *
 * Flat under its heading rather than a folder tree: what is read here is a short list of files
 * that MOVED, and a tree of a project's depth would spend four rows of indent to show three of
 * them. The Explorer is the tree, one icon along.
 */
export function GitFiles({ status }: { status: GitStatus }) {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col gap-2 pb-2">
      {GIT_STAGES.map(stage => {
        const files = filesInStage(status.files, stage)
        if (files.length === 0) return null

        return (
          <section key={stage}>
            <h3 className="text-muted text-tiny px-2 py-1 font-medium tracking-wide uppercase">
              {t(`git.stage.${stage}`)}
            </h3>
            {files.map(file => (
              <Row
                // The stage belongs in the key: one path can sit under two headings at once, and
                // React would otherwise be handed the same key twice on the same list.
                key={`${stage}/${file.path}`}
                title={nameOf(file.path)}
                subtitle={folderOf(file.path)}
                hint={file.from === undefined ? file.path : `${file.from} → ${file.path}`}
                leading={
                  <span
                    aria-hidden
                    className={cn(
                      'w-3 shrink-0 text-center font-mono text-xs',
                      TONE_TEXT[TONES[file.change]],
                    )}
                  >
                    {t(`git.changeBadge.${file.change}`)}
                  </span>
                }
                actions={
                  <span className="text-muted text-tiny shrink-0">
                    {t(`git.change.${file.change}`)}
                  </span>
                }
              />
            ))}
          </section>
        )
      })}
    </div>
  )
}

/** The file, which is what one reads. Git writes slashes on every platform, Windows included. */
function nameOf(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1)
}

/** Where it sits, or nothing at the root — a subtitle repeating the name would be noise. */
function folderOf(path: string): string | undefined {
  const cut = path.lastIndexOf('/')
  return cut === -1 ? undefined : path.slice(0, cut)
}
