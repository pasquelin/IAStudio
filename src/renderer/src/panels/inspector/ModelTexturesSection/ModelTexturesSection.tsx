import { useTranslation } from 'react-i18next'
import { PropertySection } from '@/design/PropertySection'
import { ModelTexturesSectionList } from './ModelTexturesSectionList'

type ModelTexturesSectionProps = {
  /** The model's own asset — what the pictures on show were taken out of. */
  assetId: string
  /** The node's name, which is what the material assembled from those pictures is called. */
  name: string
}

/**
 * The pictures an imported model carries, as the ONE material they make up.
 *
 * What one comes to this panel to LOOK at: a model selected in the viewport shows the material
 * its file holds, and a double-click walks to the space that edits it. Where a map is swapped for
 * a picture of the project is a rarer errand, and reads as one — `ModelOverridesSection`, folded,
 * underneath.
 */
export function ModelTexturesSection({ assetId, name }: ModelTexturesSectionProps) {
  const { t } = useTranslation()

  return (
    <PropertySection title={t('inspector.modelTextures')} scId="modelTextures">
      {/* Inside the section rather than around it: what is folded away is unmounted, so folding
          this one stops asking the catalogue as well as stops drawing it. */}
      <ModelTexturesSectionList
        assetId={assetId}
        name={name}
        empty={t('inspector.noModelTexture')}
      />
    </PropertySection>
  )
}
