import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { CharacterKind } from '@shared/domain/character'
import { providersRefusalOf, rigProvidersOf } from '@shared/domain/rigProvider'
import { setCharacterAutoRig } from '@/engines/character/characterCommands'
import type { MeshSample } from '@/engines/scene/rigSnap'
import { useFamilyModels } from '@/hooks/useFamilyModels'
import { useMeshSizeLimit } from '@/hooks/useMeshSizeLimit'
import { usePlanAccess } from '@/hooks/usePlanAccess'
import { assetsById, useAssets } from '@/stores/assets'
import { characterOf, useCharacters } from '@/stores/character'
import { useAiModels } from '@/stores/aiModels'
import { AUTO_RIG_ROLE } from '@shared/domain/aiRole'
import { writeScopeFor } from '@shared/domain/aiOverview'
import { sceneEngineOf } from '@/stores/sceneEngines'
import { getBridge } from '@/services/bridge'
import { autoRigServiceFor } from '@/engines/character/autoRigBackends'
import { runTask } from '@/stores/tasks'
import type { AutoRigProductError } from '@shared/domain/autoRigInference'

export function useCharacterFit(
  assetId: string,
  documentId: string,
  nodeId: string,
  sample: MeshSample | null,
) {
  const { t, i18n } = useTranslation()
  const [kind, setKind] = useState<CharacterKind>('auto')
  const plan = usePlanAccess()
  const services = rigProvidersOf(useFamilyModels('3d'))
  const maxSize = useMeshSizeLimit(services[0]?.modelId ?? null)
  const bytes = useAssets(state => assetsById(state).get(assetId)?.bytes ?? 0)
  const refusal = providersRefusalOf(services, plan, { bytes, maxSize })
  const overview = useAiModels(state => state.overview)
  const row = overview?.roles.find(candidate => candidate.role === AUTO_RIG_ROLE)
  const configured = row?.chosen.project ?? row?.chosen.app
  const candidate =
    configured?.kind === 'local'
      ? row?.candidates.find(one => one.model.id === configured.modelId)
      : undefined
  const advanced = candidate?.model.backendId
  const needsDownload = advanced !== undefined && !candidate?.installed
  const [failure, setFailure] = useState<AutoRigProductError | null>(null)
  const [running, setRunning] = useState(false)
  const fit = async (requestedBackend = advanced ?? 'simple'): Promise<void> => {
    setFailure(null)
    if (requestedBackend !== 'simple' && needsDownload) {
      setFailure('MODEL_NOT_INSTALLED')
      return
    }
    const engine = sceneEngineOf(documentId)
    if (!engine || !sample) {
      setFailure('ENGINE_UNAVAILABLE')
      return
    }
    setRunning(true)
    try {
      const output = await runTask(t('inspector.autoRigAdvanced'), async (id, watch) => {
        const signal = watch.signal ?? new AbortController().signal
        const targets = engine.autoRigTargets(nodeId)
        const identity = engine.autoRigIdentity(nodeId)
        const characterBefore = characterOf(useCharacters.getState(), assetId)
        if (targets.length === 0) throw new Error('INVALID_MESH')
        const service = autoRigServiceFor(
          async (_input, context) => {
            const result = await engine.simpleAutoRig(
              nodeId,
              sample,
              context.signal,
              context.onProgress,
            )
            if (!result) throw new Error(context.signal.aborted ? 'CANCELLED' : 'INVALID_MESH')
            return result
          },
          async (backendId, backendSignal) => {
            const bridge = getBridge()
            if (!bridge) throw new Error('ENGINE_UNAVAILABLE')
            const input = await engine.autoRigInput(nodeId, backendSignal)
            if (!input) throw new Error('INVALID_MESH')
            return await bridge.autoRig.run({ id, backendId, ...input })
          },
        )
        const result = await service.run(
          requestedBackend,
          {},
          {
            signal,
            onProgress: progress => watch.onStep?.(progress, 1),
            targets,
          },
        )
        if (
          sceneEngineOf(documentId) !== engine ||
          engine.autoRigIdentity(nodeId) !== identity ||
          characterOf(useCharacters.getState(), assetId) !== characterBefore
        )
          throw new Error('CANCELLED')
        return result
      })
      if (!output) return
      useCharacters.getState().runCommand(assetId, setCharacterAutoRig(output))
    } catch (error) {
      setFailure(productErrorOf(error))
    } finally {
      setRunning(false)
    }
  }
  const download = async (): Promise<void> => {
    if (candidate) await useAiModels.getState().installAiModel(candidate.model.id)
  }
  const useSimple = async (): Promise<void> => {
    if (row)
      await useAiModels
        .getState()
        .chooseAiProvider(AUTO_RIG_ROLE, null, writeScopeFor(row, overview?.projectPath ?? null))
    await fit('simple')
  }
  return {
    t,
    i18n,
    kind,
    setKind,
    plan,
    services,
    maxSize,
    bytes,
    refusal,
    advanced,
    needsDownload,
    failure,
    running,
    download,
    useSimple,
    fit,
  }
}

function productErrorOf(error: unknown): AutoRigProductError {
  const message = String(error)
  const errors: readonly AutoRigProductError[] = [
    'MODEL_NOT_INSTALLED',
    'MODEL_INVALID',
    'ENGINE_UNAVAILABLE',
    'UNSUPPORTED_PLATFORM',
    'INVALID_MESH',
    'NOT_HUMANOID',
    'INFERENCE_FAILED',
    'OUT_OF_MEMORY',
    'CANCELLED',
  ]
  return errors.find(code => message.includes(code)) ?? 'INFERENCE_FAILED'
}

export type CharacterFit = ReturnType<typeof useCharacterFit>
