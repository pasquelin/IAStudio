import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CHARACTER_KINDS, HUMANOID_KINDS, type CharacterKind } from '@shared/domain/character'
import { providersRefusalOf, rigProvidersOf } from '@shared/domain/rigProvider'
import { formatBytes } from '@/helpers/format'
import { Button } from '@/components/Button'
import { QuietNote } from '@/components/QuietNote'
import { SelectField } from '@/components/SelectField'
import { setCharacterRig } from '@/engines/character/characterCommands'
import { rigFitFaultOf } from '@/engines/scene/rigFit'
import type { MeshSample } from '@/engines/scene/rigSnap'
import { fitHumanoidRig, humanoidAutoRigBackend } from '@/engines/scene/humanoidAutoRig'
import AdaptiveRigWorker from '@/engines/scene/adaptiveRig.worker?worker'
import { createAdaptiveRigFitter } from '@/engines/scene/adaptiveRigFitter'
import { rigServiceNote } from '@/helpers/rigServiceNote'
import { useFamilyModels } from '@/hooks/useFamilyModels'
import { useMeshSizeLimit } from '@/hooks/useMeshSizeLimit'
import { usePlanAccess } from '@/hooks/usePlanAccess'
import { assetsById, useAssets } from '@/stores/assets'
import { useCharacters } from '@/stores/character'
import { useCharacterView } from '@/stores/characterView'

export type CharacterInspectorFitProps = {
  assetId: string
  /** What the engine measured of this mesh, or `null` while the file is still landing. */
  sample: MeshSample | null
}

/**
 * Making a bare mesh animatable: the studio's own rigger, or a service that does it for credits.
 *
 * 🛑 The chain a service needs — the file, its id, a job to follow — is only verifiable here: the
 * inspector could offer none of it, which is why every service was shown greyed out over there.
 */
export function CharacterInspectorFit({ assetId, sample }: CharacterInspectorFitProps) {
  const { t, i18n } = useTranslation()
  const [kind, setKind] = useState<CharacterKind>('auto')
  const [fitting, setFitting] = useState(false)
  const [fittingFailed, setFittingFailed] = useState(false)
  const adaptive = useMemo(() => createAdaptiveRigFitter(() => new AdaptiveRigWorker()), [])
  useEffect(() => adaptive.dispose, [adaptive])
  const plan = usePlanAccess()
  const services = rigProvidersOf(useFamilyModels('3d'))
  // The mesh is weighed against the limit of the service that would take it, and that one only:
  // asking every model's schema to draw one line would be a call per row.
  const maxSize = useMeshSizeLimit(services[0]?.modelId ?? null)
  const bytes = useAssets(state => assetsById(state).get(assetId)?.bytes ?? 0)
  const refusal = providersRefusalOf(services, plan, { bytes, maxSize })

  const backend = humanoidAutoRigBackend(
    import.meta.env.DEV,
    localStorage.getItem('ia-studio:humanoid-rig-backend'),
  )
  const fault = sample ? rigFitFaultOf(sample.bounds) : null
  if (fault) return <QuietNote>{t(`inspector.rigFault_${fault}`)}</QuietNote>
  if (!sample) return null

  return (
    <>
      <SelectField
        label={t('inspector.characterKind')}
        value={kind}
        options={CHARACTER_KINDS.map(candidate => ({
          value: candidate,
          label: t(`inspector.characterKinds.${candidate}`),
        }))}
        onChange={setKind}
        scId="character.kind"
        // No line of this group ends on a button, so the column `PropertyLine` keeps for one is
        // dead space: the select takes it, rather than stopping short of the button under it.
        actions={false}
      />

      <SelectField
        label={t('inspector.rigService')}
        value=""
        options={[
          { value: '', label: t('inspector.rigServiceLocal') },
          ...services.map(service => ({
            value: service.modelId,
            label: `${service.name} — ${rigServiceNote(service, plan, { bytes, maxSize }, t)}`,
            disabled: true,
          })),
        ]}
        onChange={() => undefined}
        scId="character.service"
        actions={false}
      />

      {/* Said BEFORE any click, never discovered as a 403 nor after minutes of upload: on this
          account every service refuses, and the studio's own rigger runs either way. */}
      {refusal?.kind === 'plan' && (
        <QuietNote>{t('inspector.rigServicesLocked', { plan: plan?.name ?? '' })}</QuietNote>
      )}
      {refusal?.kind === 'too-large' && (
        <QuietNote>
          {t('inspector.rigServicesTooLarge', {
            limit: formatBytes(refusal.maxSize, unit => t(`units.${unit}`), i18n.language),
          })}
        </QuietNote>
      )}

      {fittingFailed && <QuietNote>{t('inspector.rigAdaptiveFailed')}</QuietNote>}

      {/* The studio's own rigger lays a HUMANOID skeleton — hips, spine, four limbs. Saying so
          beats laying one on a horse and letting the person find out. */}
      {!HUMANOID_KINDS.includes(kind) && <QuietNote>{t('inspector.rigNotHumanoid')}</QuietNote>}

      {/* Neutral like every other action of this panel: « Créer le squelette » and « Ajouter les
          mains » never share a screen, so a blue one and a grey one read as two languages rather
          than as a rank. One style for one kind of action. */}
      <Button
        disabled={!HUMANOID_KINDS.includes(kind) || fitting}
        onClick={async () => {
          setFitting(true)
          setFittingFailed(false)
          try {
            const fitted = await fitHumanoidRig(sample, backend, adaptive)
            if (!fitted) return
            useCharacterView.getState().noteRigAnalysis(assetId, fitted.analysis)
            if (!fitted.rig) return
            useCharacters.getState().runCommand(assetId, setCharacterRig(fitted.rig))
          } catch {
            setFittingFailed(true)
          } finally {
            setFitting(false)
          }
        }}
      >
        {t('inspector.rigCreate')}
      </Button>
    </>
  )
}
