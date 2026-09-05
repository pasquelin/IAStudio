import type { ReactNode } from 'react'
import { cn } from '@/helpers/cn'

/**
 * A frosted sheet posed over the viewport. Without it the light theme left the account form as four
 * white boxes on a light floor, with nothing holding them.
 *
 * The ground is a surface token at an alpha — a scrim owes no ratio; what is written on it is
 * measured against `base-100`.
 */
export function WelcomePanel({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <div
      className={cn(
        'bg-base-100/85 border-base-300/70 w-full rounded-(--radius-sc-lg) border px-8 py-6 shadow-(--sc-shadow-floating) backdrop-blur-md',
        // Two columns of models need the room; a question with three chips under it does not, and
        // read the same width it would be a band rather than a sheet.
        wide ? 'max-w-3xl' : 'max-w-md',
      )}
    >
      {children}
    </div>
  )
}
