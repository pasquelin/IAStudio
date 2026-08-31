import { PANEL_SCROLL } from '@/components/styles'
import { InspectorFace } from './InspectorFace'

/**
 * What the selection is, read out.
 *
 * It owns no state: every face reads the store that holds the thing it describes, so two
 * panels showing the same clip cannot disagree about it. One panel for the whole studio — a
 * scene node, an asset, a clip, a track, a layer — because "what is selected" is one question,
 * and an inspector per space would be six panels to learn to find.
 */
export function Inspector() {
  // The scroller belongs here rather than to each face: one of them used to forget it.
  return (
    <div className={PANEL_SCROLL}>
      <InspectorFace />
    </div>
  )
}
