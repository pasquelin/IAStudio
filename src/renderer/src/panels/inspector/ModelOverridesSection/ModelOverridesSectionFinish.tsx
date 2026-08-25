import type { ModelRef } from '@shared/domain/scene'
import { Button } from '@/design/Button'
import { HINT_LEFT } from '@/helpers/tooltip'
import { modelFinishOf } from '@/spaces/textures/modelFinish'
import { documentForAsset, useDocuments } from '@/stores/documents'
import { textureOf, useTextures } from '@/stores/textures'

/**
 * Copies the finish of the material assembled from this model's own pictures onto the model.
 *
 * COPIED, never referenced: a model pointing into an open document would draw whatever that
 * document is showing, and write that drift into its own `.gltf` on the next ⌘S. The three dials
 * that ride on the maps travel with it; the four the texture engine reads in a shader do not
 * (`modelFinishOf` says which).
 */
export function ModelOverridesSectionFinish({
  assetId,
  label,
  hint,
  onChange,
}: {
  assetId: string
  label: string
  hint: string
  onChange: (material: ModelRef['material']) => void
}) {
  const document = useDocuments(state => documentForAsset(state, assetId, 'texture'))
  const material = useTextures(state => (document ? textureOf(state, document.id).material : null))

  if (!material) return null

  return (
    <Button {...HINT_LEFT(hint)} onClick={() => onChange(modelFinishOf(material))}>
      {label}
    </Button>
  )
}
