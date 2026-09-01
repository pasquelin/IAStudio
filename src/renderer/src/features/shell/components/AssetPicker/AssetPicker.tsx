import { memo, useCallback, useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  registerAssetPicker,
  type AssetPicker as Picker,
  type AssetPickRequest,
} from '../assetPicker'
import { AssetPickerBody } from './AssetPickerBody'

type Asked = { request: AssetPickRequest; answer: (assetId: string | null) => void }

/**
 * The long way to fill a slot: everything the project holds of a kind, local and remote alike,
 * shown as pictures rather than as a list of names.
 *
 * The slot's own select is the SHORT way and stays — a material is usually dressed from the four
 * textures beside it, and opening a window for that would be a window per texture. This one is
 * reached from the browse button, which is the gesture Unreal puts under its magnifier.
 */
export const AssetPicker = memo(function AssetPicker() {
  const { t } = useTranslation()
  const [asked, setAsked] = useState<Asked | null>(null)
  const [search, setSearch] = useState('')
  /** For `pick`, a closure fixed at mount that cannot see the state — only ever read. */
  const pending = useRef<Asked | null>(null)
  const titleId = useId()

  const pick = useCallback<Picker>(
    request =>
      new Promise(answer => {
        // One at a time, and the second is called off rather than stacked: the first is on
        // screen, and answering it for the newcomer would fill a slot nobody was looking at.
        if (pending.current) {
          answer(null)
          return
        }

        const question = { request, answer }
        pending.current = question
        setAsked(question)
        setSearch('')
      }),
    [],
  )

  useEffect(() => registerAssetPicker(pick), [pick])

  if (!asked) return null

  return (
    <AssetPickerBody
      accepts={asked.request.accepts}
      search={search}
      onSearch={setSearch}
      titleId={titleId}
      settle={chosen => {
        pending.current = null
        setAsked(null)
        asked.answer(chosen)
      }}
      labels={{
        title: t('assets.pickFor', { name: asked.request.label }),
        search: t('assets.pickSearch'),
        empty: t('assets.pickEmpty'),
        cancel: t('assets.pickCancel'),
      }}
    />
  )
})
