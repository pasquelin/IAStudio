import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { CharacterKind } from '@shared/domain/character'
import { providersRefusalOf, rigProvidersOf } from '@shared/domain/rigProvider'
import { setCharacterRig } from '@/engines/character/characterCommands'
import { fitHumanoidRig, humanoidAutoRigBackend } from '@/engines/scene/humanoidAutoRig'
import type { MeshSample } from '@/engines/scene/rigSnap'
import AdaptiveRigWorker from '@/engines/scene/adaptiveRig.worker?worker'
import { createAdaptiveRigFitter } from '@/engines/scene/adaptiveRigFitter'
import { useFamilyModels } from '@/hooks/useFamilyModels'
import { useMeshSizeLimit } from '@/hooks/useMeshSizeLimit'
import { usePlanAccess } from '@/hooks/usePlanAccess'
import { assetsById, useAssets } from '@/stores/assets'
import { useCharacters } from '@/stores/character'
import { useCharacterView } from '@/stores/characterView'

export function useCharacterFit(assetId: string, sample: MeshSample | null) {
  const { t, i18n } = useTranslation()
  const [kind, setKind] = useState<CharacterKind>('auto')
  const [fitting, setFitting] = useState(false)
  const [fittingFailed, setFittingFailed] = useState(false)
  const adaptive = useMemo(() => createAdaptiveRigFitter(() => new AdaptiveRigWorker()), [])
  useEffect(() => adaptive.dispose, [adaptive])
  const plan = usePlanAccess()
  const services = rigProvidersOf(useFamilyModels('3d'))
  const maxSize = useMeshSizeLimit(services[0]?.modelId ?? null)
  const bytes = useAssets(state => assetsById(state).get(assetId)?.bytes ?? 0)
  const refusal = providersRefusalOf(services, plan, { bytes, maxSize })
  const fit = async (): Promise<void> => {
    if (!sample) return
    setFitting(true)
    setFittingFailed(false)
    try {
      const backend = humanoidAutoRigBackend(
        import.meta.env.DEV,
        localStorage.getItem('ia-studio:humanoid-rig-backend'),
      )
      const fitted = await fitHumanoidRig(sample, backend, adaptive)
      if (!fitted) return
      useCharacterView.getState().noteRigAnalysis(assetId, fitted.analysis)
      if (fitted.rig) useCharacters.getState().runCommand(assetId, setCharacterRig(fitted.rig))
    } catch {
      setFittingFailed(true)
    } finally {
      setFitting(false)
    }
  }
  return {
    t, i18n, kind, setKind, fitting, fittingFailed, plan, services, maxSize, bytes, refusal, fit,
  }
}

export type CharacterFit = ReturnType<typeof useCharacterFit>
