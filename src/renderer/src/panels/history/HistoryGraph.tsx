import type { GitLaneRow } from '@shared/domain/gitGraph'

/**
 * How wide one lane is, in the drawing's own coordinates — which are unitless.
 *
 * Nothing here is a pixel: the shape is drawn in a `viewBox` and the element is then sized in
 * CSS off `--sc-control-inline`, so the graph narrows with the compact density exactly as every
 * control around it does. A number in `px` would have been right at one density and wrong at the
 * other, which is the whole reason the studio keeps its gauges in the stylesheet.
 */
const LANE = 10
const ROW = 20

/**
 * One row of the branch graph.
 *
 * An SVG written out rather than an icon from `@mdi/js`, and the two are not the same thing: an
 * icon is a fixed glyph the studio keeps in one place, where this is a DRAWING computed per row
 * from where the commit's parents landed. What it draws is decided in `shared/domain/gitGraph.ts`
 * — laid out and tested without a browser — so nothing below chooses anything.
 *
 * `currentColor` throughout: the ink comes from the row it sits in, which is what lets the picked
 * row lift its whole line at once, and what keeps a hexadecimal out of a component.
 */
export function HistoryGraph({ row }: { row: GitLaneRow }) {
  return (
    <svg
      aria-hidden
      className="text-muted h-full shrink-0"
      style={{ width: `calc(var(--sc-control-inline) * ${row.width} / 2)` }}
      viewBox={`0 0 ${row.width * LANE} ${ROW}`}
      preserveAspectRatio="none"
    >
      {row.links.map(link => (
        <line
          key={`${link.from}-${link.to}`}
          x1={link.from * LANE + LANE / 2}
          y1={0}
          x2={link.to * LANE + LANE / 2}
          y2={ROW}
          stroke="currentColor"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
      ))}

      <circle
        cx={row.lane * LANE + LANE / 2}
        cy={ROW / 2}
        r={LANE / 4}
        fill="currentColor"
        // The dot alone lifts to full ink: it is what says WHICH lane the row belongs to, and at
        // the muted grey the lines are drawn in it disappeared among them.
        className="text-text"
      />
    </svg>
  )
}
