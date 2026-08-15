import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { fontKey, type FontRef } from '@shared/domain/font'
import { TextureField, type TextureOption } from '@/design/TextureField'
import { studioFonts } from '@/services/fonts'

export type FontFieldProps = {
  label: string
  value: FontRef
  onChange: (font: FontRef) => void
}

/**
 * The typeface a text is set in: the three the studio ships, then whatever the machine adds.
 *
 * The list is asked for when the field opens rather than held in a store: it is read once per
 * session on the other side of the boundary, and nothing in the interface reacts to it changing.
 *
 * A face the document names and this machine has not got is offered all the same, marked as
 * missing. Dropping it from the list would silently rewrite the document on the first edit —
 * which is the one thing the missing-font hole must not do.
 */
export function FontField({ label, value, onChange }: FontFieldProps) {
  const { t } = useTranslation()
  const [offered, setOffered] = useState<readonly FontRef[]>([])

  useEffect(() => {
    let listening = true
    void studioFonts.families().then(families => {
      if (listening) setOffered(families)
    })

    return () => {
      listening = false
    }
  }, [])

  const known = useMemo(() => {
    const held = offered.some(font => fontKey(font) === fontKey(value))
    return held ? offered : [...offered, value]
  }, [offered, value])

  const options = useMemo<TextureOption[]>(
    () =>
      known.map(font => ({
        id: fontKey(font),
        name: offered.some(one => fontKey(one) === fontKey(font))
          ? font.family
          : t('inspector.fontMissing', { family: font.family }),
      })),
    [known, offered, t],
  )

  return (
    <TextureField
      label={label}
      value={fontKey(value)}
      options={options}
      // Never cleared: a text has to be set in something, so the row offers no empty state.
      onChange={key => {
        const picked = known.find(font => fontKey(font) === key)
        if (picked) onChange(picked)
      }}
      emptyLabel={t('inspector.noFont')}
      chooseLabel={t('inspector.chooseFont')}
      clearLabel={t('inspector.chooseFont')}
      emptyHint={t('inspector.noFontHint')}
      optionHint={t('inspector.pickFontHint')}
      // The list always holds at least the face the document names, so this is the answer to a
      // machine that announced nothing at all — offered rather than silent, like the others.
      noOptionLabel={t('inspector.noFontOffered')}
      noOptionHint={t('inspector.noFontOfferedHint')}
    />
  )
}
