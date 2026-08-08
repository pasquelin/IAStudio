import { useTranslation } from 'react-i18next'
import { PropertySection } from '@/design/PropertySection'
import { ToggleField } from '@/design/ToggleField'
import { setShadowOn } from '@/engines/scene/commands'
import { canCastShadow, type SceneNode } from '@/engines/scene/scene-state'
import type { SceneEdit } from './useSceneEdit'

export type ShadowSectionProps = {
  node: SceneNode
  selection: readonly SceneNode[]
  edit: SceneEdit
}

/**
 * What a node does with light that is not its own: throws a shadow, catches the ones thrown at
 * it. Its own section rather than two more rows under Transform, which is where a node *is* —
 * a shadow is not a placement.
 */
export function ShadowSection({ node, selection, edit }: ShadowSectionProps) {
  const { t } = useTranslation()

  return (
    <PropertySection title={t('inspector.shadows')}>
      {/* An ambient or hemisphere light has no shadow camera: three.js would warn every frame. */}
      {canCastShadow(node) && (
        <ToggleField
          label={t('inspector.castShadow')}
          value={node.castShadow}
          onChange={value => edit.run(setShadowOn(selection, { castShadow: value }))}
        />
      )}

      {/* Meaningless on a light, which catches nothing: the row would be a switch with no effect. */}
      {node.type !== 'light' && (
        <ToggleField
          label={t('inspector.receiveShadow')}
          value={node.receiveShadow}
          onChange={value => edit.run(setShadowOn(selection, { receiveShadow: value }))}
        />
      )}
    </PropertySection>
  )
}
