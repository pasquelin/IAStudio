import { cn } from '@/helpers/cn'
import { PANEL_BAR } from './styles'

export type FormHeaderProps = {
  /** What the form below is for — a model's name. */
  title: string
}

/**
 * The line that names what the form under it is for.
 *
 * Its own component because two panels rendered the same form from the same descriptors and had
 * written its header twice — one bordered with a way back, the other a bare `<p>`, and the bare
 * one carried a bug the other did not. One panel is left; the bug is why this stays a component.
 *
 * `shrink-0` is that bug. A flex item is protected by `min-height: auto`, which stops it being
 * squeezed below its content — and that protection falls away the moment its `overflow` is no
 * longer `visible`. `truncate` sets `overflow: hidden`, so the bare line became crushable to
 * zero: the form took its place and clipped the name in half, horizontally. A name truncated
 * across its middle reads as a broken font, not as a layout that ran out of room.
 */
export function FormHeader({ title }: FormHeaderProps) {
  return (
    <div className={cn(PANEL_BAR, 'shrink-0 px-1 py-1.5')}>
      <p className="text-tiny truncate">{title}</p>
    </div>
  )
}
