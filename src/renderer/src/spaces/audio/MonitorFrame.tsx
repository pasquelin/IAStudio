import type { ReactNode } from 'react'

export type MonitorFrameProps = {
  /** What the pair is: the surface, then the bar, then the line that says which half this is. */
  children: ReactNode
  toolbar: ReactNode
  role: string
}

/**
 * The shell both sound monitors wear, on the picture pair's own pattern — surface, bar, and a
 * line under it saying what this half shows.
 *
 * Written once for the two, because what they hold could not be more different — one is a take
 * being edited, the other the montage it lands in — and two shells would drift into two ways of
 * reading the same screen. No padding of its own: what separates the two is the row's gutter and
 * the handle between them, exactly as two panels are separated.
 */
export function MonitorFrame({ children, toolbar, role }: MonitorFrameProps) {
  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col items-center gap-2">
      <div className="bg-chassis relative min-h-0 w-full flex-1">{children}</div>
      {toolbar}
      {/* Under the bar rather than over the surface: two monitors showing a waveform each is the
          one thing this space cannot explain by itself, and the answer has to still be there
          once both of them are showing something. */}
      <p className="text-muted text-tiny m-0 text-center">{role}</p>
    </section>
  )
}
