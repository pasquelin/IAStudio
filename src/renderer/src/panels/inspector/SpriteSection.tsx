import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { SpriteDescriptor } from '@shared/domain/scene'
import type { GestureProps } from '@/design/styles'
import { spriteFields, withField } from '@/engines/scene/propertyFields'
import { PictureField } from './PictureField/PictureField'
import { DescriptorSection } from './DescriptorSection'

export type SpriteSectionProps = {
  sprite: SpriteDescriptor
  fallbackColor: string
  onChange: (sprite: SpriteDescriptor) => void
  gesture: GestureProps
}

/** What a sprite draws: one picture of the project, tinted and faded as the fields say. */
export function SpriteSection({ sprite, fallbackColor, onChange, gesture }: SpriteSectionProps) {
  const { t } = useTranslation()
  const fields = useMemo(() => spriteFields(sprite, fallbackColor), [sprite, fallbackColor])

  return (
    <DescriptorSection
      title={t('inspector.sprite')}
      fields={fields}
      onChange={(name, value) => onChange(withField(sprite, name, value))}
      gesture={gesture}
      scId="sprite"
    >
      <PictureField
        label={t('inspector.spriteImage')}
        value={sprite.map?.assetId ?? null}
        onChange={assetId => onChange({ ...sprite, map: assetId === null ? null : { assetId } })}
        scId="sprite.map"
      />
    </DescriptorSection>
  )
}
