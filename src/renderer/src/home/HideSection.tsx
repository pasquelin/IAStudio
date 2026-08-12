import { mdiEyeOffOutline } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import { homeSectionOf, shownHomeSection, type HomeSectionId } from '@shared/domain/home'
import { ToolButton } from '@/design/ToolButton'
import { TIP_BOTTOM } from '@/helpers/tooltip'
import { useSettings } from '@/stores/settings'

/**
 * The one thing a band's heading still offers: take it off the page.
 *
 * It was a menu — move up, move down, hide, and a count of items. The count went with the bands
 * that carried one, since a panel's shelf reads a page of its own; the two moves went when the
 * centre came down to bands that are all either pinned or anchored, so nothing has anywhere to
 * move. A menu of one row is a button, and a button says what it does rather than what it is.
 *
 * Nothing at all on a pinned band: its heading offers no gesture, and a glyph that can only
 * refuse is worse than none.
 */
export function HideSection({ id }: { id: HomeSectionId }) {
  const { t } = useTranslation()
  const stored = useSettings(state => state.settings.home.sections)

  if (homeSectionOf(id)?.pinned === true) return null

  return (
    <ToolButton
      icon={mdiEyeOffOutline}
      label={t('home.hide')}
      description={t('home.hideHint')}
      variant="header"
      tooltip={TIP_BOTTOM}
      onClick={() =>
        void useSettings
          .getState()
          .write({ home: { sections: shownHomeSection(stored, id, false) } })
      }
    />
  )
}
