import { mdiClose, mdiPencilOutline } from '@mdi/js'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { MotionRef } from '@shared/domain/character'
import type { ClipSource } from '@shared/domain/scene'
import { INLINE_LINK } from '@/components/styles'
import { hasMotion, reopenCharacterMotion } from '@/character/characterMotion'
import { reportFailure } from '@/services/diagnostics'
import { sceneOf, useScenes } from '@/stores/scenes'
import { QuietNote } from '@/components/QuietNote'
import { ToolButton } from '@/components/ToolButton'
import { linkCharacterMotion, unlinkCharacterMotion } from '@/engines/character/characterCommands'
import { newId } from '@/helpers/ids'
import { TIP_LEFT } from '@/helpers/tooltip'
import { animationViewOf, useAnimationViews } from '@/stores/animationView'
import { characterOf, useCharacters } from '@/stores/character'
import { CharacterMotionPicker } from './CharacterMotionPicker'

export type CharacterMotionListProps = {
  assetId: string
  /** The workshop scene this window drives, which is where a motion is tried out. */
  documentId: string
  nodeId: string
  /**
   * Files what the band plays, over the motion being edited or as a new file. Absent where
   * nothing can export it.
   */
  onSave?: (asNew: boolean) => Promise<void>
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
  const openMotion = useAnimationViews(state => animationViewOf(state, documentId).openMotion)
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

  const reopen = async (motion: MotionRef): Promise<void> => {
    try {
      await reopenCharacterMotion(documentId, nodeId, motion.assetId)
    } catch (error) {
      reportFailure('assets.open', motion.name, error)
    }
  }

  return (
    <>
      {motions.length === 0 && <QuietNote>{t('character.motionEmpty')}</QuietNote>}

      {motions.map(motion => (
        <div key={motion.id} className="flex items-center justify-between gap-2">
          <span className="truncate">{motion.name}</span>
          <div className="flex shrink-0 items-center gap-0.5">
            <ToolButton
              icon={mdiPencilOutline}
              label={t('character.motionOpen', { name: motion.name })}
              description={t('character.motionOpenHint')}
              tooltip={TIP_LEFT}
              variant="header"
              active={openMotion === motion.assetId}
              onClick={() => void reopen(motion)}
            />
            <ToolButton
              icon={mdiClose}
              label={t('character.motionRemove')}
              tooltip={TIP_LEFT}
              variant="header"
              onClick={() => {
                // Let go of it FIRST: a bench still aimed at a motion the character no longer
                // knows would write the next save into a file nothing lists any more.
                if (openMotion === motion.assetId) {
                  useAnimationViews.getState().openMotion(documentId, null)
                }
                useCharacters.getState().runCommand(assetId, unlinkCharacterMotion(motion.id))
              }}
            />
          </div>
        </div>
      ))}

      {/* Only once the band holds a key: a file claiming a motion it does not have is worse
          than no file. What it writes is a motion of the PROJECT, playable by any character. */}
      {played && onSave && (
        <button type="button" className={INLINE_LINK} onClick={() => void onSave(false)}>
          {openMotion ? t('character.motionUpdate') : t('character.motionSave')}
        </button>
      )}

      {/* 🛑 The only way back off a reopened motion: without it the bench stays aimed at that
          file, and the NEXT movement posed here overwrites it rather than being filed. */}
      {played && onSave && openMotion && (
        <button type="button" className={INLINE_LINK} onClick={() => void onSave(true)}>
          {t('character.motionSaveNew')}
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
