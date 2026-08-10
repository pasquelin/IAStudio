import type { ReactNode } from 'react'

export type PropertyGroupProps = { title: string; children: ReactNode }

/**
 * A titled run of rows. The inspector shows several: identity, then source, then parameters.
 *
 * The inset is the group's, as it is in `PropertySection`: rows and fields both start at the
 * same place because neither of them decides where that is.
 */
export function PropertyGroup({ title, children }: PropertyGroupProps) {
  return (
    <section className="border-border border-b py-1 last:border-b-0">
      <h3 className="text-muted px-2 py-1 text-[10px] font-semibold tracking-wide uppercase">
        {title}
      </h3>
      <div className="px-2">{children}</div>
    </section>
  )
}
