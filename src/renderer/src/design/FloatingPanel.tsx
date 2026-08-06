import type { ReactNode } from 'react'
import { cn } from './cn'

export type FloatingPanelProps = {
  title?: string
  children: ReactNode
  className?: string
}

/**
 * Floating surface: it just opened ON TOP and must detach itself, hence the deep shadow where
 * furniture (bars, docks) keeps the subtle one. Backdrop blur is applied only to surfaces
 * floating above a canvas or a viewport: inside an opaque dock it would only cost compositing
 * work every frame.
 */
export function FloatingPanel({ title, children, className }: FloatingPanelProps) {
  return (
    <div
      className={cn(
        'border-border bg-elevated rounded-(--radius-sc-md) border p-2',
        'shadow-(--sc-shadow-floating)',
        className,
      )}
    >
      {title !== undefined && (
        <div className="text-muted mb-1.5 px-1 text-[11px] font-medium tracking-wide uppercase">
          {title}
        </div>
      )}
      {children}
    </div>
  )
}
