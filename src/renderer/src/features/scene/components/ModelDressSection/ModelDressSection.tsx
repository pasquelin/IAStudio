import { useTranslation } from 'react-i18next'
import { PICTURES, type Asset } from '@shared/domain/asset'
import {
  MATERIAL_SLOTS,
  NOTHING_WORN,
  wornMaterials,
  type ModelDressRef,
} from '@shared/domain/scene'
import { mdiMinus, mdiPlus } from '@mdi/js'
import { LinkField } from '@/components/LinkField/LinkField'
import { ToolButton } from '@/components/ToolButton'
import { TIP_LEFT } from '@/helpers/tooltip'
import { PropertySection } from '@/components/PropertySection'
import { SelectField } from '@/components/SelectField'
import { openAssetById } from '@/helpers/openAsset'
import { getBridge } from '@/services/bridge'
import { useProjectPictures } from '@/hooks/useProjectPictures'
import { openModelMaterial } from '@/features/material/openModelMaterial'
import { reportFailure } from '@/services/diagnostics'
import { useAssets } from '@/stores/assets'
import { ModelDressSectionMaterials } from './ModelDressSectionMaterials'

/** Derived, never restated: a third `kind` on the union has to answer here or it will not compile. */
type DressMode = ModelDressRef['kind'] | 'own'

export type ModelDressSectionProps = {
  /** The model's own asset — what the pictures an assembled material is made of came out of. */
  assetId: string
  /** The node's name, which is what a material assembled from those pictures is called. */
  name: string
  dress: ModelDressRef | undefined
  /** How many materials this model's own file carries — see `ModelTextures.count`. */
  slots: number
  /** Material names read from the model file, in slot order. */
  names?: readonly string[]
  /** The whole dress at once: the two modes exclude each other, so a change is never partial. */
  onChange: (dress: ModelDressRef | null) => void
  /** One slot, NAMED rather than written: assembling awaits, and this panel's list goes stale. */
  onWearAt: (slot: number, documentId: string) => void
}

/** What covers a model: one picture, or the materials it wears — never both at once. */
export function ModelDressSection({
  assetId,
  name,
  dress,
  slots,
  names = [],
  onChange,
  onWearAt,
}: ModelDressSectionProps) {
  const { t } = useTranslation()
  const pictures = useProjectPictures(PICTURES)
  const mode: DressMode = dress?.kind ?? 'own'

  const assemble = async (slot: number): Promise<void> => {
    let own: readonly Asset[]
    try {
      // The main pass is idempotent: it returns already extracted pictures for a recent model,
      // and takes embedded GLB images out for an older one before the material editor opens.
      own = await (getBridge()?.assets.extractTextures(assetId) ?? [])
    } catch (error) {
      reportFailure('assets.extract', name, error)
      return
    } finally {
      // Extraction writes one image at a time, so even a partial failure changed the catalogue.
      useAssets.getState().invalidate()
    }

    try {
      const materialId = await openModelMaterial({ id: assetId, name }, own)
      if (materialId) onWearAt(slot, materialId)
    } catch (error) {
      reportFailure('assets.open', name, error)
    }
  }

  return (
    <PropertySection
      title={t('inspector.modelDress')}
      scId="modelDress"
      // Blender's `+` and `−`, where every other list of the studio keeps them: on the heading of
      // the group they act on, never one per row.
      actions={
        dress?.kind === 'materials' && (
          <>
            <ToolButton
              icon={mdiMinus}
              label={t('inspector.modelDressRemoveSlot')}
              description={t('inspector.modelDressRemoveSlotHint')}
              tooltip={TIP_LEFT}
              variant="header"
              disabled={wornMaterials(dress).length <= 1}
              onClick={() => onChange(withSlots(dress, -1))}
            />
            <ToolButton
              icon={mdiPlus}
              label={t('inspector.modelDressAddSlot')}
              description={t('inspector.modelDressAddSlotHint')}
              tooltip={TIP_LEFT}
              variant="header"
              // The list GROWS to reach the slot named, so `withMaterialAt` refuses past this —
              // a row it would refuse is a row that redraws itself empty, saying nothing.
              disabled={wornMaterials(dress).length >= MATERIAL_SLOTS}
              onClick={() => onChange(withSlots(dress, 1))}
            />
          </>
        )
      }
    >
      <SelectField
        label={t('inspector.modelDressMode')}
        scId="modelDressMode"
        value={mode}
        options={[
          { value: 'own', label: t('inspector.modelOwnMaterial') },
          { value: 'image', label: t('inspector.modelDressImage') },
          { value: 'materials', label: t('inspector.modelDressMaterials') },
        ]}
        // A mode with nothing in it yet, rather than nothing at all: what says which mode a model
        // is in is the dress being there, so an empty one is what makes the choice stick.
        onChange={next => onChange(dressFor(next))}
      />

      {dress?.kind === 'image' && (
        <LinkField
          label={t('inspector.modelDressImageField')}
          value={dress.assetId || null}
          options={pictures}
          // Emptied rather than undressed: the mode is what the row above says, and clearing a
          // picture is not leaving the mode — `own` is the entry that does that.
          onChange={assetId => onChange({ kind: 'image', assetId: assetId ?? NOTHING_WORN })}
          emptyLabel={t('inspector.modelDressNoImage')}
          missingLabel={t('inspector.modelDressMissingImage')}
          clearLabel={t('inspector.modelDressClearImage')}
          clearHint={t('inspector.modelDressClearImageHint')}
          accepts={PICTURES}
          open={{
            label: t('inspector.modelDressOpenImage'),
            hint: t('inspector.modelDressOpenImageHint'),
            run: () => openAssetById(dress.assetId || null),
          }}
          scId="model.dressImage"
        />
      )}

      {dress?.kind === 'materials' && (
        <ModelDressSectionMaterials
          worn={wornMaterials(dress)}
          pictures={pictures}
          slots={slots}
          names={names}
          onChange={documentIds => onChange({ kind: 'materials', documentIds })}
          onAssemble={slot => void assemble(slot)}
        />
      )}
    </PropertySection>
  )
}

/** One slot more, empty — or the last one gone, which is what `−` takes off. */
function withSlots(dress: ModelDressRef, by: number): ModelDressRef {
  const worn = wornMaterials(dress)
  return {
    kind: 'materials',
    documentIds: by > 0 ? [...worn, NOTHING_WORN] : worn.slice(0, -1),
  }
}

function dressFor(mode: DressMode): ModelDressRef | null {
  if (mode === 'image') return { kind: 'image', assetId: NOTHING_WORN }
  if (mode === 'materials') return { kind: 'materials', documentIds: [NOTHING_WORN] }
  return null
}
