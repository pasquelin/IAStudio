import { mdiChevronDown } from '@mdi/js'
import type { IDockviewHeaderActionsProps } from 'dockview-react'
import { useTranslation } from 'react-i18next'
import { MenuButton } from '@/components/MenuButton'
import { MenuRow } from '@/components/MenuRow'
import { HINT_LEFT, TIP_BOTTOM } from '@/helpers/tooltip'
import { workspaceById } from '@/helpers/workspaces'
import { useClippedTabs } from '@/hooks/useClippedTabs'
import { useDocuments } from '@/stores/documents'

/** Dockview's own dropdown is off — it drew outside the studio's tokens — and the measurement it
 * keeps private is redone here. */
export function DocumentOverflow({ group, panels }: IDockviewHeaderActionsProps) {
  const { t } = useTranslation()
  const documents = useDocuments(state => state.documents)

  const clipped = useClippedTabs(
    group.model.tabsListElement,
    tab => group.model.getPanelForTab(tab)?.id,
  )

  // Named by the studio when it knows the document, by the tab itself when it does not: a panel
  // the restored layout outlived is exactly the one to reach and close, and dropping it from the
  // list left it cut on screen, out of the count, and reachable by no gesture at all.
  const hidden = clipped.flatMap(id => {
    const panel = panels.find(one => one.id === id)
    if (!panel) return []
    const open = documents[id]
    // `?? ''` because Dockview types a title it always carries here — `ensurePanel` sets one.
    return [
      {
        panel,
        title: open?.title ?? panel.title ?? '',
        icon: open ? workspaceById(open.workspace).icon : undefined,
      },
    ]
  })

  // Nothing hidden, no button — and it cannot flicker: taking the button back only ever gives the
  // strip room, so a strip that fits without it fits again once it is gone.
  if (hidden.length === 0) return null

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
      // Reached when a single tab is hidden, which `useHoverFlyout` refuses to call a menu.
      onAct={() => {
        hidden[0]?.panel.api.setActive()
      }}
      rows={close =>
        hidden.map(entry => (
          <MenuRow
            key={entry.panel.id}
            label={entry.title}
            icon={entry.icon}
            tip={HINT_LEFT(t('documents.hiddenTabHint'))}
            onSelect={() => {
              close()
              entry.panel.api.setActive()
            }}
          />
        ))
      }
    >
      <span className="text-mini">{hidden.length}</span>
    </MenuButton>
  )
}
