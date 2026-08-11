import { mdiArrowLeft, mdiArrowRight, mdiHomeOutline } from '@mdi/js'
import { useState, type DragEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { CLICKABLE, DRAGGABLE } from '@/helpers/app-region'
import { cn } from '@/helpers/cn'
import { ContextMenu } from '@/design/ContextMenu'
import { MenuRow } from '@/design/MenuRow'
import { TITLE_BAR_GHOST, FOCUS_RING } from '@/design/styles'
import { UiIcon } from '@/design/UiIcon'
import { bindingOf, commandFor } from '@shared/domain/command'
import { signatureOf } from '@shared/domain/shortcut'
import { currentOverrides } from '@/stores/bindings'
import { useWindowState } from '@/hooks/useWindowState'
import { useWorkspaces } from '@/hooks/useWorkspaces'
import {
  canMoveWorkspace,
  isWorkspaceId,
  movedWorkspace,
  movedWorkspaceBy,
  type WorkspaceId,
  type WorkspaceMove,
} from '@shared/domain/workspace'
import { workspaceLabelKey } from '@/helpers/workspaces'
import { dragChannel } from '@/helpers/drag'
import { useSettings } from '@/stores/settings'
import { HINT_BOTTOM, HINT_RIGHT } from '@/helpers/tooltip'

/** Its own MIME type, so a file from the desktop never reads as one of the bar's pills. */
const SPACES = dragChannel('application/x-scenario-workspace')

export type TitleBarProps = {
  activeWorkspace: WorkspaceId
  onWorkspace: (workspace: WorkspaceId) => void
  /** Whether the home is the surface in front. Absent when the setting turned it off. */
  home?: boolean
  /** Absent hides the home button altogether — the setting is off, so it leads nowhere. */
  onHome?: () => void
  /** Global actions aligned right: search, run, account. */
  actions?: ReactNode
}

/**
 * Custom chrome: traffic lights stay native (`titleBarStyle: 'hiddenInset'`) and the bar
 * carries the workspaces. We reclaim a title bar's worth of height, and the application does
 * not look like a web page in a frame.
 */
export function TitleBar({
  activeWorkspace,
  onWorkspace,
  home = false,
  onHome,
  actions,
}: TitleBarProps) {
  const { t } = useTranslation()
  const { fullScreen } = useWindowState()
  const workspaces = useWorkspaces()

  // The dragged id rides on the drag itself, which is what lets a target ask `carries` first.
  // It is kept here as well for one thing only: the platform forbids reading it before the drop,
  // and without it the pill being dragged would light itself up as somewhere it could land.
  const [drag, setDrag] = useState<{ from: WorkspaceId; over: WorkspaceId | null } | null>(null)

  const [menuAt, setMenuAt] = useState<{ id: WorkspaceId; x: number; y: number } | null>(null)
  const [announcement, setAnnouncement] = useState('')

  const order = workspaces.map(workspace => workspace.id)

  const apply = (next: readonly WorkspaceId[], moved: WorkspaceId): void => {
    void useSettings.getState().write({ workspaces: { order: [...next] } })
    setAnnouncement(
      t('workspaces.moved', {
        label: t(workspaceLabelKey(moved)),
        position: next.indexOf(moved) + 1,
        total: next.length,
      }),
    )
  }

  // What the same reordering looks like without a drag: the keyboard's, and the menu's.
  const step = (id: WorkspaceId, move: WorkspaceMove): void => {
    if (!canMoveWorkspace(order, id, move)) return
    apply(movedWorkspaceBy(order, id, move), id)
  }

  const drop = (event: DragEvent, onto: WorkspaceId): void => {
    setDrag(null)
    const dragged = SPACES.idFrom(event)
    if (!dragged || !isWorkspaceId(dragged) || dragged === onto) return

    apply(movedWorkspace(order, dragged, onto), dragged)
  }

  return (
    <header
      style={DRAGGABLE}
      className={cn(
        'text-body flex shrink-0 items-center gap-2 pt-2 pr-6 pb-1',
        // The left inset only exists to clear the native traffic lights. macOS removes them
        // in full screen: without this switch, a 96 px gap would remain.
        fullScreen ? 'pl-1.5' : 'pl-24',
      )}
    >
      <nav
        aria-label={t('workspaces.navigation')}
        style={CLICKABLE}
        className="flex items-center gap-2"
      >
        {onHome && (
          <BarButton
            icon={mdiHomeOutline}
            label={t('home.title')}
            current={home}
            onClick={onHome}
          />
        )}

        {workspaces.map(workspace => (
          <BarButton
            key={workspace.id}
            icon={workspace.icon}
            label={t(workspaceLabelKey(workspace.id))}
            // The home covers the spaces rather than being one of them: while it is up, none
            // of them is the page being read.
            current={!home && workspace.id === activeWorkspace}
            onClick={() => onWorkspace(workspace.id)}
            reorder={{
              over: drag?.over === workspace.id && drag.from !== workspace.id,
              onStart: event => {
                SPACES.start(event, workspace.id)
                setDrag({ from: workspace.id, over: null })
              },
              onOver: () => setDrag(current => current && { ...current, over: workspace.id }),
              onLeave: () =>
                setDrag(current =>
                  current?.over === workspace.id ? { ...current, over: null } : current,
                ),
              onDrop: event => drop(event, workspace.id),
              onEnd: () => setDrag(null),
              onStep: move => step(workspace.id, move),
              onMenu: at => setMenuAt({ id: workspace.id, ...at }),
            }}
          />
        ))}
      </nav>

      {menuAt && (
        <ContextMenu at={menuAt} onClose={() => setMenuAt(null)}>
          <MenuRow
            label={t('workspaces.moveLeft')}
            icon={mdiArrowLeft}
            disabled={!canMoveWorkspace(order, menuAt.id, 'left')}
            tip={HINT_RIGHT(t('workspaces.moveLeftHint'))}
            onSelect={() => {
              step(menuAt.id, 'left')
              setMenuAt(null)
            }}
          />
          <MenuRow
            label={t('workspaces.moveRight')}
            icon={mdiArrowRight}
            disabled={!canMoveWorkspace(order, menuAt.id, 'right')}
            tip={HINT_RIGHT(t('workspaces.moveRightHint'))}
            onSelect={() => {
              step(menuAt.id, 'right')
              setMenuAt(null)
            }}
          />
        </ContextMenu>
      )}

      {/* The order changes under a focus that does not move and a label that does not change:
          without this the gesture succeeds in silence for anyone reading rather than looking. */}
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {actions !== undefined && (
        <div style={CLICKABLE} className="ml-auto flex items-center gap-2">
          {actions}
        </div>
      )}
    </header>
  )
}

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
  onMenu: (at: { x: number; y: number }) => void
}

type BarButtonProps = {
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
function BarButton({ icon, label, current, onClick, reorder }: BarButtonProps) {
  const { t } = useTranslation()
  return (
    <button
      type="button"
      aria-current={current ? 'page' : undefined}
      {...HINT_BOTTOM(t('workspaces.switchHint'))}
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
        const command = commandFor(signatureOf(event.nativeEvent), 'spaces', overrides)
        if (command !== 'spaces.moveLeft' && command !== 'spaces.moveRight') return
        event.preventDefault()
        reorder.onStep(command === 'spaces.moveLeft' ? 'left' : 'right')
      }}
      aria-keyshortcuts={reorder && reorderKeyshortcuts()}
      onContextMenu={event => {
        if (!reorder) return
        event.preventDefault()
        reorder.onMenu({ x: event.clientX, y: event.clientY })
      }}
      className={cn(
        TITLE_BAR_GHOST,
        'gap-2 px-3 py-1',
        current && 'bg-elevated text-text',
        // A ring rather than a fill: `accent-soft` sits at 1.03:1 on the light chassis, and it
        // would also take the active pill's own background away from it.
        reorder?.over && 'ring-accent text-text ring-2',
        // Without it the platform draws its own outline, in a blue that belongs to no theme.
        FOCUS_RING,
      )}
    >
      <UiIcon path={icon} size={16} />
      {label}
    </button>
  )
}
