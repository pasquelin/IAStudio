import { mdiFileOutline, mdiFolderOpenOutline, mdiFolderOutline } from '@mdi/js'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { kindForExtension, type DocumentDescriptor } from '@shared/domain/document'
import { canMoveInto, isStudioFolder } from '@shared/domain/folder'
import { EmptyState } from '@/design/EmptyState'
import { Tree } from '@/design/Tree'
import { openDocument } from '@/app/dockview-api'
import { workspaceById } from '@/helpers/workspaces'
import { getBridge } from '@/services/bridge'
import { useDocuments } from '@/stores/documents'
import { useProject } from '@/stores/project'
import { NoProject } from '@/panels/shared/NoProject'
import { EntryMenu } from './EntryMenu'
import { EntryRow } from './EntryRow'
import { useFolderTree, type FolderNode } from './use-folder-tree'

/** What a file's name says it is, or nothing — `boulder.png` has no dot-less extension either. */
function extensionOf(name: string): string {
  const cut = name.lastIndexOf('.')
  return cut <= 0 ? '' : name.slice(cut)
}

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
  const [menu, setMenu] = useState<{ node: FolderNode; at: { x: number; y: number } } | null>(null)
  const [renaming, setRenaming] = useState<string | null>(null)

  // Opening a project already lists its documents; this is for what has been written since.
  // `relist` and not `refresh`: settling which tabs are open is the project's business.
  useEffect(() => {
    void useDocuments.getState().relist()
  }, [projectPath])

  // Keyed by the file name the folder shows, which is what a directory entry carries — the
  // descriptor knows its id and kind, and `documentPath` builds the same name from them.
  const documentsByFile = useMemo(() => {
    const found = new Map<string, DocumentDescriptor>()
    for (const document of stored) found.set(document.id, document)
    return found
  }, [stored])

  const documentOf = useCallback(
    (node: FolderNode): DocumentDescriptor | null => {
      if (node.kind === 'folder') return null
      const extension = extensionOf(node.name)
      if (!kindForExtension(extension)) return null
      return documentsByFile.get(node.name.slice(0, -extension.length)) ?? null
    },
    [documentsByFile],
  )

  const activate = async (node: FolderNode): Promise<void> => {
    if (node.kind === 'folder') return toggle(node.id)

    const document = documentOf(node)
    if (document) return openDocument(document)

    // A file the catalogue knows is an asset, and it opens like one from the shelf — the folder
    // shows `asset_2604…png` where the shelf shows the name, so only the catalogue can tell.
    //
    // Caught rather than awaited bare: a project being switched has no catalogue to answer, and
    // a rejection here would take the system fallback below with it — a row that does nothing at
    // all, which is strictly worse than the viewer it used to open.
    const found = await getBridge()
      ?.assets.search({ path: node.path, limit: 1 })
      .catch(() => [])

    const asset = found?.[0]
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

  // The name the disk shows is what is renamed, so the answer settles when the folder is read
  // again — the watch does that on its own, and this only closes the field.
  const commitRename = (node: FolderNode, name: string): void => {
    setRenaming(null)
    if (name !== node.name) void getBridge()?.project.renameFile(node.path, name)
  }

  if (nodes.length === 0)
    return <EmptyState icon={mdiFolderOpenOutline} message={t('explorer.empty')} />

  const tree = (
    <Tree
      nodes={nodes}
      selectedIds={selectedIds}
      expandedIds={expandedIds}
      onSelect={setSelectedIds}
      onToggle={toggle}
      // A folder is expandable before anything under it has been read: what the tree can see is
      // only what is loaded, and a folder nobody has opened has nothing loaded by definition.
      expandable={node => node.kind === 'folder'}
      // Dragging moves; the menu's "Rename" stays in the folder it is already in, deliberately.
      // Both refusals are the same one, read from `shared/` so the main process refuses the
      // same things — and read on BOTH sides of the gesture, what moves and what receives.
      draggable={node => !isStudioFolder(node.path)}
      droppable={(node, dragged) => node.kind === 'folder' && canMoveInto(dragged.path, node.path)}
      // Nothing is written here on faith: the watch says the folder changed and the tree reads
      // it again, so what appears in the new folder is what the disk actually holds.
      onDrop={(path, folder) => void getBridge()?.project.moveFile(path, folder)}
      onActivate={node => void activate(node)}
      onContextMenu={(node, at) => setMenu({ node, at })}
      renderRow={row => {
        const document = documentOf(row.node)
        const icon =
          row.node.kind === 'folder'
            ? row.expanded
              ? mdiFolderOpenOutline
              : mdiFolderOutline
            : // The descriptor carries its own workspace, so the glyph comes off the same table
              // the rail and the asset menu read — never derived from the kind a second time,
              // which would be a second answer free to disagree with the first.
              document
              ? workspaceById(document.workspace).icon
              : mdiFileOutline

        return (
          <EntryRow
            name={row.node.name}
            icon={icon}
            open={isOpen(document)}
            {...(renaming === row.node.id
              ? { onRename: (name: string) => commitRename(row.node, name) }
              : {})}
          />
        )
      }}
    />
  )

  return (
    <>
      {tree}
      {menu && (
        <EntryMenu
          node={menu.node}
          at={menu.at}
          openInTab={isOpen(documentOf(menu.node))}
          onRename={() => setRenaming(menu.node.id)}
          onClose={() => setMenu(null)}
        />
      )}
    </>
  )
}
