import { refused } from '@shared/domain/assistant'
import {
  GEOMETRY_SIMPLIFICATIONS,
  NO_LOSSY_OPTIMIZATION,
  TEXTURE_COMPRESSIONS,
  TEXTURE_REDUCTIONS,
  hasVisualChanges,
  type GameExportRequest,
  type LossyOptimization,
} from '@shared/domain/gameExport'
import { scenePayloadOf } from '@/features/shell/sceneDocument'

import { getBridge } from '@/services/bridge'

import { documentsOfKind, sceneDocumentNamed, useDocuments } from '@/stores/documents'
import { useProject } from '@/stores/project'
import { compiledScripts } from '@/stores/play'
import { loadSceneSource, montageSceneOf } from '@/stores/sceneSources'
import type { ActionHandlers } from './actionHandler'
import { boolOf, oneOf, textOf } from './actionInputs'
import { messageOf } from '@shared/guards'
import { projectName } from '@shared/domain/project'
import { runtimeAssetIds, runtimeTextureAssetIds } from '@/game/runtimeAssetIds'
import { compileLossyWorldGeometry } from '@/engines/scene/lossyWorldCompiler'
import { compileLossyTextures } from '@/engines/scene/lossyTextureCompiler'
import { createCsgEvaluator } from '@/engines/csg/csgEvaluator'
import CsgWorker from '@/engines/csg/csg.worker?worker'

/** Composed HERE and written by the main process — the split is on the channel, in `ipc.ts`. */
export const EXPORT_HANDLERS: ActionHandlers = {
  'game.export': async (input, wire, signal) => {
    const project = useProject.getState().project
    const bridge = getBridge()
    if (!bridge) return refused('noBridge', 'this window is not connected to the studio process')
    if (!project)
      return refused(
        'noProject',
        'no project is open, and a game is exported out of one — projects.list answers what there is, and project.open opens one',
      )

    // 🛑 Refused BEFORE the scenes are composed: with no folder named, the main process raises a
    // system picker, which a caller on the wire can neither fill in nor see.
    const folder = textOf(input, 'folder')
    if (wire && !folder)
      return refused(
        'nativeDialog',
        'with no "folder" named the studio raises a picker of the operating system, which a caller on the wire can neither fill nor read — name "folder" and send this again',
      )

    const lossyOptimization: LossyOptimization = {
      generateLods: boolOf(input, 'generateLods'),
      geometrySimplification:
        oneOf(input, 'geometrySimplification', GEOMETRY_SIMPLIFICATIONS) ??
        NO_LOSSY_OPTIMIZATION.geometrySimplification,
      textureCompression:
        oneOf(input, 'textureCompression', TEXTURE_COMPRESSIONS) ??
        NO_LOSSY_OPTIMIZATION.textureCompression,
      textureReduction:
        oneOf(input, 'textureReduction', TEXTURE_REDUCTIONS) ??
        NO_LOSSY_OPTIMIZATION.textureReduction,
    }
    const visualChanges = hasVisualChanges(lossyOptimization) ? 'POSSIBLE' : 'NONE'
    let projectScenes: CompiledProjectScenes
    try {
      projectScenes = await scenesOfProject(lossyOptimization, signal)
    } catch (error) {
      return refused('failed', messageOf(error))
    }
    const { scenes } = projectScenes
    if (scenes.length === 0) return refused('badInput', 'this project holds no scene to export')

    // 🛑 Refused rather than fallen back on: a caller that named a scene and got the FIRST one
    // exported the wrong game, and the answer said `ok`.
    const wanted = textOf(input, 'entryScene') ?? ''
    const named = wanted.length === 0 ? null : sceneDocumentNamed(wanted)
    const entry = named === null ? scenes[0] : scenes.find(one => one.id === named)
    if (!entry) return refused('badInput', `no scene named "${wanted}"`)

    const compiled = await compiledScripts()
    let assetOverrides: NonNullable<GameExportRequest['assetOverrides']>
    try {
      assetOverrides = await compileLossyTextures(
        projectScenes.textureAssetIds,
        lossyOptimization,
        {
          signal,
        },
      )
    } catch (error) {
      return refused('failed', messageOf(error))
    }
    const request: GameExportRequest = {
      title: textOf(input, 'title') ?? projectName(project.path),
      entryScene: entry.id,
      scenes,
      scripts: compiled.modules.map(one => ({ script: one.script, code: one.code })),
      ...(visualChanges === 'POSSIBLE' ? { lossyOptimization } : {}),
      ...(assetOverrides.length > 0 ? { assetOverrides } : {}),
      ...(folder ? { folder } : {}),
    }

    // 🛑 Caught like the listing above: the main process THROWS `no game runtime is built` — the
    // ordinary state of a checkout, `resources/gameRuntime` being git-ignored — and an assistant
    // is a caller that has to be answered, never one a rejection may reach.
    let outcome: Awaited<ReturnType<typeof bridge.game.export>>
    try {
      outcome = await bridge.game.export(request)
    } catch (error) {
      return refused('failed', messageOf(error))
    }
    // The main process answers `null` for both, and a caller that NAMED a folder has to be told
    // the name may be what was refused — one folder, inside the project.
    if (!outcome) {
      return refused(
        'declined',
        'no folder was picked, or the name is not one folder of the project',
      )
    }

    // 🛑 What would NOT compile, said: a script missing from a game with no word about why is
    // the defect this whole family exists to make impossible.
    return {
      ok: true,
      data: {
        ...outcome,
        visualChanges,
        troubles: compiled.troubles.map(one => one.script),
      },
    }
  },
}

type CompiledProjectScenes = {
  scenes: GameExportRequest['scenes']
  textureAssetIds: readonly string[]
}

/** Every scene of the project, as the glTF a save writes — the open tab's when there is one. */
async function scenesOfProject(
  lossyOptimization: LossyOptimization,
  signal: AbortSignal | undefined,
): Promise<CompiledProjectScenes> {
  const listed = documentsOfKind(useDocuments.getState(), 'scene')
  await Promise.all(listed.map(one => loadSceneSource(one.id)))
  const csg = createCsgEvaluator({ spawn: () => new CsgWorker(), onFailure: () => undefined })
  const abort = (): void => csg.dispose()
  signal?.addEventListener('abort', abort, { once: true })
  try {
    const scenes = await Promise.all(
      listed.map(async one => {
        const state = montageSceneOf(one.id)
        if (!state) return null
        const optimization = await compileLossyWorldGeometry(
          state,
          lossyOptimization,
          async graph => await csg.acquire(graph),
        )
        return {
          id: one.id,
          title: one.title,
          content: JSON.stringify(scenePayloadOf(state, one.id)),
          assetIds: runtimeAssetIds(state),
          ...(optimization ? { optimization } : {}),
        }
      }),
    )
    if (signal?.aborted) throw new DOMException('World compilation aborted', 'AbortError')
    const available = scenes.flatMap(scene => (scene ? [scene] : []))
    const textureAssetIds = new Set<string>()
    for (const one of listed) {
      const state = montageSceneOf(one.id)
      if (state) for (const id of runtimeTextureAssetIds(state)) textureAssetIds.add(id)
    }
    return { scenes: available, textureAssetIds: [...textureAssetIds] }
  } finally {
    signal?.removeEventListener('abort', abort)
    csg.dispose()
  }
}
