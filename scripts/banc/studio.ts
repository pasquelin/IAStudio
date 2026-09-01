import { vi } from 'vitest'
import type { ActionName, ActionOutcome } from '@shared/domain/assistant'
import type { Memory } from '@shared/domain/assistantMemory'
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
import { DEFAULT_LANGUAGE } from '@shared/i18n'
import { initI18n } from '@/i18n'
import { DEFAULT_ROLE_PATHS } from '@shared/domain/folderRole'
import { nameOf, parentOf, pathIn, type FileKind } from '@shared/domain/folder'
import type { Job } from '@shared/domain/job'
import type { ModelFamily } from '@shared/domain/model'
import type { StudioBridge } from '@shared/ipc'
import { describeStudio } from '@main/assistant/studioState'
import { registerConfirmer } from '@/features/assistant/confirm'
import { runAction, runConfirmedAction } from '@/features/assistant/executor'
import { armCommandScope, subscribeToCommands } from '@/services/commandBus'
import { emptyGame, SCRIPT_EXTENSION, type GameManifest } from '@shared/domain/game'
import { standInForWorkers } from './codeWorker'
import { drawing } from '@/game/game-fixtures'
import { installFakeBridge } from '@/services/fakeBridge'
import { forgetSceneEngine, registerSceneEngine } from '@/stores/sceneEngines'
import { createGameStage } from '@/game/gameStage'
import { lendPictureMeasure } from '@/features/image/pictureSize'
import {
  forgetDocumentHistoriesForTests,
  resetDocumentStoresForTests,
} from '@/stores/documentStore'
import { useAssistant } from '@/stores/assistant'
import { useJobs } from '@/stores/jobs'
import { noContext } from '@shared/domain/projectContext'
import { useProjectContext } from '@/stores/projectContext'
import { useTasks } from '@/stores/tasks'
import { unsavedDocumentIds } from '@/features/shell/documentIo'
import type { PlayState } from '@shared/domain/gameRuntime'
import { frontDocumentIn, useDocuments } from '@/stores/documents'
import { playReportOf, usePlay } from '@/stores/play'
import { useLayouts } from '@/stores/layouts'
import { useProject } from '@/stores/project'
import { useSettings } from '@/stores/settings'
import { DEFAULT_SETTINGS } from '@shared/domain/settings'
import { mergedSettings } from '@main/settings/store'
import { sceneOf, useScenes } from '@/stores/scenes'
import { runSceneCommand } from '@/features/scene/components/sceneCommands'
import { installGeneratorPanel } from './generatorPanel'
import { createBenchMemory } from './memoryStore'
import { createMemoryCatalog, type MemoryCatalog } from './memoryCatalog'
import { DOCUMENT_SOURCES, WHEN } from './project'
import { createMemoryCloud } from './memoryCloud'
import { createMemoryFiles } from './memoryFiles'
import { createMemoryGit, type MemoryGit } from './memoryGit'
import { createMemoryShell, type MemoryShell } from './memoryShell'
import { createMemoryFolder, type MemoryFolder } from './memoryFolder'
import { projectName, withRecentProject } from '@shared/domain/project'

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
  /** What `game.json` holds — the manifest a prefab or a script is named in. */
  game: () => GameManifest
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
  /** The body each generation was SENT, so an oracle can read what the panel actually put in it. */
  sentBodies: () => Record<string, Record<string, unknown>>
  /** Whether anything outlived the looking: a document written, or a file gesture carried out. */
  changed: () => boolean
  /** Every call it refused, named — a DECOR that hits one has laid out nothing. */
  refusals: () => readonly string[]
  /** What the project's memory holds — the REAL store, on a temporary file. */
  memories: () => readonly Memory[]
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

/** What the stand-in TYPES where a question offers nothing to press — a name, most often. */
const TYPED_ANSWER = 'Banc'

/** The brain the window asks, which the MAIN process holds — the door, never the loop. */
export type Think = StudioBridge['assistant']['think']

/** The folders the real export channel refuses by name — see `folderInsideProject`. */
const RESERVED_FOLDERS: readonly string[] = ['.git', '.index']

/** The first name nothing holds, `Vue`, then `Vue 2` — what `freeAssetName` answers on a disk. */
function freePath(disk: MemoryFolder, into: string, stem: string, extension: string): string {
  for (let at = 1; ; at += 1) {
    const path = pathIn(into, at === 1 ? `${stem}${extension}` : `${stem} ${at}${extension}`)
    if (disk.kindOf(path) === null) return path
  }
}

/**
 * 🛑 The studio's own translations, which a headless run had none of: `i18next.t` answered
 * `undefined`, and `landingChoice` handed that to `safeFileName` — nine of ninety-five scenarios
 * died in `generator.submit` on « reading 'normalize' », measured 2026-09-01.
 */
const speakFrench = (): Promise<void> => initI18n(DEFAULT_LANGUAGE)

/**
 * The pictures an extraction stands in for: what the project holds under Materials.
 *
 * 🛑 ALL of them, and the base-colour ones are not told apart — `memoryCatalog` files no `map`,
 * so nothing here says which channel a picture is. A decor that needs that distinction has to
 * give the catalogue the field first.
 */
const texturesOfTheProject = (catalog: MemoryCatalog): readonly Asset[] =>
  catalog
    .rows()
    .filter(
      one =>
        one.type === 'image' && (one.path ?? '').startsWith(`${DEFAULT_ROLE_PATHS.materials}/`),
    )

export async function createStudio(
  seed: readonly { path: string; kind: FileKind }[],
  think?: Think,
  answers: 'yes' | 'no' = 'yes',
): Promise<Studio> {
  await speakFrench()
  const folder = createMemoryFolder(seed)
  // What the seeded documents really hold. A path alone reads back as a document with no content.
  await Promise.all(DOCUMENT_SOURCES.map(one => folder.write(one.path, one.source)))
  const catalog = createMemoryCatalog(seed)
  const ops = createMemoryFiles(folder, catalog)
  const cloud = createMemoryCloud(folder, catalog)
  const documentsOnDisk = new Map(descriptorsOf(folder).map(one => [one.id, one]))
  const git = createMemoryGit()
  let manifest = emptyGame()
  const shell = createMemoryShell(assetId => catalog.rows().find(one => one.id === assetId) ?? null)
  const memory = createBenchMemory()

  installFakeBridge({
    ...shell.channels,
    git,
    memory: memory.channels,
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
      // 🛑 A PORT: `game.json`, held in memory. The default REFUSES a write, so a manifest was
      // one more thing no scenario could ever see change.
      read: () => Promise.resolve({ game: manifest, trouble: null }),
      write: written => {
        manifest = written
        return Promise.resolve({ game: manifest, trouble: null })
      },
    },
    /**
     * 🛑 A PORT, and one the bench had wrong: the stub answered `DEFAULT_SETTINGS` to every write,
     * and the store keeps what the channel hands back — so any preference written wiped the shelf
     * the decor had just sown. Through the REAL `mergedSettings`, never a second merge of its own.
     */
    settings: {
      write: partial => Promise.resolve(mergedSettings(useSettings.getState().settings, partial)),
      read: () => Promise.resolve(useSettings.getState().settings),
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
      /**
       * 🛑 The stub answered `null` and wrote NOTHING: « exporte la scène dans mon dossier
       * documents » came back `ok null` over an empty folder, and no oracle could tell the export
       * from a refusal. The files land on the same disk as everything else, under the folder the
       * request names — which is what `exportInto` does on a real machine.
       */
      exportInto: async request => {
        // 🛑 The refusal the real channel gives, and the one `stateHandlers.ts` tells apart: the
        // destination is NAMED, held inside the project, and `.git` and `.index` are not it.
        if (RESERVED_FOLDERS.includes(request.folder) || request.folder.includes('..')) return null

        await folder.createFolder(request.folder)
        // `${name}${extension}` with no dot between them, as `main/export/folder.ts` writes it:
        // an `ExportedFile` carries its extension with the dot, so a second one names `x..glb`.
        for (const file of request.files)
          await folder.write(pathIn(request.folder, `${file.name}${file.extension}`))
        return request.folder
      },
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
      /**
       * 🛑 The stub REJECTED, so « ouvre la texture utilisée par mon modèle » had no answer at
       * all. Reading pictures out of a `.glb` is what a backend does and this disk holds names,
       * so what stands in FILES the project's own base-colour material pictures as fresh rows —
       * copies keeping their id would have any later gesture land on the original.
       */
      extractTextures: async assetId => {
        // The refusal the real channel gives: `handlers.ts` finds the asset and throws for a row
        // that is not a mesh, so a hallucinated id answered `ok` with the whole shelf.
        const held = await catalog.find(assetId)
        if (!held || held.type !== 'mesh') throw new Error(`asset ${assetId} is not a mesh`)

        // 🛑 Idempotent, as `textureExtraction.ts` is: it short-circuits on what it already filed,
        // « without that, the two paths would double », and a model may repeat this call.
        const already = catalog.rows().filter(one => one.derivedFrom === assetId)
        if (already.length > 0) return already

        const filed: Asset[] = []
        for (const one of texturesOfTheProject(catalog)) {
          const path = freePath(
            folder,
            DEFAULT_ROLE_PATHS.image,
            stemOf(nameOf(one.path ?? '')),
            '.png',
          )
          await folder.write(path)
          filed.push(
            await catalog.add({
              ...one,
              id: `texture-${path}`,
              name: stemOf(nameOf(path)),
              path,
              derivedFrom: assetId,
            }),
          )
        }
        return filed
      },
      /**
       * 🛑 The stub REJECTED, so « ouvre la texture utilisée par mon modèle » had no answer at
       * all. Reading the pictures out of a `.glb` is what a backend does and this disk holds
       * names, so what stands in is the project's OWN material pictures — the ones an extraction
       * would have filed there, minus the maps that are not the base colour.
       */
      /**
       * 🛑 The stub REJECTED, so every still the bench ever took answered « the scene viewport
       * gave back no still » — a refusal that named the viewport for a port that had simply said
       * no. The picture lands on the disk and in the catalogue, as an indexing pass files one.
       */
      savePicture: async request => {
        // 🛑 A FREE name, as `freeAssetPath` gives one: two captures of the same view are two
        // pictures in the studio, and a fixed path filed one row over another — the very lie
        // `batterie.test.ts` guards under « une copie s'appelle "… 2" ».
        const path = freePath(folder, DEFAULT_ROLE_PATHS.image, request.name, '.png')
        await folder.write(path)
        return await catalog.add({
          id: `capture-${path}`,
          // The name WITHOUT the extension, as `localBackend.ts` files one: it lands in the path.
          name: nameOf(path).replace(/\.png$/, ''),
          type: 'image',
          location: 'local',
          path,
          tags: [],
          createdAt: WHEN,
        })
      },
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
      cancelJob: jobId => cloud.cancelJob(jobId),
      /**
       * 🛑 The stub REJECTED with « no usage », so « combien me reste-t-il de crédits » could not
       * be answered at all — the model sent the call eleven times over. What a headless run can
       * honestly stand in for is the SHAPE of an answer, filled from the jobs this run has run.
       */
      usageReport: period =>
        Promise.resolve({
          period,
          from: WHEN,
          to: WHEN,
          units: useJobs.getState().jobs.length,
          discount: 0,
          jobs: useJobs.getState().jobs.length,
          daily: [],
          accounts: [],
          models: [],
          actions: [],
          assets: [],
          silent: [],
          price: null,
        }),
    },
  })

  // The project the bench runs against, held open: every file action refuses `noProject` first.
  useProject.setState({ project: shell.projectAt('/projets/Démo'), known: true })

  // One studio per scenario: the stores are module singletons, and a document left open by the
  // scenario before would read as a second tab nobody opened.
  resetDocumentStoresForTests()
  useDocuments.setState({ documents: {}, stored: [], activeId: null })
  useJobs.setState({ jobs: [], bodies: {} })
  // 🛑 And the tasks: a decor that starts one starts it BY HAND, so nothing ends it — `runTask`'s
  // own `finally` never runs — and every scenario after it read a task of somebody else's decor.
  useTasks.setState({ running: {} })
  /**
   * 🛑 And the project's context cards, for the same reason and with a worse bite: a card written
   * by one scenario stood for every one after it, so « retiens que… » scored against a project
   * that already held four, and « oublie… » was asked to clear what no decor had laid.
   */
  useProjectContext.setState({ context: noContext(), loaded: true })
  // 🛑 Settings too, and `shelved` is why: a scenario that sows the recent projects would leave
  // them for every section after it, where an empty shelf is what makes `project.create` refuse.
  // It matters more since the port below MERGES a write rather than answering the defaults.
  useSettings.setState({ settings: DEFAULT_SETTINGS })
  /**
   * 🛑 The open project goes ON the shelf, as `settleOpenedProject` puts it there in the real
   * studio. Left off, `projects.list` answered `found 0` over a project that was open, so no
   * sentence naming it by path could be carried out at all — measured on 41.8, 0/3.
   */
  const open = useProject.getState().project
  if (open) {
    useSettings.setState(state => ({
      settings: {
        ...state.settings,
        storage: {
          ...state.settings.storage,
          lastProject: open.path,
          recentProjects: withRecentProject(state.settings.storage.recentProjects, open, WHEN),
        },
      },
    }))
  }
  // The project's own documents, read as the app reads them at open: without this every
  // `file.open` on a `.gltf` falls through to « hand it to the system ».
  await useDocuments.getState().relist()

  const references: string[] = []
  const giveBackMeasure = lendPictureMeasure(() => Promise.resolve(PICTURE))
  const closeGenerator = installGeneratorPanel(cloud.fieldsOf, given => references.push(...given))
  // The person, who typed the sentence: a headless run has nobody to ask, and refusing every
  // spend would score the whole of sections 20 to 22 on a studio never asked to generate.
  // The input goes back as it came: a headless run points at no folder, so what gets scored is
  // the model's own values.
  const closeConfirmer = registerConfirmer(request =>
    Promise.resolve({ granted: answers === 'yes', input: request.input }),
  )
  /**
   * 🛑 Not optional: the chain WAITS on an `ask`, so a headless run with nobody to answer hangs on
   * the first question instead of scoring one. The first offer, which is what a model puts first;
   * a question with nothing to press is answered by a word, as a person would type one.
   */
  const closeChooser = useAssistant.subscribe((state, before) => {
    // Against `before`: this fires on EVERY set, and `noteProgress` runs once per streamed token.
    if (state.choosing && state.choosing !== before.choosing) {
      // One answer per question, the questionnaire included: half a form answered is a chain
      // still parked.
      state.choose(
        state.choosing.questions.map(one => ({ answer: one.choices[0] ?? TYPED_ANSWER })),
      )
    }
  })

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
   * their commands live inside components, so `command.runStudioCommand` still answers `wrongSurface` there.
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

  /**
   * 🛑 The second SURFACE a headless run has not got: a game runs in a WINDOW of its own, and
   * there is none to open here. What stands in is the very stage that window mounts, on the same
   * channel and against the same stub renderer — so the protocol a Play speaks is measured, not
   * replaced. A `fake*` studio is what this dodges: nothing of `play.ts` is re-implemented.
   */
  const followTheGameWindow = (): (() => void) => {
    const stage = createGameStage({ renderer: drawing(), input: new EventTarget() })
    return () => stage.close()
  }

  const leaveTheDock = followTheDock()
  const leaveTheGameWindow = followTheGameWindow()
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
    game: () => manifest,
    assets: () => catalog.rows(),
    jobs: () => useJobs.getState().jobs,
    references: () => references,
    git,
    shell,
    projectName: () => {
      const open = useProject.getState().project
      return open ? projectName(open.path) : ''
    },
    familyOf: cloud.familyOf,
    sentBodies: () => useJobs.getState().bodies,
    changed: () => unsavedDocumentIds().some(one => !settled.has(one)) || ops.can().undo,
    refusals: () => refusals,
    memories: memory.held,

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
      ops.forget()
      // 🛑 And the documents' own histories, for the reason `ops.forget` empties the file stack:
      // a decor lays its scene out through the studio's actions, so a second `scene.undo` took
      // back what the DECOR had put there — 29.2 read a cube that no longer existed.
      forgetDocumentHistoriesForTests()
      // 🛑 AFTER the clear, never before: taken first, the set held every document the decor had
      // laid out — all of them clean a line later — and `changed()` then masked the very ones a
      // scenario edits. A snapshot all the same, never a write into the studio's own save marks.
      settled = new Set(unsavedDocumentIds())
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
      closeChooser()
      closeGenerator()
      giveBackMeasure()
      leaveTheDock()
      leaveTheCommandBus()
      leaveTheViewport()
      leaveTheGameWindow()
      leaveTheWorkers()
      // The database and the temporary file of this run's memory, which nothing else closes.
      memory.close()
      // `installFakeBridge` stubs `window.studio`; left standing it keeps this run's whole decor
      // — folder, catalogue, git, shell — reachable until the next scenario replaces it.
      vi.unstubAllGlobals()
    },
  }

  return studio
}
