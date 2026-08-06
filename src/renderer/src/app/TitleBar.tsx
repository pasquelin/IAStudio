import type { CSSProperties, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/design/cn'
import { UiIcon } from '@/design/UiIcon'
import { useWindowState } from '@/hooks/useWindowState'
import { workspaceLabelKey, WORKSPACES, type WorkspaceId } from './workspaces'

/**
 * `app-region` is not typed by React: the whole bar is draggable, and every control must
 * explicitly switch back to `no-drag`, otherwise it becomes unclickable.
 */
const DRAGGABLE: CSSProperties = { WebkitAppRegion: 'drag' } as CSSProperties
const CLICKABLE: CSSProperties = { WebkitAppRegion: 'no-drag' } as CSSProperties

export type TitleBarProps = {
  activeWorkspace: WorkspaceId
  onWorkspace: (workspace: WorkspaceId) => void
  /** Global actions aligned right: search, run, account. */
  actions?: ReactNode
}

/**
 * Custom chrome: traffic lights stay native (`titleBarStyle: 'hiddenInset'`) and the bar
 * carries the workspaces. We reclaim a title bar's worth of height, and the application does
 * not look like a web page in a frame.
 */
export function TitleBar({ activeWorkspace, onWorkspace, actions }: TitleBarProps) {
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
        className="flex items-center gap-1"
      >
        {WORKSPACES.map(workspace => (
          <button
            key={workspace.id}
            type="button"
            aria-current={workspace.id === activeWorkspace ? 'page' : undefined}
            onClick={() => onWorkspace(workspace.id)}
            className={cn(
              'flex cursor-pointer items-center gap-2 rounded-(--radius-sc-md) border-none px-3 py-1',
              'text-muted bg-transparent transition-colors',
              'hover:bg-elevated/60 hover:text-text',
              workspace.id === activeWorkspace && 'bg-elevated text-text',
            )}
          >
            <UiIcon path={workspace.icon} size={16} />
            {t(workspaceLabelKey(workspace.id))}
          </button>
        ))}
      </nav>

      {actions !== undefined && (
        <div style={CLICKABLE} className="ml-auto flex items-center gap-1">
          {actions}
        </div>
      )}
    </header>
  )
}
