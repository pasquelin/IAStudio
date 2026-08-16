import type { ReactNode } from 'react'
import { cn } from '@/helpers/cn'
import { ROW_INK, ROW_LINE, ROW_QUIET } from './styles'
import { TIP_RIGHT, type TooltipFactory } from '@/helpers/tooltip'
import { UiIcon } from './UiIcon'

export type RowProps = {
  /** A thumbnail, when the row has a picture. Wins over `icon` when both are given. */
  media?: ReactNode
  /** `@mdi/js` path, for rows whose kind is what identifies them. */
  icon?: string
  title: string
  subtitle?: string
  /** Before the visual: the visibility eye of a layer or a node. */
  leading?: ReactNode
  /** After the title, pushed to the end. */
  actions?: ReactNode
  /** Struck through, and dimmed AT REST only: a hidden layer, an invisible mesh. */
  muted?: boolean
  /**
   * The name in quiet ink, and nothing else: a row that has been CUT and is waiting for a paste.
   *
   * Told apart from `muted`, which strikes the name through — that says "this is not showing",
   * where this says "this is on its way out". An `opacity` would have said it too and is refused
   * outright by `design/tokens.test.ts`: it dims whatever the element inherits, so no guard can
   * follow what a word ends up reading at. `ROW_QUIET` is measured, and lifts to full ink the
   * moment the row is picked.
   */
  quiet?: boolean
  /**
   * What the row has to say that the screen does not already show — why it is refused, the full
   * path behind a truncated one, the real name of an asset listed under its id.
   *
   * **It is the whole of what puts a tooltip on this row.** The name alone used to raise one,
   * everywhere, on the grounds that a row truncates; what that produced was a band of text
   * repeating a word already under the pointer, over the panel beside it, on every list in the
   * studio. A tooltip that echoes a visible word is noise on screen and noise to a reader alike.
   */
  hint?: string
  /** Placement of the hint. Rows live in side panels, so it goes right by default. */
  tip?: TooltipFactory
}

/**
 * One line, everywhere. Written once so the model browser, the layer stack, the mesh and light
 * panels and the outliner share a height, a rhythm and a truncation instead of drifting apart.
 *
 * It paints no background: selection and hover belong to whatever list holds it — `Collection`
 * does it in its cell, and a background set here would sit on top and swallow it.
 */
export function Row({
  media,
  icon,
  title,
  subtitle,
  leading,
  actions,
  muted,
  quiet,
  hint,
  tip = TIP_RIGHT,
}: RowProps) {
  return (
    // One step; the host that PAINTS the fill adds the second — `Collection`'s cell and `Tree`'s
    // row both do. Raising it to two here instead stacked on the tree's own step and pushed every
    // name a further 4px off its chevron.
    //
    // The shape itself is `ROW_LINE`, shared with `Tree`: the two draw halves of the same line.
    //
    // The gutter is added HERE and not carried by the shape, because this is where it describes
    // something: a glyph, a word and a button, three things that have to breathe. The tree's
    // columns have a width of their own and needed no such thing — between them the same gutter
    // was 12px of nothing, on every line of every panel.
    //
    // `min-w-0 flex-1` is what makes the `truncate` below fire at all, and it belongs here rather
    // than at each host. A flex item defaults to `min-width: auto`, so without it this row is as
    // wide as the longest name it holds, whatever the panel measures: the name never truncates,
    // the row overflows, and since the tree lays its rows out `absolute inset-x-0` the fill stops
    // at the panel edge while the text goes on. That is a file browser scrolling sideways with an
    // unpainted selection — seen on 2026-08-14, on `asset_6be2d496-…-eda987c366e5.glb`.
    //
    // `LayerRow` and `SceneNodeRow` had reached for the same pair in a wrapper of their own, which
    // is why only the explorer showed it: `EntryRow` renders this directly.
    <div className={cn(ROW_LINE, 'min-w-0 flex-1 gap-2')}>
      {leading}
      {media ?? (icon && <UiIcon path={icon} size={14} className="shrink-0" />)}
      <div className="min-w-0 flex-1 leading-tight">
        {/* The studio tooltip and not `title`, which comes with the OS delay and none of the
            theme — and only where `hint` gives it something to say. */}
        <p
          {...(hint ? tip(title, false, hint) : {})}
          className={cn(
            'truncate text-xs leading-tight',
            // A hidden layer is DIMMED, not disabled: a layer is still selected and renamed, a
            // scene node still selected and dragged, so the exemption WCAG 1.4.3 grants a disabled
            // control does not cover either. Lifted on the same state as the subtitle below —
            // `muted` reads 3.25:1 on `accent-soft` — and the strike-through, with the crossed-out
            // eye beside it, is what goes on saying the row is hidden.
            muted ? cn(ROW_QUIET, 'line-through') : quiet ? ROW_QUIET : ROW_INK,
          )}
        >
          {title}
        </p>
        {/* Muted at rest, full ink once the row is PICKED: `muted` reads 3.25:1 on `accent-soft`,
            under the 4.5 of WCAG 1.4.3. Driven from the row through `rowSkin`'s group, so no list
            has to pass its state down.

            Titled, and it took an inspector slot to notice: this line truncates, and
            « Occlusion ambian… » is exactly the case where hovering is the only way to read the
            rest. The NATIVE attribute rather than the studio tooltip, and the reason has outlived
            the batch that found it: the name above raises the studio one where a `hint` gives it
            something to say, and one row raising two of them would answer two different things
            depending on which half of it the pointer was over. */}
        {subtitle && (
          <p title={subtitle} className={cn(ROW_QUIET, 'text-mini truncate')}>
            {subtitle}
          </p>
        )}
      </div>
      {actions}
    </div>
  )
}
