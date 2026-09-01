import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ANIMATION_EXTENSIONS } from '@shared/domain/animationLibrary'
import { extensionOf } from '@shared/domain/fileName'
import type { ClipSource } from '@shared/domain/scene'
import { Button } from '../../../../../components/Button'
import { QuietNote } from '../../../../../components/QuietNote'
import { getBridge } from '@/services/bridge'

export type AnimationPickerImportProps = {
  onChoose: (source: ClipSource, label: string) => void
}

/**
 * A motion brought in from disk — Mixamo exports FBX and Collada and no glTF at all, which is why
 * the accepted set is wider than the studio's own. LINKED rather than copied, as every import is,
 * so what is chosen downstream is an ordinary asset.
 */
export function AnimationPickerImport({ onChoose }: AnimationPickerImportProps) {
  const { t } = useTranslation()
  const [refused, setRefused] = useState(false)

  const bring = async (): Promise<void> => {
    setRefused(false)
    const brought = (await getBridge()?.media.ingest()) ?? []
    // What was chosen and could carry a clip. A picture picked by mistake is refused HERE, where
    // the reason can be said, rather than at the drop where nothing would happen at all.
    const motion = brought.find(asset =>
      ANIMATION_EXTENSIONS.includes(extensionOf(asset.path ?? asset.name).toLowerCase()),
    )
    if (!motion) {
      setRefused(brought.length > 0)
      return
    }

    onChoose({ kind: 'asset', assetId: motion.id, name: motion.name }, motion.name)
  }

  return (
    <div className="flex flex-col gap-2 p-2">
      <QuietNote>
        {t('inspector.animationImportHint', { formats: ANIMATION_EXTENSIONS.join(' · ') })}
      </QuietNote>
      <Button onClick={() => void bring()}>{t('inspector.animationImportPick')}</Button>
      {refused && <QuietNote>{t('inspector.animationImportRefused')}</QuietNote>}
    </div>
  )
}
