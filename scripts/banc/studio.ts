import { vi } from 'vitest'
import type { ActionName, ActionOutcome } from '@shared/domain/assistant'
import type { Asset } from '@shared/domain/asset'
import {
  isDocumentExtension,
  kindForExtension,
  workspaceForKind,
  type DocumentDescriptor,
} from '@shared/domain/document'
import { documentFileName } from '@shared/domain/documentName'
import { extensionOf, stemOf } from '@shared/domain/fileName'
import { nameOf, parentOf, pathIn, type FileKind } from '@shared/domain/folder'
import type { Job } from '@shared/domain/job'
import type { ModelFamily } from '@shared/domain/model'
import type { StudioBridge } from '@shared/ipc'
import { narrowTargets, type Target } from '@shared/domain/target'
import { describeStudio } from '@main/assistant/studioState'
import { frontTargets } from '@/assistant/documentTargets'
import { registerConfirmer } from '@/assistant/confirm'
import { runAction, runConfirmedAction } from '@/assistant/executor'
import { installFakeBridge } from '@/services/fakeBridge'
import { lendPictureMeasure } from '@/spaces/image/pictureSize'
import { resetDocumentStoresForTests } from '@/stores/documentStore'
import { useJobs } from '@/stores/jobs'
import { unsavedDocumentIds } from '@/app/documentIo'
import { frontDocumentIn, useDocuments } from '@/stores/documents'
import { useLayouts } from '@/stores/layouts'
import { useProject } from '@/stores/project'
import { sceneOf, useScenes } from '@/stores/scenes'
import { installGeneratorPanel } from './generatorPanel'
import { createMemoryCatalog, type MemoryCatalog } from './memoryCatalog'
import { WHEN } from './project'
import { createMemoryCloud } from './memoryCloud'
import { createMemoryFiles } from './memoryFiles'
import { createMemoryGit, type MemoryGit } from './memoryGit'
import { createMemoryShell, type MemoryShell } from './memoryShell'
import { createMemoryFolder, type MemoryFolder } from './memoryFolder'

/**
 * 🛑 Nothing here decides. Every call goes through `runConfirmedAction`, the door the window AND
 * the MCP server go through; only the ports the app declares and the surfaces a headless run has
 * none of — the dock, the confirmation modal, the generator panel — are stood in for.
 */
export type Studio = {
  run: (action: ActionName, input: Record<string, unknown>) => Promise<ActionOutcome>
  /** The sentences the briefing carries, written by the application's own composer. */
  state: () => Promise<string>
  targets: (said: string) => readonly Target[]
  documents: () => readonly DocumentDescriptor[]
  front: () => DocumentDescriptor | null
  files: () => readonly string[]
  assets: () => readonly Asset[]
  jobs: () => readonly Job[]
  /** The repository, as this run left it — section 58 reads nothing else. */
  git: MemoryGit
  /** The surfaces around the documents: styles, context, accounts, and what the OS was asked. */
  shell: MemoryShell
  /** What the open project is called — its manifest's name, which a rename rewrites. */
  projectName: () => string
  /** Every picture a generation was given to work FROM, as the generator's schema read them. */
  references: () => readonly string[]
  /** What family a job ran — the API's own answer, which `Job` does not carry. */
  familyOf: (modelId: string) => ModelFamily | null
  /** Whether anything outlived the looking: a document written, or a file gesture carried out. */
  changed: () => boolean
  /** Every call it refused, named — a DECOR that hits one has laid out nothing. */
  refusals: () => readonly string[]
  /** Called once the decor is laid out, so what the DECOR did is not scored as the MODEL's. */
  settle: () => void
  /**
   * Where a node STOOD when the person spoke: a fresh camera is at (0, 2, 6) and a fresh light
   * at (5, 10, 7.5), so « moved off the origin » was true before the sentence was typed.
   */
  wasAt: (nodeId: string) => string | null
  /** Gives back the three surfaces this studio stood in for. */
  close: () => void
}

/** What `documents.list` answers: every file of the project the studio opens as a document. */
function descriptorsOf(folder: MemoryFolder): DocumentDescriptor[] {
  return folder
    .paths()
    .filter(path => isDocumentExtension(extensionOf(path)))
    .flatMap(path => {
      const kind = kindForExtension(extensionOf(path))
      const workspace = kind ? workspaceForKind(kind) : null
      if (!kind || !workspace) return []

      return [{ id: `doc-${path}`, kind, workspace, title: stemOf(nameOf(path)), path }]
    })
}

/** jsdom decodes nothing — `file.open` on a photo hung for the whole timeout. Not 1024²: a
 * document that took its picture's size has to be tellable from one that fell back. */
const PICTURE = { width: 1024, height: 768 }

/** The brain the window asks, which the MAIN process holds — the door, never the loop. */
export type Think = StudioBridge['assistant']['think']

export async function createStudio(
  seed: readonly { path: string; kind: FileKind }[],
  think?: Think,
): Promise<Studio> {
  const folder = createMemoryFolder(seed)
  const catalog: MemoryCatalog = createMemoryCatalog(seed)
  const ops = createMemoryFiles(folder, catalog)
  const cloud = createMemoryCloud(folder, catalog)
  const documentsOnDisk = new Map(descriptorsOf(folder).map(one => [one.id, one]))
  const git = createMemoryGit()
  const shell = createMemoryShell(assetId => catalog.rows().find(one => one.id === assetId) ?? null)

  installFakeBridge({
    ...shell.channels,
    git,
    project: {
      ...shell.channels.project,
      listFolder: (relative, hidden) => folder.list(relative, hidden),
      searchFolder: (term, hidden) => folder.search(term, hidden),
      walkFolder: hidden => folder.walk(hidden),
      renameFile: ops.rename,
      moveFiles: ops.move,
      duplicateFiles: paths => ops.duplicate(paths),
      trashFiles: ops.trash,
      newFolder: ops.createFolder,
      undoFile: ops.undo,
      redoFile: ops.redo,
      fileHistory: () => Promise.resolve(ops.can()),
      fileFacts: relative => {
        const kind = folder.kindOf(relative)
        return Promise.resolve(
          kind === null
            ? null
            : { path: relative, kind, bytes: 0, createdAt: WHEN, modifiedAt: WHEN },
        )
      },
    },
    assets: {
      search: query => catalog.search(query),
      counts: () => catalog.countByType(),
    },
    // What `openProjectFile` asks before it decides between a document and an asset.
    media: {
      adopt: relative => {
        shell.adopt(relative)
        return catalog.search({ path: relative, limit: 1 }).then(found => found[0] ?? null)
      },
    },
    documents: {
      list: () => Promise.resolve([...documentsOnDisk.values()]),
      // The file moves and the descriptor keeps its id: a document's identity survives a rename,
      // which is the whole reason `DocumentDescriptor.id` is not its path.
      rename: async (documentId, kind, title) => {
        const held = documentsOnDisk.get(documentId)
        if (!held) throw new Error(`no document ${documentId}`)

        const renamed = documentFileName(title, kind)
        await ops.rename(held.path, renamed)
        const next = { ...held, kind, title, path: pathIn(parentOf(held.path) ?? '', renamed) }
        documentsOnDisk.set(documentId, next)
        return next
      },
    },
    ...(think ? { assistant: { think } } : {}),
    provider: {
      searchModels: query => cloud.searchModels(query),
      describeModel: modelId => cloud.describeModel(modelId),
      generate: (modelId, body) => cloud.generate(modelId, body),
    },
  })

  // The project the bench runs against, held open: every file action refuses `noProject` first.
  useProject.setState({ project: shell.projectAt('/project', 'Démo'), known: true })

  // One studio per scenario: the stores are module singletons, and a document left open by the
  // scenario before would read as a second tab nobody opened.
  resetDocumentStoresForTests()
  useDocuments.setState({ documents: {}, stored: [], activeId: null })
  useJobs.setState({ jobs: [], bodies: {} })
  // The project's own documents, read as the app reads them at open: without this every
  // `file.open` on a `.gltf` falls through to « hand it to the system ».
  await useDocuments.getState().relist()

  const references: string[] = []
  const giveBackMeasure = lendPictureMeasure(() => Promise.resolve(PICTURE))
  const closeGenerator = installGeneratorPanel(cloud.fieldsOf, given => references.push(...given))
  // The person, who typed the sentence: a headless run has nobody to ask, and refusing every
  // spend would score the whole of sections 20 to 22 on a studio never asked to generate.
  const closeConfirmer = registerConfirmer(() => Promise.resolve(true))

  const refusals: string[] = []
  const poses = new Map<string, string>()
  const activated = new Set<string>()
  let settled = new Set<string>()
  let space = useLayouts.getState().activeWorkspace

  /**
   * 🛑 Dockview announces the active panel, and nothing announces it headless — every space-bound
   * action then refuses `wrongSurface`. SUBSCRIBED, never wrapped around a call: the window's own
   * chain reaches `runConfirmedAction` directly, so a wrapper sees the decor's calls and not one
   * of the model's.
   */
  const followTheDock = (): (() => void) => {
    const onDocument = useDocuments.subscribe(state => {
      const fresh = Object.keys(state.documents).find(one => !activated.has(one))
      if (fresh === undefined) return

      activated.add(fresh)
      if (state.activeId !== fresh) useDocuments.getState().activate(fresh)
    })

    // A space brought forward brings back the tab it was last read in — `showWorkspace`'s rule.
    const onSpace = useLayouts.subscribe(state => {
      if (state.activeWorkspace === space) return

      space = state.activeWorkspace
      const wanted = frontDocumentIn(useDocuments.getState(), space)
      if (wanted !== null) useDocuments.getState().activate(wanted)
    })

    return () => {
      onDocument()
      onSpace()
    }
  }

  const leaveTheDock = followTheDock()

  const run = async (
    action: ActionName,
    input: Record<string, unknown>,
  ): Promise<ActionOutcome> => {
    const outcome = await runConfirmedAction(action, input)
    if (!outcome.ok) refusals.push(`${action} ${outcome.refusal}`)

    return outcome
  }

  const front = (): DocumentDescriptor | null => {
    const { activeId, documents } = useDocuments.getState()
    return activeId === null ? null : (documents[activeId] ?? null)
  }

  return {
    run,
    state: async () => {
      const read = await runAction('studio.state', {})
      return read.ok ? describeStudio(read.data) : ''
    },
    targets: said => narrowTargets(frontTargets()?.targets() ?? [], said),
    documents: () => Object.values(useDocuments.getState().documents),
    front,
    files: () => folder.paths(),
    assets: () => catalog.rows(),
    jobs: () => useJobs.getState().jobs,
    references: () => references,
    git,
    shell,
    projectName: () => useProject.getState().project?.manifest.name ?? '',
    familyOf: cloud.familyOf,
    changed: () => unsavedDocumentIds().some(one => !settled.has(one)) || ops.can().undo,
    refusals: () => refusals,
    wasAt: nodeId => poses.get(nodeId) ?? null,
    settle: () => {
      // A snapshot, like the poses below — never a write into the studio's own save marks.
      settled = new Set(unsavedDocumentIds())
      ops.forget()
      refusals.length = 0
      poses.clear()
      for (const document of Object.values(useDocuments.getState().documents)) {
        if (document.kind !== 'scene') continue

        for (const node of sceneOf(useScenes.getState(), document.id).nodes) {
          poses.set(node.id, JSON.stringify(node.transform))
        }
      }
    },
    close: () => {
      closeConfirmer()
      closeGenerator()
      giveBackMeasure()
      leaveTheDock()
      // `installFakeBridge` stubs `window.studio`; left standing it keeps this run's whole decor
      // — folder, catalogue, git, shell — reachable until the next scenario replaces it.
      vi.unstubAllGlobals()
    },
  }
}
