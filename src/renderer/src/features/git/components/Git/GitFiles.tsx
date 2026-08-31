import { filesInStage, GIT_STAGES, type GitStatus } from '@shared/domain/git'
import { GitFileGroup } from './File/GitFileGroup'

/**
 * What has changed in the project folder, under one heading per half of git.
 *
 * Flat under its heading rather than a folder tree: what is read here is a short list of files
 * that MOVED, and a tree of a project's depth would spend four rows of indent to show three of
 * them. The Explorer is the tree, one icon along.
 */
export function GitFiles({ status }: { status: GitStatus }) {
  return (
    // `p-2` is what `Tree` and `Collection` both put around their rows, so a line sits at the
    // same distance from the panel edge whichever list is holding it. On the right it is the
    // scroller's own strip that provides it — doubling would push these rows in twice as far.
    <div className="flex flex-col gap-2 py-2 pl-2">
      {GIT_STAGES.map(stage => {
        const files = filesInStage(status.files, stage)
        return files.length === 0 ? null : <GitFileGroup key={stage} stage={stage} files={files} />
      })}
    </div>
  )
}
