import type { CSSProperties, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/design/cn'
import { UiIcon } from '@/design/UiIcon'
import { useWindowState } from '@/hooks/useWindowState'
import { workspaceLabelKey, WORKSPACES, type WorkspaceId } from './workspaces'

/**
 * `app-region` n'est pas typé par React : la barre entière est saisissable, et chaque
 * contrôle doit explicitement repasser en `no-drag`, sinon il devient incliquable.
 */
const DRAGGABLE: CSSProperties = { WebkitAppRegion: 'drag' } as CSSProperties
const CLICKABLE: CSSProperties = { WebkitAppRegion: 'no-drag' } as CSSProperties

export type TitleBarProps = {
  activeWorkspace: WorkspaceId
  onWorkspace: (workspace: WorkspaceId) => void
  /** Actions globales alignées à droite : recherche, exécution, compte. */
  actions?: ReactNode
}

/**
 * Chrome custom : les feux de circulation restent natifs (`titleBarStyle: 'hiddenInset'`),
 * la barre porte les espaces de travail. On récupère la hauteur d'une barre de titre, et
 * l'application ne ressemble pas à une page web dans un cadre.
 */
export function TitleBar({ activeWorkspace, onWorkspace, actions }: TitleBarProps) {
  const { t } = useTranslation()
  const { fullScreen } = useWindowState()

  return (
    <header
      style={DRAGGABLE}
      className={cn(
        'flex shrink-0 items-center gap-2 pt-2 pr-6 pb-1 text-[13px]',
        // Le retrait de gauche ne sert qu'à dégager les feux de circulation natifs. En plein
        // écran macOS les retire : sans cette bascule, il resterait un creux de 96 px.
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
