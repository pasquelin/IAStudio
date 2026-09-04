import {
  hasVisualChanges,
  type GameExportOutcome,
  type GameExportRequest,
  type LossyOptimization,
} from '@shared/domain/gameExport'
import { projectName } from '@shared/domain/project'
import { assetMasterUrl, versionedUrl } from '@shared/domain/asset'
import { scenePayloadOf } from '@/features/shell/sceneDocument'
import { getBridge } from '@/services/bridge'
import { assetVersionOf } from '@/stores/assets'
import { documentsOfKind, sceneDocumentNamed, useDocuments } from '@/stores/documents'
import { useProject } from '@/stores/project'
import { compiledScripts } from '@/stores/play'
import { loadSceneSource, montageSceneOf } from '@/stores/sceneSources'
import { compileLossyWorldGeometry } from '@/engines/scene/lossyWorldCompiler'
import {
  compileLossyModelTextures,
  compileLossyTextures,
} from '@/engines/scene/lossyTextureCompiler'
import { compileLossyModels } from '@/engines/scene/lossyModelCompiler'
import { createCsgEvaluator } from '@/engines/csg/csgEvaluator'
import CsgWorker from '@/engines/csg/csg.worker?worker'
import { runtimeAssetIds } from './runtimeAssetIds'
import { analyzeLossyWorld, lossyCandidatesOf } from '@/engines/scene/worldAnalyzer'

export type GameExportFailure = 'noBridge' | 'noProject' | 'noScene' | 'unknownScene' | 'declined'

export type GameExportResult =
  | { ok: true; outcome: GameExportOutcome; troubles: readonly string[] }
  | { ok: false; reason: GameExportFailure }

export type GameExportOptions = {
  lossyOptimization: LossyOptimization
  entryScene?: string
  title?: string
  folder?: string
  signal?: AbortSignal
}

export async function exportGameProject(options: GameExportOptions): Promise<GameExportResult> {
  const project = useProject.getState().project
  const bridge = getBridge()
  if (!bridge) return { ok: false, reason: 'noBridge' }
  if (!project) return { ok: false, reason: 'noProject' }

  const projectScenes = await compileProjectScenes(options.lossyOptimization, options.signal)
  if (projectScenes.scenes.length === 0) return { ok: false, reason: 'noScene' }
  const named = options.entryScene ? sceneDocumentNamed(options.entryScene) : null
  const entry = named
    ? projectScenes.scenes.find(scene => scene.id === named)
    : projectScenes.scenes[0]
  if (!entry) return { ok: false, reason: 'unknownScene' }

  const [compiled, textureOverrides, modelTextureOverrides] = await Promise.all([
    compiledScripts(),
    compileLossyTextures(projectScenes.textureAssetIds, options.lossyOptimization, {
      signal: options.signal,
    }),
    compileLossyModelTextures(
      projectScenes.modelAssetIds,
      options.lossyOptimization,
      options.signal,
    ),
  ])
  const assetOverrides = [...textureOverrides, ...modelTextureOverrides]
  const request: GameExportRequest = {
    title: options.title ?? projectName(project.path),
    entryScene: entry.id,
    scenes: projectScenes.scenes,
    scripts: compiled.modules.map(module => ({ script: module.script, code: module.code })),
    ...(Object.keys(projectScenes.modelAssets).length > 0
      ? { modelAssets: projectScenes.modelAssets }
      : {}),
    ...(hasVisualChanges(options.lossyOptimization)
      ? { lossyOptimization: options.lossyOptimization }
      : {}),
    ...(assetOverrides.length > 0 ? { assetOverrides } : {}),
    ...(options.folder ? { folder: options.folder } : {}),
  }
  const outcome = await bridge.game.export(request)
  return outcome
    ? { ok: true, outcome, troubles: compiled.troubles.map(trouble => trouble.script) }
    : { ok: false, reason: 'declined' }
}

type CompiledProjectScenes = {
  scenes: GameExportRequest['scenes']
  textureAssetIds: readonly string[]
  modelAssets: NonNullable<GameExportRequest['modelAssets']>
  modelAssetIds: readonly string[]
}

async function compileProjectScenes(
  lossyOptimization: LossyOptimization,
  signal: AbortSignal | undefined,
): Promise<CompiledProjectScenes> {
  const listed = documentsOfKind(useDocuments.getState(), 'scene')
  await Promise.all(listed.map(document => loadSceneSource(document.id)))
  const states = new Map(
    listed.flatMap(document => {
      const state = montageSceneOf(document.id)
      return state ? [[document.id, state]] : []
    }),
  )
  const modelAssetIds = new Set<string>()
  const protectedModelAssetIds = new Set<string>()
  for (const state of states.values()) {
    for (const node of state.nodes) {
      if (node.type !== 'model') continue
      ;(node.optimization?.mode === 'exclude' ? protectedModelAssetIds : modelAssetIds).add(
        node.model.assetId,
      )
    }
  }
  for (const id of protectedModelAssetIds) modelAssetIds.delete(id)
  const modelPlans = await compileLossyModels(
    [...modelAssetIds].map(id => ({
      id,
      url: versionedUrl(assetMasterUrl(id), assetVersionOf(id)),
    })),
    lossyOptimization,
    signal,
  )
  const csg = createCsgEvaluator({ spawn: () => new CsgWorker(), onFailure: () => undefined })
  const abort = (): void => csg.dispose()
  signal?.addEventListener('abort', abort, { once: true })
  try {
    const scenes = await Promise.all(
      listed.map(async document => {
        const state = states.get(document.id)
        if (!state) return null
        const geometryPlan = await compileLossyWorldGeometry(
          state,
          lossyOptimization,
          async graph => await csg.acquire(graph),
          analyzeLossyWorld(state.nodes),
        )
        const modelNodes = state.nodes.flatMap(node => {
          if (node.type !== 'model' || node.optimization?.mode === 'exclude') return []
          return modelPlans.has(node.model.assetId)
            ? [{ nodeId: node.id, modelAssetId: node.model.assetId }]
            : []
        })
        const optimizedNodes = [...(geometryPlan?.nodes ?? []), ...modelNodes]
        const optimization = optimizedNodes.length > 0 ? { nodes: optimizedNodes } : undefined
        return {
          id: document.id,
          title: document.title,
          content: JSON.stringify(scenePayloadOf(state, document.id)),
          assetIds: runtimeAssetIds(state),
          ...(optimization ? { optimization } : {}),
        }
      }),
    )
    if (signal?.aborted) throw new DOMException('World compilation aborted', 'AbortError')
    const allNodes = [...states.values()].flatMap(state => state.nodes)
    const textureAssetIds = lossyCandidatesOf(allNodes).textureCandidates.map(
      candidate => candidate.assetId,
    )
    return {
      scenes: scenes.flatMap(scene => (scene ? [scene] : [])),
      textureAssetIds,
      modelAssets: Object.fromEntries(modelPlans),
      modelAssetIds: [...modelAssetIds],
    }
  } finally {
    signal?.removeEventListener('abort', abort)
    csg.dispose()
  }
}
