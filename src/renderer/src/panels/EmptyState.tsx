import type { ReactNode } from 'react'
import { UiIcon } from '@/design/UiIcon'

export type EmptyStateProps = {
  icon: string
  message: string
  action?: ReactNode
}

/** Message d'un panneau sans contenu. Un dock vide sans explication se lit comme un bug. */
export function EmptyState({ icon, message, action }: EmptyStateProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <UiIcon path={icon} size={32} className="text-muted/40" />
      <p className="text-muted max-w-56 text-[12px] leading-relaxed">{message}</p>
      {action}
    </div>
  )
}
