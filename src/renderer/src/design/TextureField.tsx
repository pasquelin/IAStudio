import { mdiCheckboxBlankOutline, mdiClose, mdiImageOffOutline, mdiTextureBox } from '@mdi/js'
import { useMemo, type ReactNode } from 'react'
import type { AssetType } from '@shared/domain/asset'
import { activation } from '@/helpers/activation'
import { cn } from '@/helpers/cn'
import { HINT_RIGHT, TIP_LEFT } from '@/helpers/tooltip'
import { useHoverFlyout } from '@/hooks/useHoverFlyout'
import { AssetDropTarget } from './AssetDropTarget'
import { Flyout } from './Flyout'
import { Thumbnail } from './Thumbnail'
import { MenuRow } from './MenuRow'
import { Row } from './Row'
import { FIELD_THUMBNAIL, OVERLAY_BUTTON } from './styles'
import { ToolButton } from './ToolButton'

export type TextureOption = {
  id: string
  name: string
  /** Where the picture is served from, for the thumbnail. */
  url?: string
}

export type TextureFieldProps = {
  label: string
  /** The chosen asset, or `null` for a slot holding no texture. */
  value: string | null
  options: readonly TextureOption[]
  onChange: (assetId: string | null) => void
  /** Shown in place of a name while the slot is empty. */
  emptyLabel: string
  clearLabel: string
  chooseLabel: string
  /**
   * What the two kinds of row DO, in a sentence. Required, and separate from the labels: a menu
   * row reads its own name already, and what a caller means by "None" — no picture, the studio's
   * own light, the document's font — is exactly what the label cannot say.
   */
  emptyHint: string
  optionHint: string
  /**
   * What the menu says when it has NOTHING to offer — and it opens to say it rather than refusing
   * in silence, which is the whole reason this pair is required.
   *
   * The trigger used to be `disabled` there. On a small button at the end of the line that read
   * as refused; once the whole LINE became the trigger, nothing looked disabled any more and a
   * click simply did nothing — reported from the 3D space, where the slots of « swap a map » were
   * inert with no word said. What is missing depends on the caller — a picture, a sky, a typeface
   * — so the sentence is the caller's, like every other one on this field.
   */
  noOptionLabel: string
  noOptionHint: string
  /**
   * The kinds a drag may drop into this slot. Absent leaves the field undroppable, which is what
   * a slot filled from something other than the catalogue wants — `FontField` offers the fonts of
   * the system, and no asset of the project is one.
   */
  accepts?: readonly AssetType[]
  /**
   * OPENING what the slot holds — the double-click on its picture, and Enter with it. The caller
   * owns it because it alone knows what `value` names; absent, the picture stays inert.
   *
   * One object rather than a label and a callback side by side, as `ChannelDerivation` and
   * `EmptyStateAction` are: two props that must travel together are two props that can be split,
   * and a caller passing the callback alone would lose the button with nothing to say so. The
   * hint is required for the same reason `MenuRow` demands one — the label reads « Open the
   * texture » while a single click opens the menu instead, and only the hint says which gesture.
   */
  open?: { label: string; hint: string; run: () => void }
}

/**
 * One texture slot: what it holds, and a menu of what the project can put in it. What travels is
 * the asset's identifier and never an image — the engine loads, caches and frees the picture.
 *
 * **The line itself is the menu's trigger.** It carried a button on its end instead, and that
 * button was the one way in: a 28px thumbnail beside a name reads as a picture rather than as a
 * control, so a whole row of the inspector looked like something to read. Pressing what one is
 * trying to change is the shorter rule, and it leaves the end of the row to the one action that
 * is not "change this" — emptying it.
 */
export function TextureField({
  label,
  value,
  options,
  onChange,
  emptyLabel,
  clearLabel,
  chooseLabel,
  emptyHint,
  optionHint,
  noOptionLabel,
  noOptionHint,
  accepts,
  open,
}: TextureFieldProps) {
  const chosen = useMemo(() => options.find(option => option.id === value), [options, value])
  /**
   * "None" is one of the choices, not a separate button: choosing no texture is choosing. Never
   * fewer than two, as `ChannelTile` counts them and for the same reason — `useHoverFlyout` shows
   * nothing at all below two, and a project holding no picture left the whole line pressable and
   * silent.
   */
  const flyout = useHoverFlyout(Math.max(options.length + 1, 2))
  // The same sentence for every option row: one object, not one per picture the project holds.
  const optionTip = HINT_RIGHT(optionHint)

  const picture = <Thumbnail url={chosen?.url} className={FIELD_THUMBNAIL} />

  return (
    <DroppableSlot accepts={accepts} onDrop={onChange}>
      {/* Laid over the row rather than around it, as `ChannelTile` does and for the same reason
          `OVERLAY_BUTTON` gives. Positioned, so it paints over the row's own text; FIRST among
          this box's positioned children, so the two controls below — which are `relative` for
          exactly this — stay on top of it.

          NO fill under the pointer, and none is coming: no line of the inspector answers one,
          which `design/styles.test.ts` holds by naming the two surfaces still allowed to. What
          says this one opens something is its tooltip.

          Nothing on hover either, unlike `MenuButton`: `wrapProps` is deliberately not spread. A
          menu opening under the pointer is what a toolbar wants; a stack of slots that opened one
          each time the pointer crossed a row would be unusable. The ANCHOR, the ARIA pair and the
          `Alt+ArrowDown` chord do come from the hook — writing them out here is how this trigger
          silently lost the chord in the first place. */}
      <button
        type="button"
        {...flyout.triggerProps}
        onClick={flyout.open}
        {...TIP_LEFT(chooseLabel)}
        className={MENU_TRIGGER}
      />

      <Row
        // The picture first, then what the slot holds over the slot's own name — the shape every
        // list of the studio draws, and the reason this stopped drawing its own: a label in the
        // fixed column pushed the thumbnails of one panel out of line with the thumbnails of the
        // next, and a reader looking for pictures found them in two different places.
        media={
          /* Guarded on what the slot RESOLVED to, never on the id it holds: a document outlives
             the picture it points at, and an id whose asset has left the project drew the empty
             label beside a button offering to open something no longer there. A focus stop that
             leads nowhere is also one more Tab to cross.

             `relative` is what keeps it reachable: the trigger above covers the whole line, and a
             static child of a row paints under a positioned sibling whatever the DOM order. Two
             surfaces, two gestures — the picture opens what the slot holds, the rest of the line
             offers to change it. */
          open && chosen ? (
            <button
              type="button"
              {...activation(open.run)}
              {...TIP_LEFT(open.label, false, open.hint)}
              className={OPEN_PICTURE}
            >
              {picture}
            </button>
          ) : (
            picture
          )
        }
        title={chosen?.name ?? emptyLabel}
        subtitle={label}
        tip={TIP_LEFT}
        actions={
          /* Only when there is something to clear: a dead cross on each of the five empty slots
             of a fresh material is five buttons that do nothing. */
          value !== null && (
            <ToolButton
              icon={mdiClose}
              label={clearLabel}
              tooltip={TIP_LEFT}
              variant="header"
              className="relative"
              onClick={() => onChange(null)}
            />
          )
        }
      />

      {flyout.showing && (
        <Flyout
          anchor={flyout.anchor}
          // Below, not beside. The anchor is the whole line now, so the default placement measures
          // from the panel's LEFT edge and hangs the menu out over the viewport, a panel's width
          // away from the row it belongs to. `TitleBarSelect` hangs its own below for the same
          // reason: a wide trigger is answered underneath.
          placement="below"
          role="menu"
          {...flyout.flyoutProps}
        >
          <MenuRow
            label={emptyLabel}
            icon={mdiCheckboxBlankOutline}
            checked={value === null}
            tick="one-of"
            tip={HINT_RIGHT(emptyHint)}
            onSelect={() => {
              onChange(null)
              flyout.close()
            }}
          />
          {/* Says WHY there is no choice, rather than a line that refuses without a word. Offered
              and refused, exactly as `ChannelTile` offers its own: a row that simply is not there
              leaves nothing to read the reason from. */}
          {options.length === 0 ? (
            <MenuRow
              label={noOptionLabel}
              icon={mdiImageOffOutline}
              disabled
              tip={HINT_RIGHT(noOptionHint)}
              onSelect={() => undefined}
            />
          ) : (
            options.map(option => (
              <MenuRow
                key={option.id}
                label={option.name}
                icon={mdiTextureBox}
                checked={option.id === value}
                tick="one-of"
                tip={optionTip}
                onSelect={() => {
                  onChange(option.id)
                  flyout.close()
                }}
              />
            ))
          )}
        </Flyout>
      )}
    </DroppableSlot>
  )
}

/**
 * Never refused, and that is a decision rather than an omission: with nothing to offer, the menu
 * opens on a single row that says so. A disabled cover the size of the line looked like every
 * other line and did nothing at all when pressed — and it would have swallowed the slot's own
 * drop, since a disabled control eats pointer events without letting them bubble and `DragEvent`
 * is one of them.
 */
const MENU_TRIGGER = cn(OVERLAY_BUTTON, 'rounded-(--radius-sc-md)')

/** The picture's own press, which is a second surface rather than a second meaning of one gesture. */
const OPEN_PICTURE =
  'relative shrink-0 cursor-pointer rounded-(--radius-sc-md) border-none bg-transparent p-0'

/**
 * The row itself, made a drop target only where a drop means something.
 *
 * Wrapped rather than made conditional inside the row: `AssetDropTarget` owns the outline that
 * says WHICH slot a drop would land in, and a field that mounted one unconditionally would light
 * up on a drag it has no use for. `exclusive`, because these slots sit inside the panel's own
 * target — without it both would frame at once and the answer would name two places.
 *
 * NOT `AssetDropField`, whose name is one letter away: that one is a form control — it registers
 * with react-hook-form, draws an input, and holds the chosen id itself. This holds nothing.
 */
function DroppableSlot({
  accepts,
  onDrop,
  children,
}: {
  accepts?: readonly AssetType[]
  onDrop: (assetId: string) => void
  children: ReactNode
}) {
  /**
   * The height only — `Row` draws the flex line itself, and a second one around it would centre a
   * full-height child inside a box it is already the size of.
   *
   * STATED, and at the stacked gauge: `Row` sizes itself against its parent (`h-full`), which
   * against a `min-height` alone computes to `auto` and gives no height at all. And the gauge is
   * the taller one because this row now stacks two steps of text — `--sc-control` holds 27.5px of
   * them edge to edge in comfort and overflows in compact, which `index.css` says at its own line.
   *
   * The negative inset cancels the one `Row` carries: every list of the studio wants those four
   * pixels, and the inspector is the one place that does not — `FIELD_ROW` has none, deliberately,
   * so that the two families of property line start at the same x.
   *
   * `relative` because this box is what the menu trigger covers. Here rather than on a wrapper of
   * its own: this element is already exactly the row, and a second one inside it would be a node
   * whose only class is `relative`.
   */
  const shape = 'relative h-(--sc-row-stacked) min-w-0 -mx-1'

  if (!accepts) return <div className={shape}>{children}</div>

  return (
    <AssetDropTarget
      accepts={accepts}
      exclusive
      onDrop={asset => onDrop(asset.id)}
      className={shape}
    >
      {children}
    </AssetDropTarget>
  )
}
