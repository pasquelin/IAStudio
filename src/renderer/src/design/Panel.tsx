import type { HTMLAttributes } from 'react'
import { cn } from '@/helpers/cn'

/** Darker than the chassis it sits on — that inversion is what reads as "panels on a frame". */
export function Panel({ children, className, ...rest }: HTMLAttributes<HTMLElement>) {
  return (
    <section
      className={cn(
        'bg-base flex min-h-0 shrink-0 flex-col overflow-hidden rounded-(--radius-sc-lg)',
        className,
      )}
      {...rest}
    >
      {children}
    </section>
  )
}
