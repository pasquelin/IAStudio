import {
  mdiFileOutline,
  mdiFolderOpenOutline,
  mdiFolderOutline,
  mdiMagnify,
  mdiShapeOutline,
} from '@mdi/js'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Asset } from '@shared/domain/asset'
import type { CommandId } from '@shared/domain/command'
import { FOLDER_KINDS, kindForExtension, type DocumentDescriptor } from '@shared/domain/document'
import { extensionOf, stemOf } from '@shared/domain/file-name'
import { touchesDocuments, type FileHistory, type FileOutcome } from '@shared/domain/file-op'
import { canMoveInto, FOLDER_ROOT, isPrivatePath, parentOf } from '@shared/domain/folder'
import { CollectionBar } from '@/design/CollectionBar'
import { EmptyState } from '@/design/EmptyState'
import { Tree } from '@/design/Tree'
import { openDocument } from '@/app/dockview-api'
import { assetAt } from '@/helpers/asset-at'
import { renameAsset, renameDocument } from '@/helpers/rename'
import { startSceneDrag } from '@/helpers/scene-drag'
import { applySelection } from '@/helpers/selection'
import { workspaceById } from '@/helpers/workspaces'
import { useShortcuts } from '@/hooks/useShortcuts'
import { getBridge } from '@/services/bridge'
import { currentOverrides } from '@/stores/bindings'
import { useDocuments } from '@/stores/documents'
import { fileClipboardCut, useFileClipboard } from '@/stores/file-clipboard'
import { explorerSearch, useExplorerView } from '@/stores/explorer-view'
import { useProject } from '@/stores/project'
import { selectedFilePaths, useSelection } from '@/stores/selection'
import { NoProject } from '@/panels/shared/NoProject'
import { isDomainHeading, type ExplorerNode } from './domain-nodes'
import { entriesSorted, FOLDER_SORTS } from './folder-sort'
import { openEntryMenu } from './EntryMenu'
import { DomainRow } from './DomainRow'
import { EntryRow } from './EntryRow'
import { useDomainTree } from './use-domain-tree'
import { useFolderSearch } from './use-folder-search'
import { useFolderTree, type FolderNode } from './use-folder-tree'

/** Nothing held, nothing to take back — the state the panel starts in and falls back to. */
const NO_HISTORY: FileHistory = { undo: false, redo: false }

/**
 * The project folder, as a tree.
 *
 * It shows the folder the user owns — `assets/`, `documents/`, and whatever they dropped in
 * there themselves — rather than the list of documents the studio knows how to open. That
 * difference is the whole point: a panel called Explorer that lists six documents flat is a list
 * of recent documents wearing a file browser's name.
 *
 * What it keeps from that list, and must never lose: a document closed while no layout held it
 * is unreachable by the tabs, and this is where it is found again.
 *
 * **Every gesture that writes goes through one channel per gesture and one orchestrator behind
 * them**, which is what let this panel grow from three rows to twelve: the main process decides
 * what may be written, against a reading of the folders taken before anything moves, and answers
 * what it actually did. The panel shows the result; it settles nothing.
 *
 * A file the studio cannot open goes to the system. That is the one place the studio launches a
 * third-party application, and it is why the channel lives in the main process — but « cannot
 * open » is asked of the catalogue too, not of the extension alone: a `.png` under `assets/` is
 * an asset this studio edits, and handing it to a picture viewer was the whole complaint.
 */
export function Explorer() {
  const { t, i18n } = useTranslation()
  const language = i18n.language
  const projectPath = useProject(state => state.project?.path ?? null)
  const stored = useDocuments(state => state.stored)
  const open = useDocuments(state => state.documents)
  const collection = useExplorerView(state => state.collection)
  const setCollection = useExplorerView(state => state.setExplorerCollection)
  const hidden = useExplorerView(state => state.hidden)
  const term = useExplorerView(explorerSearch)
  // `reading` rather than `mode`: the tree's own `onSelect` carries a `mode` of its own — which
  // of shift and ⌘ the click held — and two `mode`s in one component is one too many.
  const reading = useExplorerView(state => state.mode)
  const tree = useFolderTree(hidden)
  const search = useFolderSearch(term, hidden)
  /**
   * Which of the three sources is drawing: the folders unfolded, the word being searched, or the
   * whole project read by what its files ARE. A search speaks over either reading — a word is a
   * question about the project, not about the way it is being shown.
   */
  const searching = term !== ''
  const inDomain = !searching && reading === 'domain'
  const domains = useDomainTree(hidden, inDomain, collection.sort, language)
  // One derivation for all four answers — the rows, the folds, and what a batch reloads. Two of
  // them settled apart could disagree about which source is drawing, and nothing would say so.
  const { nodes, expandedIds, toggle, reload } = useMemo((): {
    nodes: readonly ExplorerNode[]
    expandedIds: ReadonlySet<string>
    toggle: (id: string) => void
    reload: () => void
  } => {
    if (inDomain) return domains
    const source = searching ? search : tree
    return { ...source, nodes: entriesSorted(source.nodes, collection.sort, language) }
  }, [inDomain, searching, domains, search, tree, collection.sort, language])
  const selectedIds = useSelection(selectedFilePaths)
  const clipboard = useFileClipboard(state => state.paths)
  const cut = useFileClipboard(fileClipboardCut)
  /** The name a folder is born with, before the field opens on it. */
  const folderName = t('explorer.newFolderName')
  const sorts = useMemo(
    () => FOLDER_SORTS.map(value => ({ value, label: t(`explorer.sort.${value}`) })),
    [t],
  )
  /** Armed only while the focus is inside the panel: ⌘Z in the canvas must not reach the disk. */
  const [focused, setFocused] = useState(false)
  const [history, setHistory] = useState<FileHistory>(NO_HISTORY)
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

  // Keyed by the PATH the descriptor was read from, which is the tree's own id for a row. It
  // used to be the id, which worked only for as long as the id WAS the file name; then the file
  // name, which worked only for as long as every document sat in one folder — two `Niveau.scene`
  // in two folders handed one document's descriptor to the other one's row.
  const documentsByFile = useMemo(() => {
    const found = new Map<string, DocumentDescriptor>()
    for (const document of stored) found.set(document.path, document)
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
      return documentsByFile.get(node.path) ?? null
    },
    [documentsByFile],
  )

  const nodeById = useMemo(() => new Map(nodes.map(node => [node.id, node])), [nodes])

  /**
   * The folders something in the list sits in. Only a search asks: there, the tree already holds
   * every node it will ever hold, so a folder with no match under it must not draw a chevron
   * that opens onto nothing.
   */
  const withChildren = useMemo(() => {
    const parents = new Set<string>()
    for (const node of nodes) if (node.parentId !== null) parents.add(node.parentId)
    return parents
  }, [nodes])

  // A set rather than the array: this is asked once per VISIBLE ROW, on every render the tree
  // does — and a drag re-renders it on each hover tick.
  const waiting = useMemo(() => new Set(cut), [cut])

  /**
   * Where a new folder or a paste lands: the picked row when it is a folder, its own folder when
   * it is a file, and the project folder itself when nothing is picked.
   *
   * The LAST picked row, which is the anchor — what the hand touched most recently, and what
   * every other surface of this studio reads a selection by.
   */
  const target = useMemo((): string => {
    const anchor = selectedIds.at(-1)
    const node = anchor === undefined ? undefined : nodeById.get(anchor)
    // A heading is not a place: a domain names files, and nothing can be written into a name.
    if (!node || isDomainHeading(node)) return FOLDER_ROOT
    return node.kind === 'folder' ? node.path : (parentOf(node.path) ?? FOLDER_ROOT)
  }, [selectedIds, nodeById])

  // Answers the history rather than writing it, so the two callers below own their own
  // `setState` — an effect that calls one is an effect the linter reads as cascading.
  const readHistory = useCallback(
    async (): Promise<FileHistory> => (await getBridge()?.project.fileHistory()) ?? NO_HISTORY,
    [],
  )

  /**
   * What a batch did, wherever it was asked for.
   *
   * Three things follow from one: the tree reads its folders again, the documents are listed
   * again when the batch touched one — the panel that lists them walks the disk, so it learns
   * nothing until it is told — and the undo rows learn whether there is anything left to undo.
   */
  const settled = useCallback(
    (outcome: FileOutcome): void => {
      reload()
      void readHistory().then(setHistory)
      if (touchesDocuments(outcome.done)) void useDocuments.getState().relist()
    },
    [reload, readHistory],
  )

  useEffect(() => {
    const stop = getBridge()?.project.onFilesChanged(settled)
    return () => stop?.()
  }, [settled])

  // The stack belongs to the project: opening another one leaves nothing to take back, and a
  // clipboard holding paths of the folder just closed means nothing in the new one.
  useEffect(() => {
    void readHistory().then(setHistory)
    useFileClipboard.getState().clear()
  }, [projectPath, readHistory])

  const pick = (ids: readonly string[]): void => {
    useSelection.getState().selectFiles(ids)
  }

  /**
   * Runs one of the eight, and shows what it did.
   *
   * Every one of them acts on the SELECTION rather than on a row, which is what the scope buys:
   * the same eight are reached from the menu, from the keyboard, and — for the two the stack
   * owns — from another window having done something.
   */
  const run = useCallback(
    (command: CommandId): void => {
      const bridge = getBridge()?.project
      if (!bridge) return

      const chosen = useSelection.getState().selection
      const paths = chosen.kind === 'file' ? chosen.ids : []
      const held = useFileClipboard.getState()
      const answer = (outcome: Promise<FileOutcome>): void => void outcome.then(settled)

      if (command === 'explorer.cut' || command === 'explorer.copy') {
        // Nothing crosses the boundary yet: what is held is a selection of the project folder,
        // and it means something only once a folder is named to put it in.
        if (paths.length > 0) held.hold(paths, command === 'explorer.cut')
        return
      }
      if (command === 'explorer.paste') {
        if (held.paths.length === 0) return
        answer(bridge.pasteFiles(held.paths, target, held.cut))
        // A cut is spent by the paste that carried it out; a copy stays, so pasting into three
        // folders in a row is three copies rather than one and two silences.
        if (held.cut) held.clear()
        return
      }
      if (command === 'explorer.newFolder') {
        return void bridge.newFolder(target, folderName).then(outcome => {
          settled(outcome)
          // The field opens on the folder that was just made, so the name it is born with is a
          // placeholder rather than something to go and correct. Set before the row exists: the
          // tree is reading its folders again, and the row draws the field when it arrives.
          const created = outcome.done[0]?.to
          if (created) setRenaming({ nodeId: created, asset: null })
        })
      }
      // The stack takes neither a selection nor a clipboard: it acts on what the main process
      // remembers, which is also what lets a batch made in another window be taken back here.
      if (command === 'explorer.undo') return answer(bridge.undoFile())
      if (command === 'explorer.redo') return answer(bridge.redoFile())

      if (paths.length === 0) return

      if (command === 'explorer.duplicate') return answer(bridge.duplicateFiles(paths))
      if (command === 'explorer.trash') return answer(bridge.trashFiles(paths))
    },
    [settled, target, folderName],
  )

  useShortcuts({ scope: 'explorer', enabled: focused, onCommand: run })

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
   * renaming either as a plain file would leave the row and the envelope pointing at a path that
   * is gone. Everything else the user put in the folder is a plain file and is renamed as one.
   *
   * WHICH of the three this row is was settled when the menu opened — the catalogue was asked
   * then, and the answer is what decided whether the gesture was offered at all.
   *
   * The asset takes a stem: what this panel draws is a file name, extension included, and that
   * suffix belongs to the bytes rather than to the name. Everything else keeps what was typed,
   * suffix and all — a `.txt` the user renames to `.md` is their business.
   */
  const commitRename = (node: FolderNode, asset: Asset | null, name: string): void => {
    setRenaming(null)
    const document = documentOf(node)

    if (document) return renameDocument(document.id, document.title, name)
    if (name === node.name) return
    if (asset) return renameAsset(asset.id, asset.name, stemOf(name))

    void getBridge()?.project.renameFile(node.path, name).then(settled)
  }

  // Four different silences, and telling them apart is the whole of it: a folder that would not
  // be read, a walk still running, a project holding no file at all, and a word nothing answers
  // to. One message for all four is a panel that says « empty » where it means « wait ».
  //
  // Drawn INSIDE the panel rather than in its place, which is what the wrapper below is for: a
  // search that matches nothing would otherwise take the field it was typed in off the screen,
  // and leave no way back to the folder.
  const emptyState = searching ? (
    <EmptyState
      icon={mdiMagnify}
      message={search.answered ? t('explorer.noMatch') : t('collection.loading')}
    />
  ) : inDomain ? (
    <EmptyState
      icon={mdiShapeOutline}
      message={domains.loaded ? t('explorer.noFiles') : t('collection.loading')}
    />
  ) : (
    <EmptyState icon={mdiFolderOpenOutline} message={t('explorer.empty')} />
  )

  return (
    // Focus rather than a click: the scope has to answer the keyboard, and a panel reached by
    // Tab has had no click. `onFocus` and `onBlur` bubble in React where the DOM's do not.
    <div
      className="flex h-full min-h-0 flex-col"
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    >
      {/* Under the title row and not on it: this panel stands in a column, where the row already
          carries the name, the three readings and the way out — the field measured 76 px there.
          `display` is off for the reason a tree has no grid and no thumbnail to size. */}
      <CollectionBar state={collection} onChange={setCollection} sorts={sorts} display={false} />

      <div className="min-h-0 flex-1">
        {nodes.length === 0 ? (
          emptyState
        ) : (
          <Tree
            nodes={nodes}
            label={t('panels.explorer')}
            selectedIds={selectedIds}
            expandedIds={expandedIds}
            // The `mode` was dropped here, and every ⌘-click replaced the selection instead of
            // adding to it: `pickFrom` resolves what the click ASKED for against the rows on screen,
            // and composing it with what is already held is the caller's half of the gesture.
            onSelect={(ids, mode) => pick(applySelection(selectedIds, ids, mode))}
            onToggle={toggle}
            // A heading names files rather than holding them: it is not a thing to pick, and a
            // selection that gathered one would hand the disk a domain where it expects a path.
            selectable={node => !isDomainHeading(node)}
            // A folder is expandable before anything under it has been read: what the tree can see is
            // only what is loaded, and a folder nobody has opened has nothing loaded by definition.
            // Except a document that happens to be one — it opens, and what it holds is the studio's
            // own business rather than something to browse. A heading always holds something: an
            // empty domain is left out rather than drawn.
            expandable={node =>
              isDomainHeading(node) ||
              (node.kind === 'folder' &&
                !documentOf(node) &&
                (!searching || withChildren.has(node.id)))
            }
            // Read from `shared/` so the main process refuses the same things — and read on BOTH
            // sides of the gesture, what moves and what receives. A domain view offers no drag at
            // all: there is no folder on screen to carry a file INTO, and a heading is not a place.
            draggable={node => !isDomainHeading(node) && !isPrivatePath(node.path)}
            dragMultiple
            // A scene row is dragged for two different reasons, and both are legitimate: into another
            // folder, or onto a montage. The tree's own channel carries the first, this one the
            // second, and each target reads only the type it knows.
            onDragStart={(node, event) => {
              const document = isDomainHeading(node) ? null : documentOf(node)
              if (document?.kind === 'scene') startSceneDrag(event, document.id)
            }}
            // Asked of the WHOLE batch while the pointer is over the row: three files carried into a
            // folder that one of them holds must refuse the outline, not the drop.
            droppable={(node, dragged) =>
              !isDomainHeading(node) &&
              node.kind === 'folder' &&
              dragged.every(one => !isDomainHeading(one) && canMoveInto(one.path, node.path))
            }
            // Nothing is written here on faith: the answer says what actually moved, and the tree
            // reads the folders again from that.
            onDrop={(paths, folder) =>
              void getBridge()?.project.moveFiles(paths, folder).then(settled)
            }
            // The blank below the rows is the project folder itself — how a file comes back out of a
            // folder, there being no row standing for the root to aim at.
            onDropRoot={paths =>
              void getBridge()?.project.moveFiles(paths, FOLDER_ROOT).then(settled)
            }
            onActivate={node => void (isDomainHeading(node) ? toggle(node.id) : activate(node))}
            // Asked BEFORE the menu is drawn, and that round trip is the point: only the catalogue
            // knows whether a file under `assets/` is an asset, and the answer decides whether
            // « Renommer » is offered or greyed. A heading raises none: every gesture it carries is
            // about a file, and it is not one.
            onContextMenu={node => {
              if (isDomainHeading(node)) return

              void assetAt(node.path).then(asset =>
                openEntryMenu({
                  node,
                  // Read at the click rather than from the render's copy: `Tree` arms the menu on
                  // the row it was raised on, and that write has not reached this closure yet.
                  selection: selectedFilePaths(useSelection.getState()),
                  document: documentOf(node),
                  asset,
                  folder: node.kind === 'folder' ? node.path : (parentOf(node.path) ?? FOLDER_ROOT),
                  clipboard: clipboard.length,
                  history,
                  bindings: currentOverrides(),
                  t,
                  onOpen: () => void activate(node),
                  onRename: () => setRenaming({ nodeId: node.id, asset }),
                  run,
                }),
              )
            }}
            renderRow={row => {
              // The domain itself, and what it holds. Not an `EntryRow`: it opens nothing, it is
              // renamed by nobody, and the count is the one thing a reader comes to this view for.
              if (isDomainHeading(row.node))
                return <DomainRow domain={row.node.domain} count={row.node.count} />

              // Bound rather than read through `row` below: the narrowing above does not survive
              // into the rename closure, and this is what carries it there.
              const node = row.node
              const document = documentOf(node)
              // The descriptor carries its own workspace, so the glyph comes off the same table the
              // rail and the asset menu read — never derived from the kind a second time, which would
              // be a second answer free to disagree with the first. Asked before the folder question
              // for the reason `activate` is: an image document is a directory, and the folder glyph
              // said so where every other document showed its space.
              const icon = document
                ? workspaceById(document.workspace).icon
                : node.kind === 'folder'
                  ? row.expanded
                    ? mdiFolderOpenOutline
                    : mdiFolderOutline
                  : mdiFileOutline

              return (
                <EntryRow
                  // The document's name where there is one — which is its file name for anything
                  // written since documents came to be named, and its title for the older ones whose
                  // file still wears a uuid.
                  name={document?.title ?? node.name}
                  icon={icon}
                  open={isOpen(document)}
                  // What a cut looks like before it is pasted: the rows are still there, still
                  // openable, and on their way out.
                  waiting={waiting.has(node.path)}
                  {...(renaming?.nodeId === node.id
                    ? { onRename: (name: string) => commitRename(node, renaming.asset, name) }
                    : {})}
                />
              )
            }}
          />
        )}
      </div>
    </div>
  )
}
