import { mdiFileOutline, mdiFolderOpenOutline, mdiFolderOutline } from '@mdi/js'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { kindForExtension, type DocumentDescriptor } from '@shared/domain/document'
import { EmptyState } from '@/design/EmptyState'
import { Tree } from '@/design/Tree'
import { openDocument } from '@/app/dockview-api'
import { workspaceById } from '@/helpers/workspaces'
import { getBridge } from '@/services/bridge'
import { useDocuments } from '@/stores/documents'
import { useProject } from '@/stores/project'
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
 * third-party application, and it is why the channel lives in the main process.
 */
export function Explorer() {
  const { t } = useTranslation()
  const projectPath = useProject(state => state.project?.path ?? null)
  const stored = useDocuments(state => state.stored)
  const open = useDocuments(state => state.documents)
  const { nodes, expandedIds, toggle } = useFolderTree()
  const [selectedIds, setSelectedIds] = useState<readonly string[]>([])

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

  const activate = (node: FolderNode): void => {
    if (node.kind === 'folder') return toggle(node.id)

    const document = documentOf(node)
    if (document) return openDocument(document)

    // Handed to the system, and the journal is what says so when it refuses: a folder the user
    // owns can hold anything, and the studio has no business throwing about a `.pdf`.
    void getBridge()?.project.openFile(node.path)
  }

  if (!projectPath)
    return (
      <EmptyState
        icon={mdiFolderOpenOutline}
        message={t('explorer.noProject')}
        action={{
          label: t('project.open'),
          onClick: () => void useProject.getState().openPicked(),
        }}
        secondary={{
          label: t('project.create'),
          onClick: () => void useProject.getState().createPicked(),
        }}
      />
    )

  if (nodes.length === 0)
    return <EmptyState icon={mdiFolderOpenOutline} message={t('explorer.empty')} />

  return (
    <Tree
      nodes={nodes}
      selectedIds={selectedIds}
      expandedIds={expandedIds}
      onSelect={setSelectedIds}
      onToggle={toggle}
      // A folder is expandable before anything under it has been read: what the tree can see is
      // only what is loaded, and a folder nobody has opened has nothing loaded by definition.
      expandable={node => node.kind === 'folder'}
      onActivate={activate}
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
            open={document !== null && open[document.id] !== undefined}
          />
        )
      }}
    />
  )
}
