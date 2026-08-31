import type { ReactNode } from 'react'

export type MonitorFrameProps = {
  /** What the pair is: the surface, then the bar, then the line that says which half this is. */
  children: ReactNode
  toolbar: ReactNode
  role: string
}

/**
 * The shell every monitor wears, picture or sound. No padding of its own: what separates two
 * monitors is the row's gutter and the handle between them, exactly as two panels are separated,
 * and a padding here would add itself to both sides of that gutter and read three times too wide.
 */
export function MonitorFrame({ children, toolbar, role }: MonitorFrameProps) {
  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col items-center gap-2">
      <div className="bg-chassis relative min-h-0 w-full flex-1">{children}</div>
      {toolbar}
      {/* Under the bar rather than over the surface: two monitors showing the same thing is the
          one thing a two-monitor space cannot explain by itself, and the answer has to still be
          there once both of them are showing something. */}
      <p className="text-muted text-tiny m-0 text-center">{role}</p>
    </section>
  )
}
