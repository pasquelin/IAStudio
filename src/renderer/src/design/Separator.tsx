import { cn } from './cn'

export type SeparatorProps = {
  orientation?: 'vertical' | 'horizontal'
  className?: string
}

/** Hairline between groups of controls. Decorative, hence hidden from assistive tech. */
export function Separator({ orientation = 'vertical', className }: SeparatorProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'bg-border shrink-0',
        orientation === 'vertical' ? 'mx-1 h-4 w-px' : 'my-1 h-px w-4/5',
        className,
      )}
    />
  )
}
