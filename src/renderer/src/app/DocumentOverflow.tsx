import { mdiChevronDown } from '@mdi/js'
import type { IDockviewHeaderActionsProps } from 'dockview-react'
import { useTranslation } from 'react-i18next'
import { MenuButton } from '@/design/MenuButton'
import { MenuRow } from '@/design/MenuRow'
import { HINT_LEFT, TIP_BOTTOM } from '@/helpers/tooltip'
import { workspaceById } from '@/helpers/workspaces'
import { useClippedTabs } from '@/hooks/useClippedTabs'
import { useDocuments } from '@/stores/documents'

/**
 * The way to a document the tab strip has run out of room for. Dockview's own dropdown is off —
 * it drew outside the studio's tokens — and the measurement it keeps private is redone here.
 */
export function DocumentOverflow({ group, panels }: IDockviewHeaderActionsProps) {
  const { t } = useTranslation()
  const documents = useDocuments(state => state.documents)

  const clipped = useClippedTabs(
    group.model.tabsListElement,
    tab => group.model.getPanelForTab(tab)?.id,
  )

  const hidden = clipped.flatMap(id => {
    const document = documents[id]
    return document
      ? [{ id, title: document.title, icon: workspaceById(document.workspace).icon }]
      : []
  })

  // Nothing hidden, no button — and it cannot flicker: taking the button back only ever gives the
  // strip room, so a strip that fits without it fits again once it is gone.
  if (hidden.length === 0) return null

  const activate = (id: string): void => {
    panels.find(panel => panel.id === id)?.api.setActive()
  }

  return (
    <MenuButton
      icon={mdiChevronDown}
      // The count is the visible text and the name has to contain it (WCAG 2.5.3) — a name of
      // "Hidden tabs" alone answers to a word nowhere on the button.
      label={t('documents.hiddenTabs', { count: hidden.length })}
      description={t('documents.hiddenTabsHint')}
      tooltip={TIP_BOTTOM}
      variant="header"
      // `ToolButton` is square by gauge; the count needs the width back, as `ZoomBar` does.
      className="w-auto gap-1.5 px-1.5"
      rowCount={hidden.length}
      opensOnClick
      // A single row is no menu — `useHoverFlyout` says so and the button acts outright, so the
      // one hidden tab has to be reachable from the click itself.
      onClick={() => {
        const [only] = hidden
        if (hidden.length === 1 && only) activate(only.id)
      }}
      rows={close =>
        hidden.map(entry => (
          <MenuRow
            key={entry.id}
            label={entry.title}
            icon={entry.icon}
            tip={HINT_LEFT(t('documents.hiddenTabHint'))}
            onSelect={() => {
              close()
              activate(entry.id)
            }}
          />
        ))
      }
    >
      <span className="text-mini">{hidden.length}</span>
    </MenuButton>
  )
}
