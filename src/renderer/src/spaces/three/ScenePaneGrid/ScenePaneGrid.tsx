import type { PaneView } from '@/engines/scene/sceneView'
import { ScenePaneGridMenu } from './ScenePaneGridMenu'

export type ScenePaneGridProps = {
  views: readonly PaneView[]
  onView: (pane: number, view: PaneView) => void
}

/**
 * The seams between the four views, and what each of them shows.
 *
 * The gutters are drawn in the DOM over the canvas rather than left to the renderer: a gap
 * between two panes would be a strip the scissor never clears, so it would hold whatever the
 * last frame left in it. Laid over them it is the same gutter the shell puts between its panels,
 * follows the theme, and costs the GPU nothing.
 *
 * Each name is also the way to change it. Four views of an empty grid are four identical
 * rectangles: an editor that cannot say which one is the top view — nor let one say so — is an
 * editor one has to turn a camera in to find out.
 */
export function ScenePaneGrid({ views, onView }: ScenePaneGridProps) {
  return (
    <div className="pointer-events-none absolute inset-0">
      {/* The two gutters, at the width the shell uses between its own panels. */}
      <div className="bg-chassis absolute inset-y-0 left-1/2 w-(--sc-gutter) -translate-x-1/2" />
      <div className="bg-chassis absolute inset-x-0 top-1/2 h-(--sc-gutter) -translate-y-1/2" />

      <div className="absolute inset-0 grid grid-cols-2 grid-rows-2">
        {[0, 1, 2, 3].map(pane => (
          // Right-aligned, not left: the space keeps its tool rail down the left edge, and a
          // label in that corner is a label behind the toolbar.
          // `items-start` as well as `justify-end`: a flex child stretches by default, and the
          // label came out as a black column with one letter per line.
          <div key={pane} className="flex min-w-0 items-start justify-end p-1.5">
            <ScenePaneGridMenu
              view={views[pane] ?? 'free'}
              onView={chosen => onView(pane, chosen)}
              pane={pane}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
