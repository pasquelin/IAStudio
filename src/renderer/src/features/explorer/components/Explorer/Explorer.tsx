import {
  mdiFileOutline,
  mdiFolderOpenOutline,
  mdiFolderOutline,
  mdiMagnify,
  mdiShapeOutline,
} from '@mdi/js'
import { useCallback, useEffect, useMemo, useState, type DragEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { thumbnailUrl, type Asset } from '@shared/domain/asset'
import type { CommandId } from '@shared/domain/command'
import {
  documentExtensionOf,
  documentsByPath,
  documentStemOf,
  kindForExtension,
  type DocumentDescriptor,
} from '@shared/domain/document'
import { stemOf } from '@shared/domain/fileName'
import type { FileHistory, FileOutcome } from '@shared/domain/fileOp'
import { canMoveInto, FOLDER_ROOT, isPrivatePath, nameOf, parentOf } from '@shared/domain/folder'
import { natureOf } from '@shared/domain/fileRole'
import { FOLDER_ROLES, WORKSPACE_BY_ROLE, type FolderRole } from '@shared/domain/folderRole'
import { Collection } from '@/components/Collection/Collection'
import { CollectionBar } from '@/components/CollectionBar/CollectionBar'
import { EmptyState } from '@/components/EmptyState'
import { Tree } from '@/components/Tree'
import { openDocument } from '@/features/shell/components/dockviewApi'
import { assetAt } from '@/helpers/assetAt'
import { carriesAsset, landAssetIn } from '@/helpers/assetDrag'
import { isDomainHeading, type ExplorerNode } from '@/helpers/domainNodes'
import { entriesSorted, FOLDER_SORTS } from '@/helpers/folderSort'
import { renameAsset, renameDocument } from '@/helpers/rename'
import { startSceneDrag } from '@/helpers/sceneDrag'
import { openProjectFile } from '@/helpers/openProjectFile'
import { applySelection } from '@/helpers/selection'
import { foldTreeBranch } from '@/helpers/treeExpansion'
import {
  domainInk,
  roleIcon,
  roleInk,
  roleLabelKey,
  workspaceById,
  workspaceInk,
  workspaceLabelKey,
} from '@/helpers/workspaces'
import { useDomainTree } from '@/hooks/useDomainTree'
import { useFolderSearch } from '@/hooks/useFolderSearch'
import { useFolderTree, type FolderNode } from '@/hooks/useFolderTree'
import { useLatest } from '@/hooks/useLatest'
import { useShortcuts } from '@/hooks/useShortcuts'
import { getBridge } from '@/services/bridge'
import type { CommandAnswer } from '@/services/commandBus'
import { reportFailure } from '@/services/diagnostics'
import { currentOverrides } from '@/stores/bindings'
import { useDocuments } from '@/stores/documents'
import { useMedia } from '@/stores/media'
import { fileClipboardCut, useFileClipboard } from '@/stores/fileClipboard'
import { explorerSearch, useExplorerView } from '@/stores/explorerView'
import { useFolderRoles } from '@/stores/folderRoles'
import { useProject } from '@/stores/project'
import { useTreeFolds } from '@/stores/treeFolds'
import { selectedFilePaths, useSelection } from '@/stores/selection'
import { NoProject } from '@/features/shell/components/NoProject'
import { runAssetAction } from './assetActions'
import { runExplorerCommand, settleFileOutcome } from './explorerCommands'
import { ImportProgress } from '../ImportProgress/ImportProgress'
import { openEntryMenu, openRootMenu } from './entryMenu'
import { DomainRow } from '../DomainRow'
import { EntryCard, type EntryKind } from '../Entry/EntryCard'
import { EntryRow } from '../Entry/EntryRow'
import { FolderCrumbs } from '@/components/FolderCrumbs'
import { HINT_TOP } from '@/helpers/tooltip'
import { FolderNav } from '../FolderNav'
import {
  canWalkBy,
  FOLDER_WALK_START,
  walkedBy,
  walkedTo,
  walkInto,
  type FolderWalk,
} from './folderWalk'
import { RescanBar } from '../RescanBar'

/** Nothing held, nothing to take back — the state the panel starts in and falls back to. */
const NO_HISTORY: FileHistory = { undo: false, redo: false }

/**
 * The project folder as a tree — the folder the user owns, never the list of documents the studio
 * knows how to open. Every gesture that writes goes through the main process, which decides
 * against a reading taken before anything moves and answers what it did: the panel shows a
 * result, it settles nothing. A file the studio cannot open goes to the system, and « cannot
 * open » is asked of the CATALOGUE, not of the extension — a `.png` under `assets/` is an asset.
 */
export function Explorer() {
  const { t, i18n } = useTranslation()
  const language = i18n.language
  const projectPath = useProject(state => state.project?.path ?? null)
  const roles = useFolderRoles(state => state.roles)
  const byFolder: Map<string, FolderRole> = useMemo(
    () => new Map(FOLDER_ROLES.flatMap(role => (roles[role] ? [[roles[role], role]] : []))),
    [roles],
  )
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
  /**
   * Which folder the GRID shows, and the project it belongs to. Panel state and not the store's,
   * which is persisted and shared by every window: a path means nothing outside its own project,
   * and reopening a studio deep inside a folder nobody navigated to reads as one gone missing.
   */
  const [browsing, setBrowsing] = useState<{ project: string | null; walk: FolderWalk }>({
    project: projectPath,
    walk: FOLDER_WALK_START,
  })
  /**
   * The batch in the hand. Held because `getData` answers nothing until the drop, by design of the
   * platform, so a card asked what is passing over it has no other way to know. `Tree` does the same.
   */
  const [carried, setCarried] = useState<readonly string[] | null>(null)

  // Opening a project already lists its documents; this is for what has been written since.
  // `relist` and not `refresh`: settling which tabs are open is the project's business.
  useEffect(() => {
    void useDocuments.getState().relist()
  }, [projectPath])

  // Keyed by the PATH the descriptor was read from, which is the tree's own id for a row. It
  // used to be the id, which worked only for as long as the id WAS the file name; then the file
  // name, which worked only for as long as every document sat in one folder — two `Niveau.gltf`
  // in two folders handed one document's descriptor to the other one's row.
  const documentsByFile = useMemo(() => documentsByPath(stored), [stored])

  /**
   * The descriptor behind an entry, or nothing. Every document is a FILE now, containers
   * included, so a folder wearing a document's extension is a folder.
   */
  const documentOf = useCallback(
    (node: FolderNode): DocumentDescriptor | null => {
      if (node.kind === 'folder' || !kindForExtension(documentExtensionOf(node.name))) return null
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
   * What can be unfolded: a heading, or a folder that is no document — and under a search, only
   * one with a match beneath it. Held rather than written inline, which is what makes the stable
   * `nodes` worth having: `Tree` memoises its flattening on this very predicate.
   */
  const expandable = useCallback(
    (node: ExplorerNode): boolean =>
      isDomainHeading(node) ||
      (node.kind === 'folder' && !documentOf(node) && (!searching || withChildren.has(node.id))),
    [documentOf, searching, withChildren],
  )

  const expandableIds = useMemo(
    () => new Set(nodes.filter(expandable).map(node => node.id)),
    [nodes, expandable],
  )
  const anyExpanded = [...expandableIds].some(id => expandedIds.has(id))
  const folding = useLatest({ expandableIds, expandedIds, toggle })
  useEffect(() => useTreeFolds.getState().note('explorer', anyExpanded), [anyExpanded])
  useEffect(() => {
    let seenFoldOrder = useTreeFolds.getState().explorer.stamp
    return useTreeFolds.subscribe(state => {
      const order = state.explorer
      if (seenFoldOrder === order.stamp) return
      seenFoldOrder = order.stamp
      const current = folding.current
      if (order.wanted) {
        for (const id of current.expandableIds) if (!current.expandedIds.has(id)) current.toggle(id)
      } else {
        for (const id of current.expandedIds) current.toggle(id)
      }
    })
  }, [folding])
  const toggleBranch = useCallback(
    (id: string) => {
      const closing = expandedIds.has(id)
      if (!closing) return toggle(id)

      const kept = foldTreeBranch(nodes, expandedIds, id)
      for (const candidate of expandedIds) if (!kept.has(candidate)) toggle(candidate)
    },
    [expandedIds, nodes, toggle],
  )

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

  /**
   * Only a folder reading has somewhere to go down into: a search and a domain are flat answers
   * about the whole project, and a trail over either would name a place the rows do not come from.
   */
  const grid = collection.view === 'grid'
  const browsable = grid && !searching && !inDomain
  /**
   * The folder asked for, forgotten the moment another project is opened. Derived rather than reset
   * by an effect, which is the cascading render the linter refuses.
   */
  const walk = browsing.project === projectPath ? browsing.walk : FOLDER_WALK_START
  const asked = walkedTo(walk)
  /**
   * Changing folder UNPICKS, and that is not tidiness: every gesture of this panel acts on the
   * selection, so a file left picked in the folder one has just left is a ⌘⌫ that trashes something
   * nobody can see. The tree cannot reach this — what is picked there is on screen by construction.
   *
   * It also OPENS the folder in the tree: children are read only once a folder has been opened, so
   * a walk into one that was folded away since would land somewhere shown empty.
   */
  const goTo = (next: FolderWalk): void => {
    const folder = walkedTo(next)
    useSelection.getState().selectFiles([])
    if (folder !== FOLDER_ROOT && !expandedIds.has(folder)) toggle(folder)
    setBrowsing({ project: projectPath, walk: next })
  }

  const browse = (folder: string): void => goTo(walkInto(walk, folder))
  /**
   * Whether the folder asked for is still one this panel can show: still on the disk, and still
   * OPEN in the tree — the grid reads the same nodes, and a reload keeps only the root and what is
   * unfolded, so a folder closed in the list view leaves the grid on a folder that is about to
   * empty itself. `nodes.length === 0` holds it through the beat a reload takes.
   */
  const standing =
    asked === FOLDER_ROOT || nodes.length === 0 || (nodeById.has(asked) && expandedIds.has(asked))
  /**
   * Where the grid actually is, and the PROJECT FOLDER wherever it is not browsing one. A search
   * and a domain draw no trail, so a blank that still meant the last folder walked into would
   * aim every drop and every new folder at a place nothing on screen names.
   */
  const browsed = browsable && standing ? asked : FOLDER_ROOT
  /**
   * Where a keyboard paste or a new folder lands. The grid shows ONE folder, so that is the answer
   * there — ⌘V inside a folder wrote at the root, the selection having just been cleared by the
   * very navigation that got the user there.
   */
  const landing = browsable ? browsed : target

  /**
   * The children of the folder browsed, or — with nothing to browse — the flat answer, headings
   * dropped: a heading holds files without being a place, and a grid cannot draw the difference.
   */
  const entries = useMemo((): readonly FolderNode[] => {
    const files: FolderNode[] = []
    for (const node of nodes) {
      if (isDomainHeading(node)) continue
      if (browsable && node.parentId !== (browsed === FOLDER_ROOT ? null : browsed)) continue
      files.push(node)
    }

    return files
  }, [nodes, browsable, browsed])

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
      // Batches from another window and dropped assets never went through `runExplorerCommand`.
      settleFileOutcome(outcome)
    },
    [reload, readHistory],
  )

  useEffect(() => {
    const stop = getBridge()?.project.onFilesChanged(settled)
    return () => stop?.()
  }, [settled])

  /**
   * What the shelf may be dropped ON, and what dropping it there does — written once and read by
   * BOTH views, which is the whole of why they behave alike: same outline, same spring-loaded
   * folder, same landing.
   *
   * A folder, never a file: an asset lands IN a place, and a file is not one. A heading is not a
   * place either, and `.index/` is not the user's to write into — the main process refuses that
   * one again, this only keeps the outline from promising it.
   */
  const acceptsAsset = (node: ExplorerNode): boolean =>
    !isDomainHeading(node) && node.kind === 'folder' && !isPrivatePath(node.path)

  const landAsset = useCallback(
    (event: DragEvent<HTMLElement>, folder: string): void => {
      void landAssetIn(event, folder).then(outcome => outcome && settled(outcome))
    },
    [settled],
  )

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
    /**
     * `into` names where a paste or a new folder lands, and `landing` is what it means when
     * nobody says: the folder the grid is SHOWING, or the selection's anchor where the tree shows
     * the whole project. Passed outright by the menu raised on the blank, whose click clears the
     * selection — a callback built before that clearing would aim at the row picked a moment ago.
     */
    (command: CommandId, into: string = landing): CommandAnswer =>
      runExplorerCommand(command, {
        into,
        folderName,
        settle: outcome => {
          settled(outcome)
          // The field opens on the folder that was just made, so the name it is born with is a
          // placeholder rather than something to go and correct. Set before the row exists: the
          // tree is reading its folders again, and the row draws the field when it arrives.
          const created = command === 'explorer.newFolder' ? outcome.done[0]?.to : undefined
          if (created) setRenaming({ nodeId: created, asset: null })
        },
      }),
    [settled, landing, folderName],
  )

  // `listens` without the focus: the keyboard has to be earned — ⌘Z means something else in the
  // canvas — while a command addressed to this scope names it, and there is one Explorer.
  useShortcuts({ scope: 'explorer', enabled: focused, listens: true, onCommand: run })

  const activate = async (node: FolderNode): Promise<void> => {
    // Asked before the folder question, not after: an image document is a directory, and folding
    // it open showed the user the parts the studio writes for itself instead of opening it.
    const document = documentOf(node)
    if (document) return openDocument(document)

    if (node.kind === 'folder') return toggle(node.id)

    // The gesture itself lives in `openProjectFile`, which the assistant's `file.open` runs too:
    // a double-click and a spoken "open this" must land in the same place, or they are two
    // studios. What it answers is for a caller that has to say what happened — and this one has
    // a row under the pointer, so an entry that has gone since the listing is worth a line.
    if ((await openProjectFile(node.path)) === 'missing') {
      reportFailure('explorer.open', nameOf(node.path), new Error('not there'))
    }
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
  /**
   * Read off the RESOLVED map, never off the name: a fresh folder wearing the old default name is
   * an ordinary folder. Inverted once — the panel asks it twice per row.
   */
  const roleOf = (node: FolderNode): FolderRole | null =>
    node.kind === 'folder' ? (byFolder.get(node.path) ?? null) : null

  /**
   * The hue the glyph is inked in — the section it belongs to, and nothing for what belongs to
   * none. A document answers by its workspace, a role folder by its role, a file by what the
   * catalogue says it IS; the plain folders and the strays stay in ordinary ink.
   */
  const inkFor = (node: FolderNode): string | undefined => {
    const document = documentOf(node)
    if (document) return workspaceInk(document.workspace)

    const role = roleOf(node)
    if (role) return roleInk(role)

    return node.kind === 'file' ? domainInk(natureOf(node.path).domain) : undefined
  }

  /**
   * The glyph an entry wears. The descriptor is asked FIRST: an image document is a directory, and
   * answering the folder question first showed a folder over every other space's own glyph.
   */
  const iconFor = (node: FolderNode, expanded: boolean): string => {
    const document = documentOf(node)
    if (document) return workspaceById(document.workspace).icon
    if (node.kind !== 'folder') return mdiFileOutline

    const role = roleOf(node)
    if (role) return roleIcon(role)

    return expanded ? mdiFolderOpenOutline : mdiFolderOutline
  }

  /** Which section a folder SERVES, in words — its NAME is the disk's and never translated. */
  const hintFor = (node: FolderNode): string | undefined => {
    const role = roleOf(node)
    if (!role) return undefined

    return t(roleLabelKey(role), { label: t(workspaceLabelKey(WORKSPACE_BY_ROLE[role])) })
  }

  /**
   * What a CARD stands for, which decides the silhouette it draws. Asked in the same order as
   * `iconFor`, and for the same reason: an image document is a directory on the disk.
   */
  const kindOf = (node: FolderNode): EntryKind =>
    documentOf(node) ? 'document' : node.kind === 'folder' ? 'folder' : 'file'

  /**
   * The picture an entry shows in place of its glyph. Beside `iconFor` for the same reason: two
   * places answering one question is what this panel has already paid for twice. A folder has a
   * shape of its own and a document the glyph of its space; neither is a file to preview.
   */
  const previewFor = (node: FolderNode): string | undefined =>
    node.kind === 'file' && !documentOf(node) && !isPrivatePath(node.path)
      ? thumbnailUrl(node.path)
      : undefined

  /**
   * A double-click on a CARD. A folder is gone INTO rather than folded open, a grid having no
   * nesting to draw — `browse` is what opens it in the tree, and says why.
   */
  const enter = (node: FolderNode): void => {
    if (documentOf(node) || node.kind !== 'folder') return void activate(node)
    browse(node.path)
  }

  /**
   * The menu an entry offers, wherever it was drawn. The catalogue is asked BEFORE the menu appears
   * and that round trip is the point: only it knows whether a file under `assets/` is an asset, and
   * the answer decides whether renaming is offered or greyed. One reader for both renderings.
   */
  const raiseEntryMenu = (node: FolderNode): void => {
    void assetAt(node.path).then(asset =>
      openEntryMenu({
        node,
        // Read at the click rather than from the render's copy: the list arms the menu on the row
        // it was raised on, and that write has not reached this closure yet.
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
        onAsset: action =>
          void runAssetAction(
            action,
            selectedFilePaths(useSelection.getState()),
            t('assets.contactSheetName'),
          ),
        run,
      }),
    )
  }

  /**
   * The menu the blank offers, aimed at `into`: the project folder for the tree, which shows all of
   * it, and the folder browsed for the grid, which shows one. No round trip to the catalogue — what
   * it offers is about a place, not about a file.
   */
  const raiseRootMenu = (into: string): void => {
    openRootMenu({
      clipboard: clipboard.length,
      history,
      bindings: currentOverrides(),
      t,
      onImport: () => void useMedia.getState().importMedia(),
      run: command => run(command, into),
    })
  }

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
      {/* Under the title row and not on it — the field measured 76 px up there. The two readings
          STAY up in it: they answer about the project, where this bar is about the list on screen.
          `display` is on now the grid exists; the zoom greys itself out on a list.

          The walk rides on the search line, and only where there IS a walk: a search and a domain
          answer about the whole project, and three greyed buttons over either say the panel has
          lost its way. */}
      <CollectionBar
        scId="explorer"
        state={collection}
        onChange={setCollection}
        sorts={sorts}
        leading={
          browsable ? (
            <FolderNav
              canBack={canWalkBy(walk, -1)}
              canForward={canWalkBy(walk, 1)}
              canUp={browsed !== FOLDER_ROOT}
              onBack={() => goTo(walkedBy(walk, -1))}
              onForward={() => goTo(walkedBy(walk, 1))}
              onUp={() => browse(parentOf(browsed) ?? FOLDER_ROOT)}
            />
          ) : undefined
        }
      />

      {/* Nothing at all unless a pass LASTS, which on a project where nothing moved it never
          does: inserted here, a row that came and went would push the tree down and back. */}
      <RescanBar />

      {/* Where files coming IN report their progress — it followed the import here, the shelf
          having stopped listing what the project holds. */}
      <ImportProgress />

      <div className="min-h-0 flex-1">
        {grid ? (
          <Collection
            items={entries}
            state={collection}
            label={t('panels.explorer')}
            multiple
            selectedIds={selectedIds}
            // The item is ignored: `pickFrom` has already resolved what the click ASKED for against
            // the cards on screen, and composing that with what is held is this panel's half.
            onSelect={(_, ids, mode) => pick(applySelection(selectedIds, ids, mode))}
            onActivate={enter}
            onContextMenu={raiseEntryMenu}
            // `browsed` and not `FOLDER_ROOT`: the grid shows ONE folder, so its blank means the one
            // on screen — a folder made here belongs where the user is looking.
            onPressRoot={() => pick([])}
            // The hand is emptied here too: a drop on the blank fires no card's `dragEnd`, and the
            // batch would stay held — `Tree` clears its own on the same gesture, for the same reason.
            onDropRoot={paths => {
              setCarried(null)
              void getBridge()?.project.moveFiles(paths, browsed).then(settled)
            }}
            // The blank of the grid means the folder on screen, as it does for every other
            // gesture here — a new folder, a paste, a drop of the panel's own rows.
            foreign={{ carries: carriesAsset, onDrop: event => landAsset(event, browsed) }}
            onContextMenuRoot={() => raiseRootMenu(browsed)}
            // A message is not a card, so `onBlank` counts it as blank and an empty folder still
            // offers the one gesture that gets you out of it.
            //
            // A FIFTH silence, and only the grid can reach it: `emptyState` answers for a project
            // that would not be read, which is what an empty tree means — gone down into a folder
            // that merely holds nothing, it would report the disk as unreadable.
            empty={
              browsable && browsed !== FOLDER_ROOT ? (
                <EmptyState icon={mdiFolderOpenOutline} message={t('explorer.emptyFolder')} />
              ) : (
                emptyState
              )
            }
            renderCard={node => (
              <EntryCard
                name={documentOf(node)?.title ?? node.name}
                // Never the open glyph: a grid draws no children under a folder, so an open one
                // would promise a nesting that is not on screen.
                icon={iconFor(node, false)}
                kind={kindOf(node)}
                preview={previewFor(node)}
                open={isOpen(documentOf(node))}
                waiting={waiting.has(node.path)}
                // The whole selection where this card is in one, so three carried together arrive
                // together — `Tree` composes the same batch for its rows.
                dragIds={selectedIds.includes(node.id) ? selectedIds : [node.id]}
                pickable={!isPrivatePath(node.path)}
                // The SAME predicate the tree's `droppable` carries, and no more: `canMoveInto`
                // already refuses a private folder and a document written as one.
                accepts={
                  node.kind === 'folder' &&
                  carried !== null &&
                  carried.every(one => canMoveInto(one, node.path))
                }
                foreign={{
                  accepts: acceptsAsset(node),
                  carries: carriesAsset,
                  onDrop: event => landAsset(event, node.path),
                }}
                onPickUp={setCarried}
                onRelease={() => setCarried(null)}
                onDropInto={paths =>
                  void getBridge()?.project.moveFiles(paths, node.path).then(settled)
                }
                {...(renaming?.nodeId === node.id
                  ? {
                      onRename: (name: string) => commitRename(node, renaming.asset, name),
                    }
                  : {})}
              />
            )}
          />
        ) : nodes.length === 0 ? (
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
            onToggle={toggleBranch}
            // A heading names files rather than holding them: it is not a thing to pick, and a
            // selection that gathered one would hand the disk a domain where it expects a path.
            selectable={node => !isDomainHeading(node)}
            expandable={expandable}
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
            // The same object the grid takes: one predicate, one landing, two views.
            foreign={{
              carries: carriesAsset,
              accepts: acceptsAsset,
              onDrop: (event, node) =>
                landAsset(event, node && !isDomainHeading(node) ? node.path : FOLDER_ROOT),
            }}
            // The blank aims at the project folder, as the drop above does: the tree shows the
            // whole of it, so there is only ever one place its blank could mean.
            onContextMenuRoot={() => raiseRootMenu(FOLDER_ROOT)}
            onActivate={node => void (isDomainHeading(node) ? toggle(node.id) : activate(node))}
            // A heading raises none: every gesture the menu carries is about a file, and a domain
            // that names files is not one.
            onContextMenu={node => {
              if (isDomainHeading(node)) return
              raiseEntryMenu(node)
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

              return (
                <EntryRow
                  // The document's name where there is one — its title for the older ones whose
                  // file still wears a uuid.
                  name={document?.title ?? node.name}
                  // And its extension beside it — only where the two together spell the FILE.
                  // A document written before the rename wears a uuid and shows its title, and
                  // « Ma scène .gltf » would name nothing anyone could find on disk.
                  extension={
                    document?.title === documentStemOf(node.name)
                      ? documentExtensionOf(node.name)
                      : undefined
                  }
                  icon={iconFor(node, row.expanded)}
                  ink={inkFor(node)}
                  hint={hintFor(node)}
                  preview={previewFor(node)}
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

      {/* Under the rows rather than over them: the trail says where the listing came FROM, and a
          reader looks at it after the listing, not before. Only where there is somewhere to go —
          a search and a domain are flat answers about the whole project. */}
      {browsable && (
        <FolderCrumbs
          folder={browsed}
          onPick={browse}
          labels={{
            nav: t('explorer.crumbs'),
            projectFolder: t('explorer.projectFolder'),
            hint: t('explorer.crumbHint'),
          }}
          // At the FOOT of the panel, so it carries its own rule and hints upward: one below it
          // would open off the panel.
          tip={HINT_TOP}
          className="border-border border-t"
        />
      )}
    </div>
  )
}
