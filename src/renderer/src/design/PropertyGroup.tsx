import type { ReactNode } from 'react'
import { PROPERTY_BODY } from './styles'

export type PropertyGroupProps = { title: string; children: ReactNode }

/**
 * A titled run of rows. The inspector shows several: identity, then source, then parameters.
 *
 * The inset and the spacing are the group's, as they are in `PropertySection` — the same
 * `PROPERTY_BODY`, since the two are read as one panel. Rows and fields both start at the same
 * place, and stand the same distance apart, because neither of them decides either.
 */
export function PropertyGroup({ title, children }: PropertyGroupProps) {
  return (
    <section className="border-border border-b last:border-b-0">
      <h3 className="text-muted text-mini px-2 py-1 font-semibold tracking-wide uppercase">
        {title}
      </h3>
      <div className={PROPERTY_BODY}>{children}</div>
    </section>
  )
}
