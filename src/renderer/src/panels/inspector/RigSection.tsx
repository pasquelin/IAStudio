import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/Button'
import { Flyout } from '@/components/Flyout'
import { InlineRename } from '@/components/InlineRename'
import { ProgressBar } from '@/components/ProgressBar'
import { PropertyRow } from '@/components/PropertyRow'
import { PropertySection } from '@/components/PropertySection'
import { QuietNote } from '@/components/QuietNote'
import { SelectField } from '@/components/SelectField'
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
import { childBone } from '@shared/domain/rig'
import type { ModelNode } from '@/engines/scene/sceneState'
import { sceneViewOf, useSceneViews } from '@/stores/sceneViews'
import type { SceneEdit } from '@/hooks/useSceneEdit'
import { providersRefusalOf, rigProvidersOf } from '@shared/domain/rigProvider'
import { formatBytes } from '@/helpers/format'
import { rigServiceNote } from '@/helpers/rigServiceNote'
import { useFamilyModels } from '@/hooks/useFamilyModels'
import { useMeshSizeLimit } from '@/hooks/useMeshSizeLimit'
import { usePlanAccess } from '@/hooks/usePlanAccess'
import { assetsById, useAssets } from '@/stores/assets'
import { rigOfNode, rigProgressOfNode, useModelFiles } from '@/stores/modelFiles'

/** What is being made animatable. The studio's own rigger only knows the first two. */
export type CharacterKind = 'auto' | 'human' | 'animal' | 'other'

export const CHARACTER_KINDS: readonly CharacterKind[] = ['auto', 'human', 'animal', 'other']

/** The kinds a bounding box can be fitted with a skeleton — see `rigFit`, which is humanoid. */
const HUMANOID_KINDS: readonly CharacterKind[] = ['auto', 'human']

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
  const rig = useModelFiles(state => rigOfNode(state, documentId, node.id))
  const progress = useModelFiles(state => rigProgressOfNode(state, documentId, node.id))
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
    <PropertySection title={t('inspector.rig')} scId="rig">
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
                <SelectField
                  label={t('inspector.characterKind')}
                  value={kind}
                  options={CHARACTER_KINDS.map(candidate => ({
                    value: candidate,
                    label: t(`inspector.characterKinds.${candidate}`),
                  }))}
                  onChange={setKind}
                  scId="rig.characterKind"
                />

                {/* Every service is shown and none can be chosen: submitting one needs the whole
                    export-upload-job-import chain, which nothing here can verify. */}
                {/* Every other option is disabled, so `onChange` is unreachable rather than
                    ignored: the list opens to say WHY each service is out of reach, which a
                    disabled control would hide. */}
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
                  scId="rig.service"
                />

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

              {/* The roles keep the standard's own spelling, untranslated and deliberately so:
                  these are the identifiers of the Mixamo set, and the mapping screen shows them
                  as such. Advanced mode is the only place they appear. */}
              <SelectField
                label={t('inspector.boneRole')}
                value={roleOf(node, picked) ?? ''}
                options={[
                  { value: '', label: t('inspector.boneNoRole') },
                  ...HUMANOID_ROLES.map(role => ({ value: role, label: role })),
                ]}
                onChange={role => edit.run(setRigBoneRole(node.id, picked, roleRead(role)))}
                scId="rig.boneRole"
              />

              <Button
                onClick={() =>
                  edit.run(addRigBone(node.id, childBone(node.model.rig?.bones ?? [], picked)))
                }
              >
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
