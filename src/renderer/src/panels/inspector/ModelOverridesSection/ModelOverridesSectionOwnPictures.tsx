import { useTranslation } from 'react-i18next'
import type { Asset } from '@shared/domain/asset'
import type { ModelRef, TextureRef, TextureSlot } from '@shared/domain/scene'
import { slotForChannel } from '@shared/domain/texture'
import { Button } from '@/design/Button'
import { HINT_LEFT } from '@/helpers/tooltip'
import { useDerivedTextures } from '@/hooks/useDerivedTextures'
import { hasChannel } from '@/spaces/textures/openModelMaterial'

/**
 * Points every slot at the pictures extraction took out of this model's own file — the link
 * « edit the picture and the model follows » hangs on, a model otherwise wearing maps baked into
 * its `.glb` that no edit of the project can reach.
 *
 * Its own component so the fold UNMOUNTS the catalogue query with it, exactly as
 * `ModelTexturesSectionList` is: read from the section around it, the question would be asked
 * for a panel nobody opened.
 */
export function ModelOverridesSectionOwnPictures({
  assetId,
  textures,
  onChange,
}: {
  assetId: string
  /** What the slots hold now: the model's own pictures land OVER them, never instead of them. */
  textures: ModelRef['textures']
  onChange: (textures: ModelRef['textures']) => void
}) {
  const { t } = useTranslation()
  const own = ownPictures(useDerivedTextures(assetId))

  if (!own) return null

  return (
    <Button
      {...HINT_LEFT(t('inspector.useModelPicturesHint'))}
      onClick={() => onChange({ ...textures, ...own })}
    >
      {t('inspector.useModelPictures')}
    </Button>
  )
}

/**
 * `undefined` rather than a set whenever the answer would be a guess: no picture dresses a slot,
 * or two claim the same one — a `.glb` of two materials yields two base colours, and this
 * document has no name to hang a per-material override on (`ModelRef.textures`).
 */
function ownPictures(derived: readonly Asset[]): ModelRef['textures'] {
  const slots: Partial<Record<TextureSlot, TextureRef>> = {}

  for (const picture of derived) {
    if (!hasChannel(picture)) continue
    const slot = slotForChannel(picture.map)
    if (!slot) continue
    if (slots[slot]) return undefined
    slots[slot] = { assetId: picture.id }
  }

  return Object.keys(slots).length > 0 ? slots : undefined
}
