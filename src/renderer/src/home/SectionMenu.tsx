import { mdiArrowDown, mdiArrowUp, mdiDotsHorizontal, mdiEyeOffOutline } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import {
  canMoveHomeSection,
  homeSectionOf,
  movedHomeSection,
  shownHomeSection,
  type HomeMove,
  type HomeSectionId,
  type HomeSectionSetting,
} from '@shared/domain/home'
import { MenuButton } from '@/design/MenuButton'
import { MenuRow } from '@/design/MenuRow'
import { HINT_RIGHT, TIP_BOTTOM } from '@/helpers/tooltip'
import { useSettings } from '@/stores/settings'
import { useHomeSections } from './use-home-sections'

/** Both directions the menu draws, asked of the rules before the glyph is drawn at all. */
const MOVES: readonly HomeMove[] = ['up', 'down']

/**
 * The heading's own menu: move the band, or hide it.
 *
 * It offered a count too, until the bands that carried one became panels — a panel's shelf reads
 * a page of its own and has no bar to put such a row on.
 */
export function SectionMenu({ id }: { id: HomeSectionId }) {
  const { t } = useTranslation()
  const stored = useSettings(state => state.settings.home.sections)
  // The bands actually on screen: swapping with one that a missing project hides is a write
  // nobody can see.
  const shown = useHomeSections()

  const entry = homeSectionOf(id)
  const canHide = entry?.pinned !== true
  const canMove = MOVES.some(move => canMoveHomeSection(stored, id, move, shown))

  const write = (sections: HomeSectionSetting[]): void => {
    void useSettings.getState().write({ home: { sections } })
  }

  // Nothing at all rather than a glyph opening onto two dead rows. The centre holds two bands
  // today — one pinned to the top, one anchored to the foot — so neither can move, and the
  // pinned one cannot be hidden either: its menu could only ever refuse.
  if (!canMove && !canHide) return null

  // `MenuButton` only asks whether there is more than one row — a lone row makes the button act
  // directly instead of opening. Both moves are always drawn, disabled or not, so there always
  // are two.
  const rowCount = 2

  return (
    <MenuButton
      icon={mdiDotsHorizontal}
      label={t('home.customise')}
      variant="header"
      tooltip={TIP_BOTTOM}
      opensOnClick
      rowCount={rowCount}
      rows={close => (
        <>
          <MenuRow
            icon={mdiArrowUp}
            label={t('home.moveUp')}
            disabled={!canMoveHomeSection(stored, id, 'up', shown)}
            tip={HINT_RIGHT(t('home.moveUpHint'))}
            onSelect={() => {
              write(movedHomeSection(stored, id, 'up', shown))
              close()
            }}
          />
          <MenuRow
            icon={mdiArrowDown}
            label={t('home.moveDown')}
            disabled={!canMoveHomeSection(stored, id, 'down', shown)}
            tip={HINT_RIGHT(t('home.moveDownHint'))}
            onSelect={() => {
              write(movedHomeSection(stored, id, 'down', shown))
              close()
            }}
          />

          {entry?.pinned !== true && (
            <MenuRow
              icon={mdiEyeOffOutline}
              label={t('home.hide')}
              tip={HINT_RIGHT(t('home.hideHint'))}
              onSelect={() => {
                write(shownHomeSection(stored, id, false))
                close()
              }}
            />
          )}
        </>
      )}
    />
  )
}
