import { useMemo } from 'react'
import { mdiFileDocumentMultipleOutline } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { byCodeUnit } from '@shared/text'
import { MenuButton } from '@/design/MenuButton'
import { MenuRow } from '@/design/MenuRow'
import { HINT_BOTTOM, TIP_BOTTOM } from '@/helpers/tooltip'
import { useCode } from '@/stores/code'
import { scriptName } from './scriptName'

/**
 * 🛑 Every script of the project, not only the open ones: without it a file the author never
 * opened is unreachable — no other gesture of the panel names one.
 */
export function CodeOpener({ active }: { active: string | null }) {
  const { t } = useTranslation()
  const files = useCode(state => state.files)
  const scripts = useMemo(() => Object.keys(files).sort(byCodeUnit), [files])

  return (
    <MenuButton
      icon={mdiFileDocumentMultipleOutline}
      label={t('code.openScript')}
      description={t('code.openScriptHint')}
      tooltip={TIP_BOTTOM}
      rowCount={scripts.length}
      opensOnClick
      rows={close =>
        scripts.map(script => (
          <MenuRow
            key={script}
            label={scriptName(script)}
            checked={script === active}
            tick="one-of"
            tip={HINT_BOTTOM(scriptName(script))}
            onSelect={() => {
              useCode.getState().show(script)
              close()
            }}
          />
        ))
      }
    />
  )
}
