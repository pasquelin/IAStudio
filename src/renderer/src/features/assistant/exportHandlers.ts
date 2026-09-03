import { refused, type ActionOutcome } from '@shared/domain/assistant'
import type { GameExportRequest } from '@shared/domain/gameExport'
import { scenePayloadOf } from '@/features/shell/sceneDocument'

import { getBridge } from '@/services/bridge'

import { documentsOfKind, sceneDocumentNamed, useDocuments } from '@/stores/documents'
import { useProject } from '@/stores/project'
import { compiledScripts } from '@/stores/play'
import { loadSceneSource, montageSceneOf } from '@/stores/sceneSources'
import type { ActionHandlers } from './actionHandler'
import { textOf } from './actionInputs'
import { messageOf } from '@shared/guards'
import { projectName } from '@shared/domain/project'
import { runtimeAssetIds } from '@/game/runtimeAssetIds'

/** Composed HERE and written by the main process — the split is on the channel, in `ipc.ts`. */
export const EXPORT_HANDLERS: ActionHandlers = {
  'game.export': exportGame,
}

async function exportGame(input: Record<string, unknown>, wire?: unknown): Promise<ActionOutcome> {
  const project = useProject.getState().project
  const bridge = getBridge()
  if (!bridge) return refused('noBridge', 'this window is not connected to the studio process')
  if (!project)
    return refused(
      'noProject',
      'no project is open, and a game is exported out of one — projects.list answers what there is, and project.open opens one',
    )

  const folder = textOf(input, 'folder')
  if (wire && !folder)
    return refused(
      'nativeDialog',
      'with no "folder" named the studio raises a picker of the operating system, which a caller on the wire can neither fill nor read — name "folder" and send this again',
    )

  const loaded = await loadScenes()
  if ('refusal' in loaded) return loaded.refusal
  const scenes = loaded.scenes
  if (scenes.length === 0) return refused('badInput', 'this project holds no scene to export')

  const entry = entrySceneOf(input, scenes)
  if (typeof entry === 'string') return refused('badInput', entry)

  const compiled = await compiledScripts()
  const scripts = compiled.modules.map(one => ({ script: one.script, code: one.code }))
  const request = gameRequest(input, project.path, entry.id, scenes, scripts, folder)
  return writeGame(
    request,
    compiled.troubles.map(one => one.script),
  )
}

function gameRequest(
  input: Record<string, unknown>,
  projectPath: string,
  entryScene: string,
  scenes: GameExportRequest['scenes'],
  scripts: GameExportRequest['scripts'],
  folder: string | null,
): GameExportRequest {
  return {
    title: textOf(input, 'title') ?? projectName(projectPath),
    entryScene,
    scenes,
    scripts,
    ...(folder ? { folder } : {}),
  }
}

async function loadScenes(): Promise<
  { scenes: GameExportRequest['scenes'] } | { refusal: ActionOutcome }
> {
  try {
    return { scenes: await scenesOfProject() }
  } catch (error) {
    return { refusal: refused('failed', messageOf(error)) }
  }
}

function entrySceneOf(
  input: Record<string, unknown>,
  scenes: GameExportRequest['scenes'],
): GameExportRequest['scenes'][number] | string {
  const wanted = textOf(input, 'entryScene') ?? ''
  const named = wanted.length === 0 ? null : sceneDocumentNamed(wanted)
  return (
    (named === null ? scenes[0] : scenes.find(one => one.id === named)) ??
    `no scene named "${wanted}"`
  )
}

async function writeGame(
  request: GameExportRequest,
  troubles: readonly string[],
): Promise<ActionOutcome> {
  const bridge = getBridge()
  if (!bridge) return refused('noBridge', 'this window is not connected to the studio process')

  try {
    const outcome = await bridge.game.export(request)
    return outcome
      ? { ok: true, data: { ...outcome, troubles } }
      : refused('declined', 'no folder was picked, or the name is not one folder of the project')
  } catch (error) {
    return refused('failed', messageOf(error))
  }
}

/** Every scene of the project, as the glTF a save writes — the open tab's when there is one. */
async function scenesOfProject(): Promise<GameExportRequest['scenes']> {
  const listed = documentsOfKind(useDocuments.getState(), 'scene')
  await Promise.all(listed.map(one => loadSceneSource(one.id)))

  return listed.flatMap(one => {
    const state = montageSceneOf(one.id)
    if (!state) return []

    return [
      {
        id: one.id,
        title: one.title,
        content: JSON.stringify(scenePayloadOf(state, one.id)),
        assetIds: runtimeAssetIds(state),
      },
    ]
  })
}
