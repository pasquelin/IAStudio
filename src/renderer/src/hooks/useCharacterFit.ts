import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { CharacterKind } from '@shared/domain/character'
import { providersRefusalOf, rigProvidersOf } from '@shared/domain/rigProvider'
import { setCharacterRig } from '@/engines/character/characterCommands'
import { rigFit } from '@/engines/scene/rigFit'
import type { MeshSample } from '@/engines/scene/rigSnap'
import { rigSnappedTo } from '@/engines/scene/rigSnap'
import { useFamilyModels } from '@/hooks/useFamilyModels'
import { useMeshSizeLimit } from '@/hooks/useMeshSizeLimit'
import { usePlanAccess } from '@/hooks/usePlanAccess'
import { assetsById, useAssets } from '@/stores/assets'
import { useCharacters } from '@/stores/character'

export function useCharacterFit(assetId: string, sample: MeshSample | null) {
  const { t, i18n } = useTranslation()
  const [kind, setKind] = useState<CharacterKind>('auto')
  const plan = usePlanAccess()
  const services = rigProvidersOf(useFamilyModels('3d'))
  const maxSize = useMeshSizeLimit(services[0]?.modelId ?? null)
  const bytes = useAssets(state => assetsById(state).get(assetId)?.bytes ?? 0)
  const refusal = providersRefusalOf(services, plan, { bytes, maxSize })
  const fit = (): void => {
    if (!sample) return
    const rig = rigSnappedTo(rigFit(sample.bounds), sample)
    useCharacters.getState().runCommand(assetId, setCharacterRig(rig))
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
    fit,
  }
}

export type CharacterFit = ReturnType<typeof useCharacterFit>
