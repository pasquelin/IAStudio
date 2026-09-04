import { useTranslation } from 'react-i18next'
import type { DisplayUnit } from '@shared/domain/scene'
import { shownLength } from '@shared/domain/units'
import { withMaterialAt, wornMaterials } from '@shared/domain/scene'
import { PropertyRow } from '@/components/PropertyRow'
import { PropertySection } from '@/components/PropertySection'
import { dressCharacter } from '@/engines/character/characterCommands'
import type { MeshSample } from '@/engines/scene/rigSnap'
import { AssetInspector } from '@/features/assets/components/Asset/Inspector/AssetInspector'
import { ModelDressSection } from '@/features/scene/components/ModelDressSection/ModelDressSection'
import { formatBytes, formatDecimal } from '@/helpers/format'
import { assetsById, useAssets } from '@/stores/assets'
import { characterOf, useCharacters } from '@/stores/character'
import {
  materialNamesOfNode,
  materialSlotsOfNode,
  modelStatsOf,
  useModelFiles,
} from '@/stores/modelFiles'

export type CharacterInspectorModelProps = {
  assetId: string
  documentId: string
  nodeId: string
  sample: MeshSample | null
  unit: DisplayUnit
}

/** File facts and the existing model-material workflow, bound to a character's own history. */
export function CharacterInspectorModel({
  assetId,
  documentId,
  nodeId,
  sample,
  unit,
}: CharacterInspectorModelProps) {
  const { t, i18n } = useTranslation()
  const asset = useAssets(state => assetsById(state).get(assetId))
  const character = useCharacters(state => characterOf(state, assetId))
  const slots = useModelFiles(state =>
    nodeId ? materialSlotsOfNode(state, documentId, nodeId) : 0,
  )
  const stats = useModelFiles(state => modelStatsOf(state, documentId))
  const names = useModelFiles(state => materialNamesOfNode(state, documentId, nodeId))
  const run = useCharacters(state => state.runCommand)
  const number = (value: number): string => formatDecimal(value, i18n.language, { digits: 0 })

  return (
    <>
      {asset && <AssetInspector asset={asset} />}
      <PropertySection title={t('inspector.modelInformation')} scId="character.information">
        <PropertyRow label={t('inspector.modelTriangles')}>{number(stats.triangles)}</PropertyRow>
        <PropertyRow label={t('inspector.modelVertices')}>{number(stats.vertices)}</PropertyRow>
        <PropertyRow label={t('inspector.modelDrawCalls')}>{number(stats.draws)}</PropertyRow>
        <PropertyRow label={t('inspector.modelMaterials')}>{number(slots)}</PropertyRow>
        <PropertyRow label={t('inspector.modelImageMemory')}>
          {formatBytes(stats.textureBytes, unit => t(`units.${unit}`), i18n.language)}
        </PropertyRow>
        {sample && (
          <PropertyRow label={t('inspector.modelBounds', { unit })}>
            {boundsLabel(sample.bounds, unit, i18n.language)}
          </PropertyRow>
        )}
      </PropertySection>
      <ModelDressSection
        assetId={assetId}
        name={asset?.name ?? assetId}
        dress={character.dress}
        slots={slots}
        names={names}
        onChange={dress => run(assetId, dressCharacter(dress))}
        onWearAt={(slot, materialId) =>
          run(
            assetId,
            dressCharacter({
              kind: 'materials',
              documentIds: withMaterialAt(wornMaterials(character.dress), slot, materialId),
            }),
          )
        }
      />
    </>
  )
}

function boundsLabel(bounds: MeshSample['bounds'], unit: DisplayUnit, language: string): string {
  const size = shownLength(
    {
      x: bounds.max.x - bounds.min.x,
      y: bounds.max.y - bounds.min.y,
      z: bounds.max.z - bounds.min.z,
    },
    unit,
  )
  return [size.x, size.y, size.z]
    .map(value => formatDecimal(value, language, { digits: 2 }))
    .join(' × ')
}
