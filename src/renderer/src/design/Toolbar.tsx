import { mdiRedo, mdiUndo } from '@mdi/js'
import { Fragment, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from './cn'
import { resolveSlot, type SlotConfig } from './slots'
import { simpleTooltip } from './tooltip'
import { ToolButton } from './ToolButton'

export type ToolbarSection = 'tools' | 'extras' | 'undo' | 'redo'

export type Tool = {
  id: string
  /** Clé i18n du libellé — jamais le texte affiché. */
  labelKey: string
  icon: string
  shortcut?: string
  disabled?: boolean
}

export type ToolbarProps = {
  /** Outils affichés, dans l'ordre. */
  tools: Tool[]
  activeTool?: string
  onTool: (id: string) => void
  orientation?: 'vertical' | 'horizontal'
  /** Masque (`false`) ou remplace (ReactNode) chaque section. */
  sections?: SlotConfig<ToolbarSection>
  /** Outils de l'espace, rendus après les outils natifs et dans le même langage visuel. */
  extras?: ReactNode
  onUndo?: () => void
  onRedo?: () => void
  canUndo?: boolean
  canRedo?: boolean
  className?: string
}

const tooltip = simpleTooltip()

/**
 * Barre d'outils unique du studio, partagée par les six espaces. Chaque espace ne fournit
 * que son registre d'outils ; la géométrie suit `--sc-control`, donc le réglage de densité
 * agit partout sans qu'aucune barre ne connaisse sa valeur.
 */
export function Toolbar({
  tools,
  activeTool,
  onTool,
  orientation = 'vertical',
  sections,
  extras,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  className,
}: ToolbarProps) {
  const { t } = useTranslation()
  const vertical = orientation === 'vertical'
  const slotTools = resolveSlot(sections, 'tools')
  const slotExtras = resolveSlot(sections, 'extras')
  const slotUndo = resolveSlot(sections, 'undo')
  const slotRedo = resolveSlot(sections, 'redo')

  const separator = (
    <span
      aria-hidden="true"
      className={cn('bg-border', vertical ? 'mx-1 h-px w-4/5' : 'my-1 h-4/5 w-px')}
    />
  )

  return (
    <div
      role="toolbar"
      aria-orientation={vertical ? 'vertical' : 'horizontal'}
      className={cn(
        'border-border bg-surface flex items-center gap-0.5 rounded-(--radius-sc-lg) border p-1',
        'shadow-(--sc-shadow-furniture)',
        vertical ? 'flex-col' : 'flex-row',
        className,
      )}
    >
      {slotTools.visible &&
        (slotTools.replacement ?? (
          <Fragment>
            {tools.map(tool => (
              <ToolButton
                key={tool.id}
                icon={tool.icon}
                label={t(tool.labelKey)}
                shortcut={tool.shortcut}
                tooltip={tooltip}
                active={tool.id === activeTool}
                disabled={tool.disabled}
                onClick={() => onTool(tool.id)}
              />
            ))}
          </Fragment>
        ))}

      {slotExtras.visible && (slotExtras.replacement ?? extras)}

      {(slotUndo.visible || slotRedo.visible) && (onUndo || onRedo) && separator}

      {slotUndo.visible &&
        onUndo &&
        (slotUndo.replacement ?? (
          <ToolButton
            icon={mdiUndo}
            label={t('actions.undo')}
            shortcut="⌘Z"
            tooltip={tooltip}
            disabled={!canUndo}
            onClick={onUndo}
          />
        ))}

      {slotRedo.visible &&
        onRedo &&
        (slotRedo.replacement ?? (
          <ToolButton
            icon={mdiRedo}
            label={t('actions.redo')}
            shortcut="⇧⌘Z"
            tooltip={tooltip}
            disabled={!canRedo}
            onClick={onRedo}
          />
        ))}
    </div>
  )
}
