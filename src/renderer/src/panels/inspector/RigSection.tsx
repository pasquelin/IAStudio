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
  addRigBone,
  addRigHands,
  removeRigBone,
  setModelRig,
  setRigBoneRole,
} from '@/engines/scene/commands'
import { HUMANOID_ROLES, isHumanoidRole, type HumanoidRole } from '@shared/domain/humanoid'
import type { RigBone } from '@shared/domain/rig'
import { IDENTITY_TRANSFORM, type ModelNode } from '@/engines/scene/sceneState'
import { sceneViewOf, useSceneViews } from '@/stores/sceneViews'
import type { SceneEdit } from '@/hooks/useSceneEdit'
import type { ModelSummary } from '@shared/domain/model'
import type { PlanAccess } from '@shared/domain/plan'
import { rigProvidersOf, rigRefusalOf } from '@shared/domain/rigProvider'
import { useFamilyModels } from '@/hooks/useFamilyModels'
import { usePlanAccess } from '@/hooks/usePlanAccess'
import { rigOfNode, rigProgressOfNode, useModelClips } from '@/stores/modelClips'

/**
 * The plan to name when Scenario could rig this and the subscription will not let it, or
 * nothing at all — nothing being both « every service is within reach » and « the plan could not
 * be read », which greys nothing out on purpose.
 */
function lockedRigPlanOf(models: readonly ModelSummary[], plan: PlanAccess | null): string | null {
  // Zero bytes: the mesh has not been weighed, so only the plan can refuse here. A size is what
  // the gesture that actually uploads one has to ask `rigRefusalOf` again with.
  const providers = rigProvidersOf(models)
  const reachable = providers.filter(
    provider => rigRefusalOf(provider, plan, { bytes: 0 }) === null,
  )
  // No provider at all is offline or unauthenticated, never a refusal: an empty catalogue must
  // not read as « your subscription is short ».
  if (!plan || providers.length === 0 || reachable.length > 0) return null

  return plan.name
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
  const { t } = useTranslation()
  const rig = useModelClips(state => rigOfNode(state, documentId, node.id))
  const progress = useModelClips(state => rigProgressOfNode(state, documentId, node.id))
  const locked = lockedRigPlanOf(useFamilyModels('3d'), usePlanAccess())
  // The bone the pose mode picked, and only when it belongs to THIS model: the inspector shows
  // one node, and editing a bone of another from here would be silent nonsense.
  const held = useSceneViews(state => sceneViewOf(state, documentId).pickedBone)
  const picked = held?.nodeId === node.id ? held.bone : null

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
          {/* Said BEFORE any click, never discovered as a 403: on this account all six services
              refuse, and the studio's own rigger is what runs either way. */}
          {locked && <QuietNote>{t('inspector.rigServicesLocked', { plan: locked })}</QuietNote>}
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
