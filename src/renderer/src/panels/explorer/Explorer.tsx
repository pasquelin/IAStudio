import { mdiFileOutline, mdiFolderOpenOutline, mdiFolderOutline } from '@mdi/js'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Asset } from '@shared/domain/asset'
import { FOLDER_KINDS, kindForExtension, type DocumentDescriptor } from '@shared/domain/document'
import { extensionOf, stemOf } from '@shared/domain/file-name'
import { canMoveInto, isStudioFolder } from '@shared/domain/folder'
import { EmptyState } from '@/design/EmptyState'
import { Tree } from '@/design/Tree'
import { openDocument } from '@/app/dockview-api'
import { assetAt } from '@/helpers/asset-at'
import { renameAsset, renameDocument } from '@/helpers/rename'
import { startSceneDrag } from '@/helpers/scene-drag'
import { workspaceById } from '@/helpers/workspaces'
import { getBridge } from '@/services/bridge'
import { useDocuments } from '@/stores/documents'
import { useProject } from '@/stores/project'
import { NoProject } from '@/panels/shared/NoProject'
import { openEntryMenu } from './EntryMenu'
import { EntryRow } from './EntryRow'
import { useFolderTree, type FolderNode } from './use-folder-tree'

/**
 * The project folder, as a tree.
 *
 * It shows the folder the user owns — `assets/`, `documents/`, and whatever they dropped in
 * there themselves — rather than the list of documents the studio knows how to open. That
 * difference is the whole point: a panel called Explorer that lists six documents flat is a list
 * of recent documents wearing a file browser's name.
 *
 * What it keeps from that list, and must never lose: a document closed while no layout held it
 * is unreachable by the tabs, and this is where it is found again. It is in `documents/`, one
 * fold down, and it opens on a double-click like everything else here.
 *
 * A file the studio cannot open goes to the system. That is the one place the studio launches a
 * third-party application, and it is why the channel lives in the main process — but « cannot
 * open » is asked of the catalogue too, not of the extension alone: a `.png` under `assets/` is
 * an asset this studio edits, and handing it to a picture viewer was the whole complaint.
 */
export function Explorer() {
  const { t } = useTranslation()
  const projectPath = useProject(state => state.project?.path ?? null)
  const stored = useDocuments(state => state.stored)
  const open = useDocuments(state => state.documents)
  const { nodes, expandedIds, toggle } = useFolderTree()
  const [selectedIds, setSelectedIds] = useState<readonly string[]>([])
  /**
   * The row being renamed, and WHAT it turned out to be — the catalogue was asked when the menu
   * opened, and that answer is what decided the menu row was offered at all. Kept rather than
   * asked again on commit: two answers to one question are free to disagree.
   */
  const [renaming, setRenaming] = useState<{ nodeId: string; asset: Asset | null } | null>(null)

  // Opening a project already lists its documents; this is for what has been written since.
  // `relist` and not `refresh`: settling which tabs are open is the project's business.
  useEffect(() => {
    void useDocuments.getState().relist()
  }, [projectPath])

  // Keyed by the file name the folder shows, which is what a directory entry carries — and it
  // is the descriptor's own `fileName`, read off the disk. It used to be the id, which worked
  // only for as long as the id WAS the file name: the day the two parted, this answered null
  // for every document at once — no space glyph, no "open" mark, and a double-click handing the
  // document to whatever application the system opens a `.scene` with.
  const documentsByFile = useMemo(() => {
    const found = new Map<string, DocumentDescriptor>()
    for (const document of stored) found.set(document.fileName, document)
    return found
  }, [stored])

  /**
   * The descriptor behind a folder entry, or nothing.
   *
   * A folder is not disqualified by being one: an image document IS a directory — `<id>.img/`
   * holding its manifest and its parts (`FOLDER_KINDS`) — and the reader that walks the project
   * folder can only see that it is a directory. Refusing every folder here left image documents
   * with no workspace glyph, no "open" mark, and unfoldable instead of openable.
   */
  const documentOf = useCallback(
    (node: FolderNode): DocumentDescriptor | null => {
      const kind = kindForExtension(extensionOf(node.name))
      if (!kind) return null
      if (node.kind === 'folder' && !FOLDER_KINDS.has(kind)) return null
      return documentsByFile.get(node.name) ?? null
    },
    [documentsByFile],
  )

  const activate = async (node: FolderNode): Promise<void> => {
    // Asked before the folder question, not after: an image document is a directory, and folding
    // it open showed the user the parts the studio writes for itself instead of opening it.
    const document = documentOf(node)
    if (document) return openDocument(document)

    if (node.kind === 'folder') return toggle(node.id)

    // A file the catalogue knows is an asset, and it opens like one from the shelf — a folder
    // holds paths, and only the catalogue can say whether one of them is an asset.
    const asset = await assetAt(node.path)
    if (asset) {
      const { openAsset } = await import('@/helpers/open-asset')
      return openAsset(asset)
    }

    // Handed to the system, and the journal is what says so when it refuses: a folder the user
    // owns can hold anything, and the studio has no business throwing about a `.pdf`.
    void getBridge()?.project.openFile(node.path)
  }

  if (!projectPath)
    return <NoProject icon={mdiFolderOpenOutline} message={t('explorer.noProject')} />

  const isOpen = (document: DocumentDescriptor | null): boolean =>
    document !== null && open[document.id] !== undefined

  /**
   * Three names for three things, and the row cannot tell them apart by looking.
   *
   * A document is renamed through its own channel, which moves the file AND rewrites its
   * envelope. An asset through the catalogue's, which moves the file AND rewrites its row —
   * both refused as plain files by the main process, `isStudioOwned`, because renaming either
   * behind the studio's back leaves it pointing at a path that is gone. Everything else the
   * user put in the folder is a plain file and is renamed as one.
   *
   * WHICH of the three this row is was settled when the menu opened — the catalogue was asked
   * then, and the answer is what decided whether the gesture was offered at all. Asking again
   * here would be a second answer free to disagree with the one the user was shown.
   *
   * The asset takes a stem: what this panel draws is a file name, extension included, and that
   * suffix belongs to the bytes rather than to the name. Everything else keeps what was typed,
   * suffix and all — a `.txt` the user renames to `.md` is their business.
   *
   * Nothing is written on faith. A file's new name settles when the watch reads the folder
   * again; a document's comes back from the rename itself, which is what puts it in the tab
   * that may be showing it.
   */
  const commitRename = (node: FolderNode, asset: Asset | null, name: string): void => {
    setRenaming(null)
    const document = documentOf(node)

    if (document) return renameDocument(document.id, document.title, name)
    if (name === node.name) return
    if (asset) return renameAsset(asset.id, asset.name, stemOf(name))

    void getBridge()?.project.renameFile(node.path, name)
  }

  if (nodes.length === 0)
    return <EmptyState icon={mdiFolderOpenOutline} message={t('explorer.empty')} />

  const tree = (
    <Tree
      nodes={nodes}
      label={t('panels.explorer')}
      selectedIds={selectedIds}
      expandedIds={expandedIds}
      onSelect={setSelectedIds}
      onToggle={toggle}
      // A folder is expandable before anything under it has been read: what the tree can see is
      // only what is loaded, and a folder nobody has opened has nothing loaded by definition.
      // Except a document that happens to be one — it opens, and what it holds is the studio's
      // own business rather than something to browse.
      expandable={node => node.kind === 'folder' && !documentOf(node)}
      // Dragging moves; the menu's "Rename" stays in the folder it is already in, deliberately.
      // Both refusals are the same one, read from `shared/` so the main process refuses the
      // same things — and read on BOTH sides of the gesture, what moves and what receives.
      draggable={node => !isStudioFolder(node.path)}
      // A scene row is dragged for two different reasons, and both are legitimate: into another
      // folder, or onto a montage. The tree's own channel carries the first, this one the
      // second, and each target reads only the type it knows.
      onDragStart={(node, event) => {
        const document = documentOf(node)
        if (document?.kind === 'scene') startSceneDrag(event, document.id)
      }}
      droppable={(node, dragged) => node.kind === 'folder' && canMoveInto(dragged.path, node.path)}
      // Nothing is written here on faith: the watch says the folder changed and the tree reads
      // it again, so what appears in the new folder is what the disk actually holds.
      onDrop={(path, folder) => void getBridge()?.project.moveFile(path, folder)}
      onActivate={node => void activate(node)}
      // Asked BEFORE the menu is drawn, and that round trip is the point: only the catalogue
      // knows whether a file under `assets/` is an asset, and the answer decides whether
      // « Renommer » is offered or greyed. Offering it for a file nobody catalogued opens a
      // field on a gesture that has no channel — the worst of the three outcomes.
      onContextMenu={node =>
        void assetAt(node.path).then(asset =>
          openEntryMenu({
            node,
            document: documentOf(node),
            asset,
            t,
            onRename: () => setRenaming({ nodeId: node.id, asset }),
          }),
        )
      }
      renderRow={row => {
        const document = documentOf(row.node)
        // The descriptor carries its own workspace, so the glyph comes off the same table the
        // rail and the asset menu read — never derived from the kind a second time, which would
        // be a second answer free to disagree with the first. Asked before the folder question
        // for the reason `activate` is: an image document is a directory, and the folder glyph
        // said so where every other document showed its space.
        const icon = document
          ? workspaceById(document.workspace).icon
          : row.node.kind === 'folder'
            ? row.expanded
              ? mdiFolderOpenOutline
              : mdiFolderOutline
            : mdiFileOutline

        return (
          <EntryRow
            // The document's name where there is one — which is its file name for anything
            // written since documents came to be named, and its title for the older ones whose
            // file still wears a uuid.
            name={document?.title ?? row.node.name}
            icon={icon}
            open={isOpen(document)}
            {...(renaming?.nodeId === row.node.id
              ? { onRename: (name: string) => commitRename(row.node, renaming.asset, name) }
              : {})}
          />
        )
      }}
    />
  )

  return tree
}
