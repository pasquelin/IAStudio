import { Fragment, type CSSProperties, type ReactNode } from 'react'
import { cn } from '@/helpers/cn'
import { tipFor } from '@/helpers/tooltip'
import { Separator } from '../Separator'
import { ToolbarTool } from './ToolbarTool'
import type { ToolbarItem } from './tools'

export type ToolbarProps = {
  /** Tools rendered, in order. */
  tools: ToolbarItem[]
  activeTool?: string
  onTool: (id: string) => void
  /** Called when a row of a tool's flyout is chosen. */
  onMode?: (toolId: string, modeId: string) => void
  orientation?: 'vertical' | 'horizontal'
  /** Workspace tools, rendered after the built-in ones and in the same visual language. */
  extras?: ReactNode
  className?: string
  /** What no class can express — an offset read off a runtime measure, such as the rulers'. */
  style?: CSSProperties
}

/**
 * The studio's single toolbar, shared by every workspace: each one provides only its registry.
 *
 * Geometry follows `--sc-control`, so the density setting reaches it without the bar ever
 * knowing its value.
 */
export function Toolbar({
  tools,
  activeTool,
  onTool,
  onMode,
  orientation = 'vertical',
  extras,
  className,
  style,
}: ToolbarProps) {
  const vertical = orientation === 'vertical'
  // A vertical bar hugs the left edge, so its tooltips go right — placed on top they would sit
  // over the button above and cover the tool the eye is comparing against.
  const tip = tipFor(orientation)
  const divider = <Separator orientation={vertical ? 'horizontal' : 'vertical'} />

  return (
    <div
      role="toolbar"
      style={style}
      aria-orientation={vertical ? 'vertical' : 'horizontal'}
      className={cn(
        'border-border bg-surface flex items-center gap-0.5 rounded-(--radius-sc-lg) border p-1',
        'shadow-(--sc-shadow-furniture)',
        vertical ? 'flex-col' : 'flex-row',
        className,
      )}
    >
      {tools.map((tool, index) => (
        <Fragment key={tool.id}>
          {/* `index > 0`: a registry that opens on a separator is one composed with something in
              front of it, and a rule against the edge of the bar separates nothing. */}
          {tool.separatorBefore && index > 0 && divider}
          <ToolbarTool
            tool={tool}
            // Either, never one overriding the other: `pressed: false` on the armed tool must
            // not draw it released.
            active={tool.pressed === true || tool.id === activeTool}
            tip={tip}
            onTool={onTool}
            onMode={onMode}
          />
        </Fragment>
      ))}

      {extras}
    </div>
  )
}
