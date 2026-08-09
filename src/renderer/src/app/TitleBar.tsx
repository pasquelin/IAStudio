import { mdiHomeOutline } from '@mdi/js'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { CLICKABLE, DRAGGABLE } from '@/helpers/app-region'
import { cn } from '@/helpers/cn'
import { FOCUS_RING } from '@/design/styles'
import { UiIcon } from '@/design/UiIcon'
import { useWindowState } from '@/hooks/useWindowState'
import type { WorkspaceId } from '@shared/domain/workspace'
import { workspaceLabelKey, WORKSPACES } from '@/helpers/workspaces'

export type TitleBarProps = {
  activeWorkspace: WorkspaceId
  onWorkspace: (workspace: WorkspaceId) => void
  /** Whether the home is the surface in front. Absent when the setting turned it off. */
  home?: boolean
  /** Absent hides the home button altogether — the setting is off, so it leads nowhere. */
  onHome?: () => void
  /** Global actions aligned right: search, run, account. */
  actions?: ReactNode
}

/**
 * Custom chrome: traffic lights stay native (`titleBarStyle: 'hiddenInset'`) and the bar
 * carries the workspaces. We reclaim a title bar's worth of height, and the application does
 * not look like a web page in a frame.
 */
export function TitleBar({
  activeWorkspace,
  onWorkspace,
  home = false,
  onHome,
  actions,
}: TitleBarProps) {
  const { t } = useTranslation()
  const { fullScreen } = useWindowState()

  return (
    <header
      style={DRAGGABLE}
      className={cn(
        'flex shrink-0 items-center gap-2 pt-2 pr-6 pb-1 text-[13px]',
        // The left inset only exists to clear the native traffic lights. macOS removes them
        // in full screen: without this switch, a 96 px gap would remain.
        fullScreen ? 'pl-1.5' : 'pl-24',
      )}
    >
      <nav
        aria-label={t('workspaces.navigation')}
        style={CLICKABLE}
        className="flex items-center gap-2"
      >
        {onHome && (
          <BarButton
            icon={mdiHomeOutline}
            label={t('home.title')}
            current={home}
            onClick={onHome}
          />
        )}

        {WORKSPACES.map(workspace => (
          <BarButton
            key={workspace.id}
            icon={workspace.icon}
            label={t(workspaceLabelKey(workspace.id))}
            // The home covers the spaces rather than being one of them: while it is up, none
            // of them is the page being read.
            current={!home && workspace.id === activeWorkspace}
            onClick={() => onWorkspace(workspace.id)}
          />
        ))}
      </nav>

      {actions !== undefined && (
        <div style={CLICKABLE} className="ml-auto flex items-center gap-2">
          {actions}
        </div>
      )}
    </header>
  )
}

type BarButtonProps = {
  icon: string
  label: string
  current: boolean
  onClick: () => void
}

/** One destination of the bar. The home and the six spaces are read as one row, so they wear
 * the same chrome — the home is not a control of a different kind. */
function BarButton({ icon, label, current, onClick }: BarButtonProps) {
  return (
    <button
      type="button"
      aria-current={current ? 'page' : undefined}
      onClick={onClick}
      className={cn(
        'flex cursor-pointer items-center gap-2 rounded-(--radius-sc-md) border-none px-3 py-1',
        'text-muted bg-transparent transition-colors',
        'hover:bg-elevated/60 hover:text-text',
        current && 'bg-elevated text-text',
        // Without it the platform draws its own outline, in a blue that belongs to no theme.
        FOCUS_RING,
      )}
    >
      <UiIcon path={icon} size={16} />
      {label}
    </button>
  )
}
