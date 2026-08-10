import { mdiArrowDown, mdiArrowUp, mdiCounter, mdiDotsHorizontal, mdiEyeOffOutline } from '@mdi/js'
import { useTranslation } from 'react-i18next'
import {
  canMoveHomeSection,
  homeSectionLimit,
  homeSectionOf,
  limitedHomeSection,
  movedHomeSection,
  shownHomeSection,
  type HomeSectionId,
  type HomeSectionSetting,
} from '@shared/domain/home'
import { MenuButton } from '@/design/MenuButton'
import { MenuRow } from '@/design/MenuRow'
import { Separator } from '@/design/Separator'
import { HINT_RIGHT, TIP_BOTTOM } from '@/helpers/tooltip'
import { useSettings } from '@/stores/settings'
import { useHomeSections } from './use-home-sections'

/** What a shelf may be cut down to. Enough to matter, few enough to stay one glance. */
const LIMITS: readonly number[] = [6, 12, 24, 48]

export function SectionMenu({ id }: { id: HomeSectionId }) {
  const { t } = useTranslation()
  const stored = useSettings(state => state.settings.home.sections)
  // The bands actually on screen: swapping with one that a missing project hides is a write
  // nobody can see.
  const shown = useHomeSections()

  const entry = homeSectionOf(id)
  const limit = homeSectionLimit(stored, id)

  const write = (sections: HomeSectionSetting[]): void => {
    void useSettings.getState().write({ home: { sections } })
  }

  // `MenuButton` only asks whether there is more than one row — a lone row makes the button act
  // directly instead of opening. Moving up and moving down are always offered, so there always
  // are, whatever else the section allows.
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

          {entry?.defaultLimit !== undefined && (
            <>
              <Separator orientation="vertical" />
              {LIMITS.map(value => (
                <MenuRow
                  key={value}
                  icon={mdiCounter}
                  label={t('home.showCount', { count: value })}
                  checked={limit === value}
                  tick="one-of"
                  tip={HINT_RIGHT(t('home.showCountHint', { count: value }))}
                  onSelect={() => {
                    write(limitedHomeSection(stored, id, value))
                    close()
                  }}
                />
              ))}
            </>
          )}
        </>
      )}
    />
  )
}
