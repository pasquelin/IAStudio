import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/design/Button'
import { Flyout } from '@/design/Flyout'
import { InlineRename } from '@/design/InlineRename'
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
  renameRigBone,
  setModelRig,
  setRigBoneRole,
} from '@/engines/scene/commands'
import { HUMANOID_ROLES, isHumanoidRole, type HumanoidRole } from '@shared/domain/humanoid'
import type { RigBone } from '@shared/domain/rig'
import { IDENTITY_TRANSFORM, type ModelNode } from '@/engines/scene/sceneState'
import { sceneViewOf, useSceneViews } from '@/stores/sceneViews'
import type { SceneEdit } from '@/hooks/useSceneEdit'
import { providersRefusalOf, rigProvidersOf } from '@shared/domain/rigProvider'
import { formatBytes } from '@/helpers/format'
import { rigServiceNote } from '@/helpers/rigServiceNote'
import { useFamilyModels } from '@/hooks/useFamilyModels'
import { useMeshSizeLimit } from '@/hooks/useMeshSizeLimit'
import { usePlanAccess } from '@/hooks/usePlanAccess'
import { assetsById, useAssets } from '@/stores/assets'
import { rigOfNode, rigProgressOfNode, useModelClips } from '@/stores/modelClips'

/** What is being made animatable. The studio's own rigger only knows the first two. */
export type CharacterKind = 'auto' | 'human' | 'animal' | 'other'

export const CHARACTER_KINDS: readonly CharacterKind[] = ['auto', 'human', 'animal', 'other']

/** The kinds a bounding box can be fitted with a skeleton — see `rigFit`, which is humanoid. */
const HUMANOID_KINDS: readonly CharacterKind[] = ['auto', 'human']

const characterKindRead = (value: string): CharacterKind =>
  CHARACTER_KINDS.find(kind => kind === value) ?? 'auto'

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
  const [asking, setAsking] = useState(false)
  const [opener, setOpener] = useState<HTMLButtonElement | null>(null)
  const [kind, setKind] = useState<CharacterKind>('auto')
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
  const refusal = providersRefusalOf(services, plan, { bytes, maxSize })
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

  /**
   * A bone renamed, and the pick carried over to the new name — the whole rig re-binds, and a
   * pick left on a name nobody answers to would grey every control below it.
   *
   * A name already taken is refused HERE rather than by the command: `renameRigBone` writes
   * nothing for a duplicate, and the pick would then follow a rename that never happened.
   */
  const renameBone = (name: string): void => {
    if (!picked || node.model.rig?.bones.some(bone => bone.name === name)) return

    edit.run(renameRigBone(node.id, picked, name))
    useSceneViews.getState().setPickedBone(documentId, { nodeId: node.id, bone: name })
  }

  return (
    <PropertySection title={t('inspector.rig')}>
      {progress !== null && <ProgressBar ratio={progress} label={t('inspector.rigBinding')} />}

      {progress === null && fault && <QuietNote>{t(`inspector.rigFault_${fault}`)}</QuietNote>}

      {progress === null && bounds && !fault && !node.model.rig && (
        <>
          <Button ref={setOpener} variant="primary" onClick={() => setAsking(!asking)}>
            {t('inspector.makeAnimatable')}
          </Button>

          {/* Beside the button and never under it: `under` takes the anchor's own width and
              clamps nothing vertically, so the dialogue came out button-wide and cut off by the
              bottom of the window — seen on screen, at the foot of the inspector. */}
          {asking && (
            <Flyout anchor={opener} onDismiss={() => setAsking(false)}>
              <div className="flex w-72 flex-col gap-2 p-2">
                <PropertyRow label={t('inspector.characterKind')}>
                  <select
                    aria-label={t('inspector.characterKind')}
                    value={kind}
                    onChange={event => setKind(characterKindRead(event.target.value))}
                    className={cn(NATIVE_SELECT, 'w-full')}
                  >
                    {CHARACTER_KINDS.map(candidate => (
                      <option key={candidate} value={candidate}>
                        {t(`inspector.characterKinds.${candidate}`)}
                      </option>
                    ))}
                  </select>
                </PropertyRow>

                {/* Every service is shown and none can be chosen: submitting one needs the whole
                    export-upload-job-import chain, which nothing here can verify. */}
                <PropertyRow label={t('inspector.rigService')}>
                  {/* Uncontrolled, and nothing can move it: every other option is disabled, so
                      there is no change to answer for. */}
                  <select
                    aria-label={t('inspector.rigService')}
                    defaultValue=""
                    className={cn(NATIVE_SELECT, 'w-full')}
                  >
                    <option value="">{t('inspector.rigServiceLocal')}</option>
                    {services.map(service => (
                      <option key={service.modelId} value={service.modelId} disabled>
                        {`${service.name} — ${rigServiceNote(service, plan, { bytes, maxSize }, t)}`}
                      </option>
                    ))}
                  </select>
                </PropertyRow>

                {/* The studio's own rigger lays a HUMANOID skeleton — hips, spine, four limbs.
                    Saying so beats laying one on a horse and letting the user find out. */}
                {!HUMANOID_KINDS.includes(kind) && (
                  <QuietNote>{t('inspector.rigNotHumanoid')}</QuietNote>
                )}

                <div className="flex justify-end gap-2">
                  <Button onClick={() => setAsking(false)}>{t('inspector.animationCancel')}</Button>
                  <Button
                    variant="primary"
                    disabled={!HUMANOID_KINDS.includes(kind)}
                    onClick={() => {
                      edit.run(setModelRig(node.id, rigFit(bounds)))
                      setAsking(false)
                    }}
                  >
                    {t('inspector.rigCreate')}
                  </Button>
                </div>
              </div>
            </Flyout>
          )}
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
              {/* Renamed where it is read, as a layer and a track are. A rig arrives with the
                  names its file spells, and `mixamorigHips` is not one anybody chose. */}
              <PropertyRow label={t('inspector.boneName')}>
                <InlineRename
                  value={picked}
                  label={t('inspector.boneName')}
                  gauge="inline"
                  onCommit={name => renameBone(name)}
                />
              </PropertyRow>

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
