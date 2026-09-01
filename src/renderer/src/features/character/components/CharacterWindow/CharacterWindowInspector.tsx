import { useTranslation } from 'react-i18next'
import { HUMANOID_ROLES, isHumanoidRole, type HumanoidRole } from '@shared/domain/humanoid'
import { Button } from '@/components/Button'
import { InlineRename } from '@/components/InlineRename'
import { Panel } from '@/components/Panel'
import { PropertyRow } from '@/components/PropertyRow'
import { PropertySection } from '@/components/PropertySection'
import { QuietNote } from '@/components/QuietNote'
import { SelectField } from '@/components/SelectField'
import {
  addCharacterBone,
  addCharacterHands,
  addCharacterIkChain,
  removeCharacterBone,
  removeCharacterIkChain,
  renameCharacterBone,
  setCharacterBoneRole,
} from '@/engines/character/characterCommands'
import { rigHandBones, type Bounds } from '@/engines/scene/rigFit'
import { CharacterMotionList } from '../Character/Motion/CharacterMotionList'
import { CharacterWindowFit } from './CharacterWindowFit'
import { characterOf, useCharacters } from '@/stores/character'
import { useCharacterView } from '@/stores/characterView'

export type CharacterWindowInspectorProps = {
  assetId: string
  /** The workshop scene this window drives, which is where a motion is tried out. */
  documentId: string
  nodeId: string
  /** What the engine measured of the mesh, for the rigger that proportions itself off it. */
  bounds: Bounds | null
}

/**
 * What this character is made of — its bones, their roles, what reaches for what.
 *
 * Nothing of a scene: no transform, no shadow, no environment. That separation is the whole
 * reason this window exists.
 */
export function CharacterWindowInspector({
  assetId,
  bounds,
  documentId,
  nodeId,
}: CharacterWindowInspectorProps) {
  const { t } = useTranslation()
  const character = useCharacters(state => characterOf(state, assetId))
  const picked = useCharacterView(state => state.pickedBone)
  const run = useCharacters(state => state.runCommand)

  const rig = character.rig
  const reaching = rig?.ik?.find(chain => chain.effector === picked)

  return (
    <Panel className="w-[320px] shrink-0">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <PropertySection title={t('character.skeleton')} scId="character.skeleton">
          {!rig && (
            <>
              <QuietNote>{t('inspector.rigStatus_staticMesh')}</QuietNote>
              <CharacterWindowFit assetId={assetId} bounds={bounds} />
            </>
          )}
          {rig && <QuietNote>{t('inspector.rigReady')}</QuietNote>}

          {rig && picked && (
            <>
              {/* Renamed where it is read, as a layer and a track are: a rig arrives with the
                  names its file spells, and `mixamorigHips` is not one anybody chose. */}
              <PropertyRow label={t('inspector.boneName')}>
                <InlineRename
                  value={picked}
                  label={t('inspector.boneName')}
                  gauge="inline"
                  onCommit={to => run(assetId, renameCharacterBone(picked, to))}
                />
              </PropertyRow>

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
