import { mdiChevronDown, mdiChevronRight, mdiLockOpenVariantOutline, mdiLockOutline } from '@mdi/js'
import { memo, useState } from 'react'
import { MenuButton } from '@/design/MenuButton'
import { MenuRow } from '@/design/MenuRow'
import { Row } from '@/design/Row'
import { ToolButton } from '@/design/ToolButton'
import { isGroup, type Layer, type LayerLocks } from '@/engines/canvas/canvas-state'
import { renameLayer, setLayerLocks, setLayerVisible } from '@/engines/canvas/commands'
import { cn } from '@/helpers/cn'
import { TIP_RIGHT } from '@/helpers/tooltip'
import { VisibilityToggle } from '@/panels/shared/VisibilityToggle'
import { collapseLayerIn, useCanvases } from '@/stores/canvases'

/** Resolved by the list rather than per row — see `LayerList`. */
export type LayerRowLabels = {
  visible: string
  show: string
  hide: string
  locks: string
  locksHint: string
  lockPixels: string
  lockPosition: string
  lockAlpha: string
  collapse: string
  expand: string
}

export type LayerRowProps = {
  documentId: string
  layer: Layer
  /** 0 at the root: each step indents the row, so the stack reads as the tree it is. */
  depth: number
  labels: LayerRowLabels
}

/** Which padlock each menu row opens, in the order they are offered. */
const PADLOCKS: readonly { key: keyof LayerLocks; label: keyof LayerRowLabels }[] = [
  { key: 'pixels', label: 'lockPixels' },
  { key: 'position', label: 'lockPosition' },
  { key: 'alpha', label: 'lockAlpha' },
]

/** One step of indentation. A gauge rather than a pixel count — see `index.css`. */
const INDENT = 'var(--sc-gutter)'

/**
 * Memoized, as `SceneNodeRow` is: layer identity survives every command that does not touch it,
 * so hiding one re-renders one row instead of the whole stack.
 */
export const LayerRow = memo(function LayerRow({
  documentId,
  layer,
  depth,
  labels,
}: LayerRowProps) {
  const [renaming, setRenaming] = useState(false)
  const run = (command: Parameters<ReturnType<typeof useCanvases.getState>['runCommand']>[1]) =>
    useCanvases.getState().runCommand(documentId, command)

  const locked = layer.locked.pixels || layer.locked.position || layer.locked.alpha

  return (
    <div
      className="flex h-full min-w-0 items-center"
      style={{ paddingLeft: `calc(${INDENT} * ${depth})` }}
      onDoubleClick={() => setRenaming(true)}
    >
      {isGroup(layer) ? (
        <ToolButton
          icon={layer.collapsed ? mdiChevronRight : mdiChevronDown}
          label={layer.collapsed ? labels.expand : labels.collapse}
          tooltip={TIP_RIGHT}
          variant="header"
          // Both, as `VisibilityToggle` does: `Collection` selects on click and `Tree` on
          // pointer down, so a chevron that swallowed one would steal the selection in the other.
          onPointerDown={event => event.stopPropagation()}
          onClick={event => {
            event.stopPropagation()
            collapseLayerIn(documentId, layer.id, !layer.collapsed)
          }}
        />
      ) : (
        // A group's chevron and a layer's absence of one must not shift the name sideways.
        <span aria-hidden className="w-(--sc-control) shrink-0" />
      )}

      <div className="min-w-0 flex-1">
        {renaming ? (
          <RenameField
            name={layer.name}
            onDone={name => {
              setRenaming(false)
              if (name && name !== layer.name) run(renameLayer(layer.id, name))
            }}
          />
        ) : (
          <Row
            title={layer.name}
            muted={!layer.visible}
            leading={
              <VisibilityToggle
                visible={layer.visible}
                label={labels.visible}
                description={layer.visible ? labels.hide : labels.show}
                onToggle={() => run(setLayerVisible(layer.id, !layer.visible))}
              />
            }
            actions={
              <MenuButton
                icon={locked ? mdiLockOutline : mdiLockOpenVariantOutline}
                label={labels.locks}
                description={labels.locksHint}
                tooltip={TIP_RIGHT}
                variant="header"
                active={locked}
                // One button rather than three on the line: the row is 24 px tall in compact.
                rowCount={PADLOCKS.length}
                opensOnClick
                rows={() =>
                  PADLOCKS.map(padlock => (
                    <MenuRow
                      key={padlock.key}
                      label={labels[padlock.label]}
                      icon={layer.locked[padlock.key] ? mdiLockOutline : mdiLockOpenVariantOutline}
                      checked={layer.locked[padlock.key]}
                      onSelect={() =>
                        run(
                          setLayerLocks(layer.id, {
                            ...layer.locked,
                            [padlock.key]: !layer.locked[padlock.key],
                          }),
                        )
                      }
                    />
                  ))
                }
              />
            }
          />
        )}
      </div>
    </div>
  )
})

/**
 * The name, editable in place. Committed on blur as well as on Enter: clicking away from a
 * half-typed name is how most renames end, and losing it there would be the worst of both.
 */
function RenameField({ name, onDone }: { name: string; onDone: (name: string) => void }) {
  return (
    <input
      autoFocus
      defaultValue={name}
      className={cn(
        'text-text w-full bg-transparent px-1 text-[12px] outline-none',
        'focus:ring-accent focus:ring-1',
      )}
      onPointerDown={event => event.stopPropagation()}
      onBlur={event => onDone(event.target.value.trim())}
      onKeyDown={event => {
        if (event.key === 'Enter') event.currentTarget.blur()
        // Restored before blurring, so the commit on blur has nothing new to write.
        if (event.key === 'Escape') {
          event.currentTarget.value = name
          event.currentTarget.blur()
        }
      }}
    />
  )
}
