import { mdiChevronDown, mdiFolderOutline } from '@mdi/js'
import { useEffect, useMemo } from 'react'
import { FOLDER_ROOT, folderTrail, isDocumentFolder, nameOf } from '@shared/domain/folder'
import { cn } from '@/helpers/cn'
import { activation } from '@/helpers/activation'
import { HINT_BOTTOM } from '@/helpers/tooltip'
import { useFolderTree, type FolderNode } from '@/hooks/useFolderTree'
import { useHoverFlyout } from '@/hooks/useHoverFlyout'
import { Flyout } from '../Flyout'
import { Tree } from '../Tree'
import { UiIcon } from '../UiIcon'
import { FIELD } from '../styles'
import { FolderFieldCreate } from './FolderFieldCreate'

/**
 * The id the ROOT row carries, standing for the project folder itself.
 *
 * `FOLDER_ROOT` is the empty string, which no tree can key a row on; a leading slash is what
 * `parseFolderPath` refuses outright, so it can never be mistaken for a path either.
 */
const TREE_ROOT = '/'

const folderOf = (id: string): string => (id === TREE_ROOT ? FOLDER_ROOT : id)
const idOf = (folder: string): string => (folder === FOLDER_ROOT ? TREE_ROOT : folder)

export type FolderFieldProps = {
  /** The chosen folder, relative to the project. `FOLDER_ROOT` is the project folder itself. */
  value: string
  onChange: (folder: string) => void
  /** Goes on the line itself, so a visible `<label>` can name it — a button IS labelable. */
  id?: string
  /** The project's own name, which is what the root row is called. Already translated. */
  rootName: string
  /**
   * Every word this field puts on screen, already translated: it draws what it is handed and
   * looks nothing up, the way every other field of `design/` does.
   */
  labels: {
    tree: string
    hint: string
    newFolder: string
    newFolderName: string
    newFolderLabel: string
    folderTaken: string
    folderFailed: string
  }
}

/**
 * Where something goes in the project, picked from the project's own folders.
 *
 * The whole line opens the tree, and the tree is `Tree` itself, fed by the Explorer's own
 * `useFolderTree` — the same rows, chevrons, indentation and disk watch, rather than a second
 * file tree that would drift from the first.
 *
 * Written for the new-document dialog and for whatever else has to place a file: the reading,
 * the unfolding and the making of a new folder are all in here, so a caller holds the answer
 * and nothing else.
 */
export function FolderField({ value, onChange, id, rootName, labels }: FolderFieldProps) {
  const flyout = useHoverFlyout(2)
  const tree = useFolderTree(false)

  // The walk down to the chosen folder, so a field opening on `Images/Croquis` shows that row
  // rather than a root with everything closed. Idempotent, hence `unfold` and not `toggle`.
  const { unfold } = tree
  useEffect(() => {
    for (const folder of folderTrail(value)) if (folder !== FOLDER_ROOT) unfold(folder)
  }, [value, unfold])

  // Folders only, and a document is not one even when it IS one on disk: an image writes itself
  // as `TOTO.img/`, which the tree shows as a folder and which nothing may be filed inside. The
  // root is the studio's own row — the tree reads the project folder's CONTENTS, never itself.
  //
  // Memoised, both of them: `Tree` flattens its nodes and measures its rows off these two, so a
  // fresh array and a fresh Set on every keystroke of the dialog above would redo that work for
  // a field nobody touched.
  const nodes: readonly FolderNode[] = useMemo(
    () => [
      { id: TREE_ROOT, parentId: null, path: FOLDER_ROOT, name: rootName, kind: 'folder' },
      ...tree.nodes
        .filter(node => node.kind === 'folder' && !isDocumentFolder(node.path))
        .map(node => ({ ...node, parentId: node.parentId ?? TREE_ROOT })),
    ],
    [tree.nodes, rootName],
  )

  // The project's own row stays open: it is the head of the tree, and folding it would leave a
  // field whose only row is the one already written on the line.
  const expandedIds = useMemo(() => new Set([TREE_ROOT, ...tree.expandedIds]), [tree.expandedIds])

  return (
    <div {...flyout.wrapProps}>
      <button
        type="button"
        id={id}
        {...flyout.triggerProps}
        {...activation(flyout.open)}
        {...HINT_BOTTOM(labels.hint)}
        className={cn(FIELD, 'flex w-full items-center gap-2 text-left')}
      >
        <UiIcon path={mdiFolderOutline} size={14} />
        <span className="min-w-0 flex-1 truncate">
          {folderTrail(value)
            .map(folder => (folder === FOLDER_ROOT ? rootName : nameOf(folder)))
            .join(' / ')}
        </span>
        <UiIcon path={mdiChevronDown} size={14} />
      </button>

      {flyout.showing && (
        <Flyout
          anchor={flyout.anchor}
          // A field's menu: under the line, on its left edge and at its width, the way a
          // `<select>` opens. `below` aligns RIGHT edges, which hung the tree off-centre.
          placement="under"
          {...flyout.flyoutProps}
        >
          {/* No scroller of its own: `Flyout` already bounds its height and scrolls, and a second
              one inside it puts two bars on one list. */}
          <Tree
            nodes={nodes}
            label={labels.tree}
            selectedIds={[idOf(value)]}
            expandedIds={expandedIds}
            // A folder nobody has opened cannot say whether it holds any, and a row with no
            // chevron is a row nobody can ask to be read.
            expandable={() => true}
            onToggle={row => {
              if (row !== TREE_ROOT) tree.toggle(row)
            }}
            onSelect={ids => {
              const picked = ids.at(-1)
              if (picked !== undefined) onChange(folderOf(picked))
            }}
            renderRow={row => <span className="truncate">{row.node.name}</span>}
          />

          <FolderFieldCreate
            folder={value}
            labels={labels}
            onCreated={folder => {
              onChange(folder)
              flyout.close()
            }}
            onReread={tree.reload}
          />
        </Flyout>
      )}
    </div>
  )
}
