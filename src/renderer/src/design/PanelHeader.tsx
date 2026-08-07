import type { ReactNode } from 'react'

export type PanelHeaderProps = {
  title: string
  children?: ReactNode
}

export function PanelHeader({ title, children }: PanelHeaderProps) {
  return (
    <header className="flex h-(--sc-header) shrink-0 items-center gap-1 pr-1.5 pl-3">
      <span className="text-text truncate text-[13px] font-semibold">{title}</span>
      <span className="ml-auto flex items-center gap-0.5">{children}</span>
    </header>
  )
}
