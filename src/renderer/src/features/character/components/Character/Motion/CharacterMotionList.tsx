import { mdiClose } from '@mdi/js'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ClipSource } from '@shared/domain/scene'
import { INLINE_LINK } from '@/components/styles'
import { hasMotion } from '@/character/characterMotion'
import { sceneOf, useScenes } from '@/stores/scenes'
import { QuietNote } from '@/components/QuietNote'
import { ToolButton } from '@/components/ToolButton'
import { linkCharacterMotion, unlinkCharacterMotion } from '@/engines/character/characterCommands'
import { newId } from '@/helpers/ids'
import { TIP_LEFT } from '@/helpers/tooltip'
import { characterOf, useCharacters } from '@/stores/character'
import { CharacterMotionPicker } from './CharacterMotionPicker'

export type CharacterMotionListProps = {
  assetId: string
  /** The workshop scene this window drives, which is where a motion is tried out. */
  documentId: string
  nodeId: string
  /** Files what the band plays. Absent where nothing can export it. */
  onSave?: () => Promise<void>
}

/**
 * What this character knows how to play.
 *
 * 🛑 References, never copies: a motion is a file of its own, playable by every character whose
 * bones carry the same names — swallowing one into a `.glb` would take it from the others.
 */
export function CharacterMotionList({
  assetId,
  documentId,
  nodeId,
  onSave,
}: CharacterMotionListProps) {
  const { t } = useTranslation()
  const motions = useCharacters(state => characterOf(state, assetId).motions)
  const played = useScenes(state => hasMotion(sceneOf(state, documentId).animation))
  const [open, setOpen] = useState(false)
  const [opener, setOpener] = useState<HTMLElement | null>(null)

  const keep = (source: ClipSource, label: string): void => {
    if (source.kind !== 'asset') return

    useCharacters
      .getState()
      .runCommand(
        assetId,
        linkCharacterMotion({ id: newId(), name: label, assetId: source.assetId }),
      )
  }

  return (
    <>
      {motions.length === 0 && <QuietNote>{t('character.motionEmpty')}</QuietNote>}

      {motions.map(motion => (
        <div key={motion.id} className="flex items-center justify-between gap-2">
          <span className="truncate">{motion.name}</span>
          <ToolButton
            icon={mdiClose}
            label={t('character.motionRemove')}
            tooltip={TIP_LEFT}
            variant="header"
            onClick={() =>
              useCharacters.getState().runCommand(assetId, unlinkCharacterMotion(motion.id))
            }
          />
        </div>
      ))}

      {/* Only once the band holds a key: a file claiming a motion it does not have is worse
          than no file. What it writes is a motion of the PROJECT, playable by any character. */}
      {played && onSave && (
        <button type="button" className={INLINE_LINK} onClick={() => void onSave()}>
          {t('character.motionSave')}
        </button>
      )}

      <button ref={setOpener} type="button" className={INLINE_LINK} onClick={() => setOpen(!open)}>
        {t('character.motionAdd')}
      </button>

      {open && (
        <CharacterMotionPicker
          documentId={documentId}
          nodeId={nodeId}
          anchor={opener}
          laid={null}
          onChoose={keep}
          onKeep={() => setOpen(false)}
          onCancel={() => setOpen(false)}
        />
      )}
    </>
  )
}
