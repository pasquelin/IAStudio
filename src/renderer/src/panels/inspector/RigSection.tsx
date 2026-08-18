import { useTranslation } from 'react-i18next'
import { Button } from '@/design/Button'
import { ProgressBar } from '@/design/ProgressBar'
import { PropertyRow } from '@/design/PropertyRow'
import { PropertySection } from '@/design/PropertySection'
import { QuietNote } from '@/design/QuietNote'
import { NATIVE_SELECT } from '@/design/styles'
import { cn } from '@/helpers/cn'
import { rigFit, rigFitFaultOf, rigHandBones } from '@/engines/scene/rigFit'
import {
  addIkChain,
  addRigBone,
  addRigHands,
  removeIkChain,
  removeRigBone,
  setModelRig,
  setRigBoneRole,
} from '@/engines/scene/commands'
import { HUMANOID_ROLES, isHumanoidRole, type HumanoidRole } from '@shared/domain/humanoid'
import type { RigBone } from '@shared/domain/rig'
import { IDENTITY_TRANSFORM, type ModelNode } from '@/engines/scene/sceneState'
import { sceneViewOf, useSceneViews } from '@/stores/sceneViews'
import type { SceneEdit } from '@/hooks/useSceneEdit'
import type { PlanAccess } from '@shared/domain/plan'
import {
  rigProvidersOf,
  rigRefusalOf,
  type RigProvider,
  type RigRefusal,
} from '@shared/domain/rigProvider'
import { formatBytes } from '@/helpers/format'
import { useFamilyModels } from '@/hooks/useFamilyModels'
import { useMeshSizeLimit } from '@/hooks/useMeshSizeLimit'
import { usePlanAccess } from '@/hooks/usePlanAccess'
import { assetsById, useAssets } from '@/stores/assets'
import { rigOfNode, rigProgressOfNode, useModelClips } from '@/stores/modelClips'

/**
 * Why no Scenario service can rig this, or nothing at all when one of them could.
 *
 * The mesh is WEIGHED — that is what lets the answer be « too big for the limit » rather than
 * always the subscription: a plan that allows a rigger still refuses a file above its `maxSize`,
 * and hearing it after minutes of upload is the failure this exists to avoid.
 *
 * `null` for « one is within reach », and equally for a catalogue that answered nothing at all:
 * offline is not a subscription being short.
 */
function rigServicesRefusalOf(
  providers: readonly RigProvider[],
  plan: PlanAccess | null,
  mesh: { bytes: number; maxSize?: number },
): RigRefusal | null {
  if (providers.length === 0) return null

  const refusals = providers.map(provider => rigRefusalOf(provider, plan, mesh))
  // The first one, since they all refuse: one sentence rather than a list nobody reads.
  return refusals.every(refusal => refusal !== null) ? (refusals[0] ?? null) : null
}

export type RigSectionProps = {
  documentId: string
  node: ModelNode
  edit: SceneEdit
}

/**
 * Making a bare mesh animatable, without saying « rig » once.
 *
 * The whole operation is local and free, so there is no cost dialogue and nothing to confirm: the
 * click writes a skeleton into the document, and the engine works out the weights from it.
 */
export function RigSection({ documentId, node, edit }: RigSectionProps) {
  const { t, i18n } = useTranslation()
  const rig = useModelClips(state => rigOfNode(state, documentId, node.id))
  const progress = useModelClips(state => rigProgressOfNode(state, documentId, node.id))
  const plan = usePlanAccess()
  // Asked for ONLY where the note could be drawn — on a bare mesh. Every other model selection
  // was sending a listing and a schema read to say nothing at all; seen in the log, on screen.
  const offering = rig?.status === 'staticMesh' && !node.model.rig
  const services = rigProvidersOf(useFamilyModels(offering ? '3d' : null))
  // The mesh is weighed against the limit of the service that would take it, and against that
  // one only: asking every model's schema to draw one line would be a call per row.
  const maxSize = useMeshSizeLimit(services[0]?.modelId ?? null)
  const bytes = useAssets(state => assetsById(state).get(node.model.assetId)?.bytes ?? 0)
  const refusal = rigServicesRefusalOf(services, plan, { bytes, maxSize })
  // The bone the pose mode picked, and only when it belongs to THIS model: the inspector shows
  // one node, and editing a bone of another from here would be silent nonsense.
  const held = useSceneViews(state => sceneViewOf(state, documentId).pickedBone)
  const picked = held?.nodeId === node.id ? held.bone : null
  const reaching = node.model.rig?.ik?.find(chain => chain.effector === picked)

  // Only where the studio has something to offer: a model that already carries a skeleton of its
  // own is never offered another, and one still loading has nothing to measure.
  if (!rig || (rig.status !== 'staticMesh' && !node.model.rig)) return null

  // Held so the `onClick` closure narrows: a property access does not stay narrowed inside one.
  const bounds = rig.bounds
  const fault = bounds && rigFitFaultOf(bounds)

  return (
    <PropertySection title={t('inspector.rig')}>
      {progress !== null && <ProgressBar ratio={progress} label={t('inspector.rigBinding')} />}

      {progress === null && fault && <QuietNote>{t(`inspector.rigFault_${fault}`)}</QuietNote>}

      {progress === null && bounds && !fault && !node.model.rig && (
        <>
          <Button variant="primary" onClick={() => edit.run(setModelRig(node.id, rigFit(bounds)))}>
            {t('inspector.makeAnimatable')}
          </Button>
          {/* Said BEFORE any click, never discovered as a 403 nor after minutes of upload: on
              this account every service refuses, and the studio's own rigger runs either way. */}
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
        </>
      )}

      {progress === null && node.model.rig && (
        <>
          <QuietNote>{t('inspector.rigReady')}</QuietNote>

          {picked && (
            <>
              <PropertyRow label={t('inspector.boneRole')}>
                {/* The standard's own spelling, untranslated and deliberately so: these are the
                    identifiers of the Mixamo set, and the issue's mapping screen shows them as
                    such. Advanced mode is the only place they appear. */}
                <select
                  aria-label={t('inspector.boneRole')}
                  value={roleOf(node, picked) ?? ''}
                  onChange={event =>
                    edit.run(setRigBoneRole(node.id, picked, roleRead(event.target.value)))
                  }
                  className={cn(NATIVE_SELECT, 'w-full')}
                >
                  <option value="">{t('inspector.boneNoRole')}</option>
                  {HUMANOID_ROLES.map(role => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </PropertyRow>

              <Button onClick={() => edit.run(addRigBone(node.id, childBone(picked, node)))}>
                {t('inspector.addBone')}
              </Button>
              <Button onClick={() => edit.run(removeRigBone(node.id, picked))}>
                {t('inspector.removeBone')}
              </Button>

              {/* A handle the joint reaches for: the two bones above it turn to follow, which is
                  what puts a foot on the ground and a hand on a grip. */}
              {reaching ? (
                <Button onClick={() => edit.run(removeIkChain(node.id, reaching.id))}>
                  {t('inspector.removeHandle')}
                </Button>
              ) : (
                <Button onClick={() => edit.run(addIkChain(node.id, picked))}>
                  {t('inspector.addHandle')}
                </Button>
              )}
            </>
          )}

          {rigHandBones(node.model.rig.bones) && (
            <Button onClick={() => edit.run(addRigHands(node.id))}>
              {t('inspector.addHands')}
            </Button>
          )}

          <Button onClick={() => edit.run(setModelRig(node.id, null))}>
            {t('inspector.removeRig')}
          </Button>
        </>
      )}
    </PropertySection>
  )
}

function roleOf(node: ModelNode, bone: string): HumanoidRole | undefined {
  return node.model.rig?.bones.find(one => one.name === bone)?.role
}

/** Cast-free: an empty option means « fills none », and anything else has to be one of the fifty-two. */
function roleRead(value: string): HumanoidRole | null {
  return isHumanoidRole(value) ? value : null
}

/**
 * A bone hung under the picked one, resting exactly ON it — the gizmo is what puts it where it
 * belongs, which is the same contract « add the hands » works under.
 *
 * Named after its parent rather than from a word, so a document written in one language reads
 * the same in another, and so the name is free without a counter to keep.
 */
function childBone(parent: string, node: ModelNode): RigBone {
  const taken = new Set(node.model.rig?.bones.map(one => one.name))
  let name = `${parent}.1`
  for (let index = 2; taken.has(name); index += 1) name = `${parent}.${index}`

  return { name, parent, rest: IDENTITY_TRANSFORM }
}
