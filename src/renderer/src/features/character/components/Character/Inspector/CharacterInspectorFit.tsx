import { CHARACTER_KINDS, HUMANOID_KINDS } from '@shared/domain/character'
import { formatBytes } from '@/helpers/format'
import { Button } from '@/components/Button'
import { QuietNote } from '@/components/QuietNote'
import { SelectField } from '@/components/SelectField'
import { rigFitFaultOf } from '@/engines/scene/rigFit'
import type { MeshSample } from '@/engines/scene/rigSnap'
import { rigServiceNote } from '@/helpers/rigServiceNote'
import { useCharacterFit, type CharacterFit } from '@/hooks/useCharacterFit'

export type CharacterInspectorFitProps = {
  assetId: string
  /** What the engine measured of this mesh, or `null` while the file is still landing. */
  sample: MeshSample | null
}

function fitSelectors(state: CharacterFit) {
  const { t, kind, setKind, services, plan, bytes, maxSize } = state
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
    </>
  )
}

function fitNotices(state: CharacterFit) {
  const { t, i18n, refusal, fittingFailed, kind, plan } = state
  return (
    <>
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
      {!HUMANOID_KINDS.includes(kind) && <QuietNote>{t('inspector.rigNotHumanoid')}</QuietNote>}
    </>
  )
}

/**
 * Making a bare mesh animatable: the studio's own rigger, or a service that does it for credits.
 *
 * 🛑 The chain a service needs — the file, its id, a job to follow — is only verifiable here: the
 * inspector could offer none of it, which is why every service was shown greyed out over there.
 */
export function CharacterInspectorFit({ assetId, sample }: CharacterInspectorFitProps) {
  const state = useCharacterFit(assetId, sample)
  const fault = sample ? rigFitFaultOf(sample.bounds) : null
  if (fault) return <QuietNote>{state.t(`inspector.rigFault_${fault}`)}</QuietNote>
  if (!sample) return null

  return (
    <>
      {fitSelectors(state)}
      {fitNotices(state)}
      <Button disabled={!HUMANOID_KINDS.includes(state.kind) || state.fitting} onClick={state.fit}>
        {state.t('inspector.rigCreate')}
      </Button>
    </>
  )
}
