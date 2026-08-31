import { useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import type { MaterialStyle } from '@shared/domain/style'
import { PropertySection } from '@/components/PropertySection'
import { QuietNote } from '@/components/QuietNote'
import { applyStyle } from '@/engines/material/commands'
import { sameValues } from '@/helpers/objects'
import { useStyles } from '@/stores/styles'
import { useMaterials } from '@/stores/materials'
import { StylesSectionRow } from './StylesSectionRow'

export type StylesSectionProps = { documentId: string }

/**
 * The saved ways of reading a material, applied to the texture in front.
 *
 * A plain list rather than a `Collection`: that one is a virtualized scroller sized by its host,
 * and a section of a scrolling panel has no height to give it. What the rows lose with it is the
 * roving tab stop — they are a handful of presets, not a catalogue.
 */
export function StylesSection({ documentId }: StylesSectionProps) {
  const { t } = useTranslation()
  const styles = useStyles(state => state.styles)
  const material = useMaterials(state => state.states[documentId]?.material ?? null)

  useEffect(() => {
    void useStyles.getState().load()
  }, [])

  /**
   * The style travels as an argument rather than in a closure, as `ProjectRow` takes its path:
   * bound at the call site instead, every row would get a fresh handler on every render and the
   * memo on the row would have nothing left to catch.
   */
  const apply = useCallback(
    (style: MaterialStyle): void =>
      useMaterials.getState().runCommand(documentId, applyStyle(style.id, style.values)),
    [documentId],
  )

  return (
    <PropertySection title={t('inspector.styles')} scId="material.styles">
      {styles.length === 0 ? (
        <QuietNote>{t('styles.none')}</QuietNote>
      ) : (
        <ul aria-label={t('inspector.styles')} className="m-0 flex list-none flex-col gap-2 p-0">
          {styles.map(style => (
            <StylesSectionRow
              key={style.id}
              style={style}
              // Which style is in force is stored nowhere — `applyStyle` writes its values over the
              // material and keeps no name. Read back by comparison, which also answers the case
              // that matters: move one slider and no style is in force any more, which is true.
              applied={sameValues(style.values, material)}
              onApply={apply}
            />
          ))}
        </ul>
      )}
    </PropertySection>
  )
}
