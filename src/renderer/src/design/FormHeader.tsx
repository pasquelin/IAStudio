import type { ReactNode } from 'react'

export type FormHeaderProps = {
  /** What the form below is for — a model's name, an App's. */
  title: string
  /** A way back, where there is one to offer. The App runner has one; the generator has none. */
  leading?: ReactNode
}

/**
 * The line that names what the form under it is for.
 *
 * Its own component because two panels render the same form from the same descriptors and had
 * written its header twice — one bordered with a way back, the other a bare `<p>`, and the bare
 * one carried a bug the other did not.
 *
 * `shrink-0` is that bug. A flex item is protected by `min-height: auto`, which stops it being
 * squeezed below its content — and that protection falls away the moment its `overflow` is no
 * longer `visible`. `truncate` sets `overflow: hidden`, so the bare line became crushable to
 * zero: the form took its place and clipped the name in half, horizontally. A name truncated
 * across its middle reads as a broken font, not as a layout that ran out of room.
 */
export function FormHeader({ title, leading }: FormHeaderProps) {
  return (
    <div className="border-border flex shrink-0 items-center gap-2 border-b px-1 py-1.5">
      {leading}
      <p className="truncate text-[11px]">{title}</p>
    </div>
  )
}
