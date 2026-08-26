import { mdiAutoFix } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { isWorn } from '@shared/domain/scene'
import { LinkField, type LinkOption } from '@/design/LinkField/LinkField'
import { urlOfPicture } from '@/hooks/useProjectPictures'
import { openDocumentById } from '@/helpers/openAsset'
import { MenuRow } from '@/design/MenuRow'
import { HINT_RIGHT } from '@/helpers/tooltip'
import { useWornMaterial } from '@/stores/materialSources'

export type ModelDressSectionRowProps = {
  slot: number
  documentId: string
  options: readonly LinkOption[]
  /** The project's pictures, so the slot shows its base colour — held by the parent, not per row. */
  pictures: readonly LinkOption[]
  /** A slot past what the model's file carries: kept, and wearing nothing until the file has it. */
  inert: boolean
  onChange: (documentId: string) => void
  onAssemble: () => void
}

/**
 * One material slot of a model, drawn as the link row a channel already is. Assembling one from
 * the model's own pictures rides in the row's menu, and ATTACHES it here.
 */
export function ModelDressSectionRow({
  slot,
  documentId,
  options,
  pictures,
  inert,
  onChange,
  onAssemble,
}: ModelDressSectionRowProps) {
  const { t } = useTranslation()
  const index = slot + 1
  // A material has no picture of its own: what stands for it is its BASE COLOUR.
  const shown = urlOfPicture(pictures, useWornMaterial(documentId)?.channels.baseColor?.assetId)

  return (
    <LinkField
      label={
        inert
          ? t('inspector.modelDressSlotInert', { index })
          : t('inspector.modelDressSlot', { index })
      }
      scId={`model.material.${slot}`}
      value={isWorn(documentId) ? documentId : null}
      options={options}
      valueUrl={shown}
      onChange={id => onChange(id ?? '')}
      emptyLabel={t('inspector.modelOwnMaterial')}
      missingLabel={t('inspector.modelDressMissingMaterial')}
      clearLabel={t('inspector.modelDressClearMaterial')}
      clearHint={t('inspector.modelDressClearMaterialHint')}
      open={{
        label: t('inspector.modelDressOpenMaterial'),
        hint: t('inspector.modelDressOpenMaterialHint'),
        run: () => openDocumentById(documentId),
      }}
      menuExtra={close => (
        <MenuRow
          label={t('inspector.modelDressAssemble')}
          icon={mdiAutoFix}
          tip={HINT_RIGHT(t('inspector.modelDressAssembleHint'))}
          onSelect={() => {
            close()
            onAssemble()
          }}
        />
      )}
    />
  )
}
