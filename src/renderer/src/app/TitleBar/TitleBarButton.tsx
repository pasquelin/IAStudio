import type { DragEvent } from 'react'
import { cn } from '@/helpers/cn'
import { IS_MAC } from '@/helpers/platform'
import { TITLE_BAR_GHOST } from '@/design/styles'
import { UiIcon } from '@/design/UiIcon'
import { bindingOf, commandFor } from '@shared/domain/command'
import { signatureOf } from '@shared/domain/shortcut'
import { currentOverrides } from '@/stores/bindings'
import type { WorkspaceMove } from '@shared/domain/workspace'
import { SPACES } from './spaces'

/** What makes a button one of the row's movable pills. Absent on the home, which never moves. */
type Reorder = {
  /** Whether the pointer carrying another space is over this one right now. */
  over: boolean
  onStart: (event: DragEvent) => void
  onOver: () => void
  onLeave: () => void
  onDrop: (event: DragEvent) => void
  onEnd: () => void
  onStep: (move: WorkspaceMove) => void
  /** Takes no coordinates: the system pops the menu where the pointer is. */
  onMenu: () => void
}

export type TitleBarButtonProps = {
  icon: string
  label: string
  current: boolean
  onClick: () => void
  reorder?: Reorder
}

/**
 * The two chords a reader is told about, in the space-separated form `aria-keyshortcuts` wants
 * — which is the form a `Signature` already has. Resolved, so a remap is announced too.
 */
function reorderKeyshortcuts(): string | undefined {
  const overrides = currentOverrides()
  const chords = [bindingOf('spaces.moveLeft', overrides), bindingOf('spaces.moveRight', overrides)]
  const bound = chords.filter(chord => chord !== null)
  return bound.length > 0 ? bound.join(' ') : undefined
}

/** One destination of the bar. The home and the spaces are read as one row, so they wear
 * the same chrome — the home is not a control of a different kind. */
export function TitleBarButton({ icon, label, current, onClick, reorder }: TitleBarButtonProps) {
  return (
    <button
      type="button"
      aria-current={current ? 'page' : undefined}
      onClick={onClick}
      draggable={reorder !== undefined}
      onDragStart={reorder?.onStart}
      onDragOver={event => {
        // Asked before accepting: saying yes to a drag we cannot read swallows someone else's file.
        if (!reorder || !SPACES.carries(event)) return
        event.preventDefault()
        event.dataTransfer.dropEffect = 'move'
        reorder.onOver()
      }}
      onDragLeave={event => {
        // `dragleave` fires on the way into the pill's own icon; only a target outside it left.
        const to = event.relatedTarget
        if (to instanceof Node && event.currentTarget.contains(to)) return
        reorder?.onLeave()
      }}
      onDrop={event => {
        if (!reorder) return
        event.preventDefault()
        reorder.onDrop(event)
      }}
      onDragEnd={reorder?.onEnd}
      // Read off the registry rather than matched by hand: this was the studio's one keyboard
      // gesture the shortcuts screen could neither show nor remap. Heard here rather than
      // through `useShortcuts` because it belongs to the focused pill, not to the window.
      onKeyDown={event => {
        if (!reorder) return
        const overrides = currentOverrides()
        const command = commandFor(signatureOf(event.nativeEvent, IS_MAC), 'spaces', overrides)
        if (command !== 'spaces.moveLeft' && command !== 'spaces.moveRight') return
        event.preventDefault()
        reorder.onStep(command === 'spaces.moveLeft' ? 'left' : 'right')
      }}
      aria-keyshortcuts={reorder && reorderKeyshortcuts()}
      onContextMenu={event => {
        if (!reorder) return
        event.preventDefault()
        reorder.onMenu()
      }}
      className={cn(
        TITLE_BAR_GHOST,
        'gap-2 px-3 py-1',
        current && 'bg-elevated text-text',
        // A ring rather than a fill: `accent-soft` sits at 1.03:1 on the light chassis, and it
        // would also take the active pill's own background away from it.
        reorder?.over && 'ring-accent text-text ring-2',
      )}
    >
      <UiIcon path={icon} size={16} />
      {label}
    </button>
  )
}
