import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { HUMANOID_ROLES, isHumanoidRole, type HumanoidRole } from '@shared/domain/humanoid'
import type { DisplayUnit } from '@shared/domain/scene'
import { toDegrees, toRadians } from '@shared/domain/angles'
import { displayStep, fromDisplayLength, toDisplayLength } from '@shared/domain/units'
import { IDENTITY_TRANSFORM, type Transform, type Vector3 } from '@shared/domain/transform'
import { Button } from '@/components/Button'
import { InlineRename } from '@/components/InlineRename'
import { Panel } from '@/components/Panel'
import { PropertyRow } from '@/components/PropertyRow'
import { PropertySection } from '@/components/PropertySection'
import { QuietNote } from '@/components/QuietNote'
import { SelectField } from '@/components/SelectField'
import { VectorField } from '@/components/VectorField'
import {
  addCharacterBone,
  addCharacterHands,
  addCharacterIkChain,
  removeCharacterBone,
  removeCharacterIkChain,
  renameCharacterBone,
  setCharacterBoneRest,
  setCharacterBoneRole,
} from '@/engines/character/characterCommands'
import { restWithin } from '@/engines/character/boneRest'
import { rigHandBones } from '@/engines/scene/rigFit'
import type { MeshSample } from '@/engines/scene/rigSnap'
import { CharacterMotionList } from '../Character/Motion/CharacterMotionList'
import { CharacterWindowFit } from './CharacterWindowFit'
import { characterOf, useCharacters } from '@/stores/character'
import { HINT_LEFT } from '@/helpers/tooltip'
import { useViewportSetting } from '@/hooks/useViewportSetting'
import { useCharacterView } from '@/stores/characterView'

export type CharacterWindowInspectorProps = {
  assetId: string
  /** The workshop scene this window drives, which is where a motion is tried out. */
  documentId: string
  nodeId: string
  /** What the engine measured of the mesh, for the rigger that fits itself to it. */
  sample: MeshSample | null
}

/**
 * What this character is made of — its bones, their roles, what reaches for what.
 *
 * Nothing of a scene: no transform, no shadow, no environment. That separation is the whole
 * reason this window exists.
 */
export function CharacterWindowInspector({
  assetId,
  sample,
  documentId,
  nodeId,
}: CharacterWindowInspectorProps) {
  const { t } = useTranslation()
  const character = useCharacters(state => characterOf(state, assetId))
  const picked = useCharacterView(state => state.pickedBone)
  const heldAxes = useCharacterView(state => state.heldAxes)
  const lockedLengths = useCharacterView(state => state.lockedLengths)
  const holdAxis = useCharacterView(state => state.holdCharacterAxis)
  const run = useCharacters(state => state.runCommand)
  const [renaming, setRenaming] = useState(false)
  // The studio's own unit, exactly as a scene's transform section reads it: a joint measured in
  // metres in one window and in centimetres in the other is two answers to one question.
  const unit = useViewportSetting().view.units

  const rig = character.rig
  const reaching = rig?.ik?.find(chain => chain.effector === picked)

  /** The same holds the gizmo obeys: what a padlock refuses, a keystroke must refuse too. */
  const restedAt = (next: Partial<Transform>): void => {
    if (!picked || !rig) return

    const rested = restOf(rig.bones, picked)
    const within = restWithin(rested, { ...rested, ...next }, { heldAxes, lockedLengths })
    run(assetId, setCharacterBoneRest(picked, within))
  }

  const moveBone = (shown: Vector3): void => restedAt({ position: inMetres(shown, unit) })
  const turnBone = (rotation: Vector3): void => restedAt({ rotation: radiansOf(rotation) })

  return (
    // On Tailwind's own scale rather than a number invented here, and wide enough for the one
    // row that decides it: three axis fields, their letters and the end column. At 320 px a
    // joint's offset read `-0` — the value cut, not the field.
    <Panel className="w-96 shrink-0">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <PropertySection title={t('character.skeleton')} scId="character.skeleton">
          {!rig && (
            <>
              <QuietNote>{t('inspector.rigStatus_staticMesh')}</QuietNote>
              <CharacterWindowFit assetId={assetId} sample={sample} />
            </>
          )}
          {rig && <QuietNote>{t('inspector.rigReady')}</QuietNote>}

          {rig && picked && (
            <>
              {/* Edited where it is read, on a double-click — the gesture every other name of
                  this studio answers, and the shape `AssetInspector` gives it.

                  🛑 Never a `TextField`, which is what a scene gives a NODE: a node is addressed
                  by its id, so renaming it on every keystroke is harmless, where a bone is
                  addressed by its NAME — the first letter typed renamed `Hips` to `H` and the
                  panel lost the joint it was editing. */}
              <PropertyRow label={t('inspector.boneName')}>
                {renaming ? (
                  <InlineRename
                    value={picked}
                    label={t('inspector.boneName')}
                    gauge="inline"
                    onCommit={to => {
                      setRenaming(false)
                      run(assetId, renameCharacterBone(picked, to))
                    }}
                  />
                ) : (
                  // The hint explains rather than repeats — the name is already on screen, and
                  // what is not is that a double-click opens it.
                  <span
                    className="block w-full truncate"
                    onDoubleClick={() => setRenaming(true)}
                    {...HINT_LEFT(t('inspector.boneNameHint'))}
                  >
                    {picked}
                  </span>
                )}
              </PropertyRow>

              {/* The joint's own place and turn, in its parent's frame — the same fields a
                  scene gives a node, padlock and reset included: a knee put right by eye is a
                  knee nobody can put back, and a joint dragged freely drifts on every axis. */}
              <VectorField
                label={t('inspector.position', { unit: t(`environment.unit_${unit}`) })}
                value={shownLength(restOf(rig.bones, picked).position, unit)}
                step={displayStep(unit)}
                onChange={next => moveBone(next)}
                defaults={IDENTITY_TRANSFORM.position}
                heldAxes={heldAxes}
                onHoldAxis={holdAxis}
                scId="character.bonePosition"
              />

              <VectorField
                label={t('inspector.rotation')}
                value={degreesOf(restOf(rig.bones, picked).rotation)}
                onChange={next => turnBone(next)}
                defaults={IDENTITY_TRANSFORM.rotation}
                heldAxes={heldAxes}
                onHoldAxis={holdAxis}
                scId="character.boneRotation"
              />

              {/* The roles keep the standard's own spelling, untranslated: these are the
                  identifiers of the Mixamo set, and the mapping screen shows them as such. */}
              <SelectField
                label={t('inspector.boneRole')}
                value={roleOf(rig.bones, picked) ?? ''}
                options={[
                  { value: '', label: t('inspector.boneNoRole') },
                  ...HUMANOID_ROLES.map(role => ({ value: role, label: role })),
                ]}
                onChange={role => run(assetId, setCharacterBoneRole(picked, roleRead(role)))}
                scId="character.boneRole"
              />

              <Button onClick={() => run(assetId, addCharacterBone(picked))}>
                {t('inspector.addBone')}
              </Button>
              <Button onClick={() => run(assetId, removeCharacterBone(picked))}>
                {t('inspector.removeBone')}
              </Button>

              {/* A handle the joint reaches for: the bones above it turn to follow, which is what
                  puts a foot on the ground and a hand on a grip. */}
              {reaching ? (
                <Button onClick={() => run(assetId, removeCharacterIkChain(reaching.id))}>
                  {t('inspector.removeHandle')}
                </Button>
              ) : (
                <Button onClick={() => run(assetId, addCharacterIkChain(picked))}>
                  {t('inspector.addHandle')}
                </Button>
              )}
            </>
          )}

          {rig && rigHandBones(rig.bones) && (
            <Button onClick={() => run(assetId, addCharacterHands())}>
              {t('inspector.addHands')}
            </Button>
          )}
        </PropertySection>

        <PropertySection title={t('character.motions')} scId="character.motions">
          <CharacterMotionList assetId={assetId} documentId={documentId} nodeId={nodeId} />
        </PropertySection>
      </div>
    </Panel>
  )
}

function roleOf(
  bones: readonly { name: string; role?: HumanoidRole }[],
  bone: string,
): HumanoidRole | undefined {
  return bones.find(one => one.name === bone)?.role
}

/** Cast-free: an empty option means « fills none », and anything else is one of the fifty-two. */
function roleRead(value: string): HumanoidRole | null {
  return isHumanoidRole(value) ? value : null
}

/** Where a bone rests, or the identity for a name the rig has not got. */
function restOf(bones: readonly { name: string; rest: Transform }[], bone: string): Transform {
  return bones.find(one => one.name === bone)?.rest ?? IDENTITY_TRANSFORM
}

function shownLength(vector: Vector3, unit: DisplayUnit): Vector3 {
  return {
    x: toDisplayLength(vector.x, unit),
    y: toDisplayLength(vector.y, unit),
    z: toDisplayLength(vector.z, unit),
  }
}

function inMetres(vector: Vector3, unit: DisplayUnit): Vector3 {
  return {
    x: fromDisplayLength(vector.x, unit),
    y: fromDisplayLength(vector.y, unit),
    z: fromDisplayLength(vector.z, unit),
  }
}

function degreesOf(vector: Vector3): Vector3 {
  return { x: toDegrees(vector.x), y: toDegrees(vector.y), z: toDegrees(vector.z) }
}

function radiansOf(vector: Vector3): Vector3 {
  return { x: toRadians(vector.x), y: toRadians(vector.y), z: toRadians(vector.z) }
}
