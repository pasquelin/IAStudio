import { vi } from 'vitest'
import type { ActionName, ActionOutcome } from '@shared/domain/assistant'
import type { Asset } from '@shared/domain/asset'
import {
  DOCUMENT_VERSION,
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
import { describeStudio } from '@main/assistant/studioState'
import { registerConfirmer } from '@/assistant/confirm'
import { runAction, runConfirmedAction } from '@/assistant/executor'
import { armCommandScope, subscribeToCommands } from '@/services/commandBus'
import { SCRIPT_EXTENSION } from '@shared/domain/game'
import { standInForWorkers } from './codeWorker'
import { drawing } from '@/game/game-fixtures'
import { installFakeBridge } from '@/services/fakeBridge'
import { forgetSceneEngine, registerSceneEngine } from '@/stores/sceneEngines'
import { lendPictureMeasure } from '@/spaces/image/pictureSize'
import { resetDocumentStoresForTests } from '@/stores/documentStore'
import { useJobs } from '@/stores/jobs'
import { unsavedDocumentIds } from '@/app/documentIo'
import type { PlayState } from '@shared/domain/gameRuntime'
import { frontDocumentIn, useDocuments } from '@/stores/documents'
import { playReportOf, usePlay } from '@/stores/play'
import { useLayouts } from '@/stores/layouts'
import { useProject } from '@/stores/project'
import { sceneOf, useScenes } from '@/stores/scenes'
import { runSceneCommand } from '@/spaces/three/sceneCommands'
import { installGeneratorPanel } from './generatorPanel'
import { createMemoryCatalog } from './memoryCatalog'
import { DOCUMENT_SOURCES, WHEN } from './project'
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
  /** What the game of the document in front is doing, read off the store the window writes. */
  playState: () => PlayState
  /**
   * Waits for a game to be RUNNING, or gives up.
   *
   * 🛑 `play.start` answers before its engines land — deliberately, so an MCP client is not held
   * — so a decor that played and paused in the same breath paused nothing at all, and said `ok`.
   */
  playing: () => Promise<boolean>
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
  // What the seeded documents really hold. A path alone reads back as a document with no content.
  await Promise.all(DOCUMENT_SOURCES.map(one => folder.write(one.path, one.source)))
  const catalog = createMemoryCatalog(seed)
  const ops = createMemoryFiles(folder, catalog)
  const cloud = createMemoryCloud(folder, catalog)
  const documentsOnDisk = new Map(descriptorsOf(folder).map(one => [one.id, one]))
  const git = createMemoryGit()
  const shell = createMemoryShell(assetId => catalog.rows().find(one => one.id === assetId) ?? null)

  installFakeBridge({
    ...shell.channels,
    git,
    /**
     * 🛑 A PORT, not a rule, and the SAME disk as everything else: a script written from outside
     * the window has to turn up in `studio.files()`, or no oracle can read it back. What a write
     * MEANS — the refusal of a path that leaves the project — stays in the main process.
     */
    game: {
      /**
       * 🛑 A PORT: the disk an export writes onto. Every file lands in the memory folder under
       * the game's own name, so an oracle can read back what was written — and 65.1 could not
       * pass at all against the default, which answers « nobody picked a folder ».
       */
      export: async request => {
        const root = `exports/${request.title}`
        const missing: string[] = []
        for (const scene of request.scenes) {
          await folder.write(`${root}/scenes/${scene.id}.gltf`, scene.content)
        }
        for (const script of request.scripts) {
          await folder.write(`${root}/scripts/${stemOf(nameOf(script.script))}.js`, script.code)
        }
        await folder.write(`${root}/index.html`, '<!doctype html>')
        await folder.write(`${root}/runtime.js`, '// bundle')
        return {
          folder: request.title,
          scenes: request.scenes.length,
          scripts: request.scripts.length,
          assets: 0,
          missing,
        }
      },
      scripts: () =>
        Promise.resolve(
          folder
            .paths()
            .filter(path => path.endsWith(SCRIPT_EXTENSION))
            .map(path => ({ path, source: folder.textOf(path) ?? '' })),
        ),
      writeScript: async (path, source) => {
        await folder.write(path, source)
        return true
      },
    },
    project: {
      ...shell.channels.project,
      listFolder: (relative, hidden) => folder.list(relative, hidden),
      searchFolder: (term, hidden) => folder.search(term, hidden),
      walkFolder: hidden => folder.walk(hidden),
      renameFile: ops.rename,
      moveFiles: ops.move,
      duplicateFiles: paths => ops.duplicate(paths),
      // Missing until the bench pass of 2026-08-25, where `files.copy` answered `ok` with an
      // empty batch three times over — the stub's own answer, and nothing had been copied.
      pasteFiles: (paths, into, cut) => (cut ? ops.move(paths, into) : ops.duplicate(paths, into)),
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
      // Left to the stub until the bench pass of 2026-08-25: tagging an asset was answered by a
      // channel that kept nothing, so « range-la avec des mots-clés » could not be measured.
      update: async (assetId, changes) => {
        const held = await catalog.find(assetId)
        if (!held) throw new Error(`no asset ${assetId}`)

        return await catalog.add({ ...held, ...changes, tags: [...(changes.tags ?? held.tags)] })
      },
      remove: async assetIds => {
        for (const one of assetIds) await catalog.remove(one)
      },
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
      // 🛑 A PORT: the envelope the main process stamps, around the TEXT on disk. `null` for a
      // document nothing was ever written under, which is what a fresh one is.
      read: async (documentId, kind) => {
        const held = documentsOnDisk.get(documentId)
        const content = held ? folder.textOf(held.path) : null
        // The KIND too, as the real port locates a file by the `(id, kind)` pair: answering with
        // the kind the caller asked for would let a montage read back as a scene.
        if (!held || held.kind !== kind || content === null) return null

        return { version: DOCUMENT_VERSION, kind, title: held.title, updatedAt: WHEN, content }
      },
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
   * chain reaches `runConfirmedAction` directly.
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

  /**
   * 🛑 The one scope a headless run can stand in for, and it delegates rather than reimplements:
   * `runSceneCommand` is the function the viewport itself calls. The other scopes stay unarmed —
   * their commands live inside components, so `command.run` still answers `wrongSurface` there.
   */
  const followTheCommandBus = (): (() => void) => {
    const disarm = armCommandScope('scene')
    const stop = subscribeToCommands(command => {
      const scene = frontDocumentIn(useDocuments.getState(), '3d')
      return scene !== null && runSceneCommand(scene, command)
    })

    return () => {
      stop()
      disarm()
    }
  }

  /**
   * 🛑 The SURFACE a headless run has not got: a game draws through the engine a viewport owns,
   * and with none `play.start` refuses `wrongSurface` — which is not what a bench measures.
   *
   * What it draws is nothing, and that is all a bench needs: the WORLD is what a scenario reads,
   * and the renderer is only what the runtime hands its placements to.
   */
  const followTheViewport = (): (() => void) => {
    const held = new Set<string>()
    const stop = useDocuments.subscribe(state => {
      for (const documentId of Object.keys(state.documents)) {
        if (held.has(documentId)) continue
        held.add(documentId)
        registerSceneEngine(documentId, drawing())
      }
    })

    return () => {
      stop()
      for (const documentId of held) forgetSceneEngine(documentId)
    }
  }

  const leaveTheDock = followTheDock()
  const leaveTheCommandBus = followTheCommandBus()
  const leaveTheViewport = followTheViewport()
  const leaveTheWorkers = standInForWorkers()

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

  const studio: Studio = {
    run,
    state: async () => {
      const read = await runAction('studio.state', {})
      return read.ok ? describeStudio(read.data) : ''
    },
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

    playing: async () => {
      for (let tries = 0; tries < 200; tries++) {
        if (studio.playState() !== 'edit') return true
        await new Promise(settle => setTimeout(settle, 10))
      }
      return false
    },

    playState: () => {
      const documentId = frontDocumentIn(useDocuments.getState(), '3d')
      return documentId === null ? 'edit' : playReportOf(usePlay.getState(), documentId).state
    },
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
      // 🛑 Every game STOPPED first: sessions live at module scope, so one left running keeps a
      // frame loop, a physics world and a sandbox alive into the next scenario — and its own
      // `begin()` resolves after the bridge has been unstubbed, reading the NEXT run's decor.
      for (const documentId of Object.keys(useDocuments.getState().documents)) {
        usePlay.getState().stop(documentId)
      }
      closeConfirmer()
      closeGenerator()
      giveBackMeasure()
      leaveTheDock()
      leaveTheCommandBus()
      leaveTheViewport()
      leaveTheWorkers()
      // `installFakeBridge` stubs `window.studio`; left standing it keeps this run's whole decor
      // — folder, catalogue, git, shell — reachable until the next scenario replaces it.
      vi.unstubAllGlobals()
    },
  }

  return studio
}
