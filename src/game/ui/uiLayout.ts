// SPDX-License-Identifier: MIT

import type {
  UiAlign,
  UiBox,
  UiBoxes,
  UiEdges,
  UiElement,
  UiJustify,
  UiPlacement,
  UiPoint,
  UiScreen,
  UiSize,
  UiSizing,
} from '@shared/domain/ui'
import { childrenOf } from './uiTree'

/**
 * How wide a word is in a given face — the one question a layout cannot answer on its own, hence
 * handed in. `available` is the room to spill into, which is what a wrapping text needs.
 */
export type UiMeasure = (element: UiElement, available: UiSize) => UiSize

/**
 * Where every element of an interface lands, in the space it is solved against.
 *
 * 🛑 **Pure, and that is the whole point**: a renderer poses these boxes and computes none of its
 * own, so a Pixi or world-space one draws the same document the same way — and the editor snaps
 * against exact numbers rather than what a browser reports a frame late.
 *
 * The viewport is handed in, never read off `design`: the anchors are what absorb another shape.
 */
export function layoutOf(root: UiScreen, viewport: UiSize, measure: UiMeasure): UiBoxes {
  const boxes = new Map<string, UiBox>()
  const frame = {
    x: 0,
    y: 0,
    width: Math.max(0, viewport.width),
    height: Math.max(0, viewport.height),
  }

  place(root, frame, boxes, measure)
  return boxes
}

/** One element into the frame its parent left it, then everything under it. */
function place(
  element: UiElement,
  frame: UiBox,
  boxes: Map<string, UiBox>,
  measure: UiMeasure,
): void {
  boxes.set(element.id, frame)

  const children = childrenOf(element)
  if (children.length === 0) return

  const content = inset(frame, element.style.padding)
  for (const [child, box] of arrange(element, children, content, measure)) {
    place(child, box, boxes, measure)
  }
}

/** One element and the box its parent left it. */
type Placed = readonly [UiElement, UiBox]

/** Where a container puts its children — the one place a type decides anything about layout. */
function arrange(
  parent: UiElement,
  children: readonly UiElement[],
  content: UiBox,
  measure: UiMeasure,
): readonly Placed[] {
  if (parent.type === 'stack') return stacked(parent.stack, children, content, measure)
  if (parent.type === 'grid') return gridded(parent.grid, children, content, measure)

  return children.map((child): Placed => [child, freely(child, content, measure)])
}

/**
 * An element hung on a point of its parent by a point of itself, then nudged. Both, never one: a
 * badge keeping its right edge on its parent's needs the pair, or it drifts as it grows.
 */
function freely(element: UiElement, content: UiBox, measure: UiMeasure): UiBox {
  // The margin comes off the room FIRST and is never added back: taking it twice put a
  // right-anchored element outside its parent by exactly its own left margin.
  const room = inset(content, element.place.margin)
  const size = sizeOf(element, { width: room.width, height: room.height }, measure)
  const anchor = FRACTION[element.place.anchor]
  const pivot = FRACTION[element.place.pivot]

  return {
    x: room.x + room.width * anchor.x - size.width * pivot.x + element.place.offset.x,
    y: room.y + room.height * anchor.y - size.height * pivot.y + element.place.offset.y,
    width: size.width,
    height: size.height,
  }
}

type Stack = Extract<UiElement, { type: 'stack' }>['stack']

/**
 * A row or a column. `grow` shares out what is left AFTER the fixed children have taken theirs,
 * so a spacer of grow 1 beside two labels pushes them apart rather than squashing them.
 */
function stacked(
  stack: Stack,
  children: readonly UiElement[],
  content: UiBox,
  measure: UiMeasure,
): readonly Placed[] {
  const across = stack.direction === 'row'
  const room = { width: content.width, height: content.height }
  const sizes = children.map(child => alongZeroed(child, room, measure, across))

  const lines = stack.wrap
    ? wrapped(children, sizes, across ? content.width : content.height, stack.gap, across)
    : [children.map((_, index) => index)]

  // One line takes the whole cross room, several take what each holds — the same rule flexbox
  // keeps, and what makes `stretch` mean one thing in a row and in a column alike.
  const whole = across ? content.height : content.width
  const placed: Placed[] = []
  let offCross = 0

  for (const line of lines) {
    const thickness =
      lines.length === 1
        ? whole
        : Math.max(0, ...line.map(index => spanCross(children, sizes, index, across)))
    const grown = grownAlong(line, children, sizes, content, stack, across)
    let along = startOf(grown.spare, line.length, stack.justify)
    // Invariant across the line: its three arguments do not move once the line is grown.
    const spread = gapOf(grown.spare, line.length, stack.justify)

    for (const [rank, index] of line.entries()) {
      const child = children[index]
      const size = grown.sizes[rank]
      if (!child || !size) continue

      placed.push([
        child,
        laid(child, size, content, along, offCross, thickness, stack.align, across),
      ])
      along += spanMain(child, size, across) + stack.gap + spread
    }
    offCross += thickness + stack.gap
  }

  return placed
}

/**
 * A child sized as usual, except that `stretch` ALONG the stack starts at nothing: what it
 * asks for is a SHARE of the leftover, and a full-room base would leave none to share.
 */
function alongZeroed(child: UiElement, room: UiSize, measure: UiMeasure, across: boolean): UiSize {
  const size = sizeOf(child, room, measure)
  const along = across ? child.place.size.width : child.place.size.height
  if (along.mode !== 'stretch') return size

  return across ? { ...size, width: 0 } : { ...size, height: 0 }
}

/** What a child occupies along the stack, its own margins included. */
const spanMain = (child: UiElement, size: UiSize, across: boolean): number =>
  main(size, across) + (across ? edgesX(child) : edgesY(child))

const spanCross = (
  children: readonly UiElement[],
  sizes: readonly UiSize[],
  index: number,
  across: boolean,
): number => {
  const child = children[index]
  if (!child) return 0

  return cross(sizes[index], across) + (across ? edgesY(child) : edgesX(child))
}

const edgesX = (child: UiElement): number => child.place.margin.left + child.place.margin.right

const edgesY = (child: UiElement): number => child.place.margin.top + child.place.margin.bottom

/** The children of one line, resized by their share of the room nothing fixed has claimed. */
function grownAlong(
  line: readonly number[],
  children: readonly UiElement[],
  sizes: readonly UiSize[],
  content: UiBox,
  stack: Stack,
  across: boolean,
): { sizes: UiSize[]; spare: number } {
  const room = across ? content.width : content.height
  const taken = line.reduce((sum, index) => sum + main(sizes[index], across), 0)
  const gaps = stack.gap * Math.max(0, line.length - 1)
  const spare = Math.max(0, room - taken - gaps)
  const shares = line.reduce((sum, index) => sum + shareOf(children[index], across), 0)

  const grown = line.map(index => {
    const size = sizes[index] ?? { width: 0, height: 0 }
    const child = children[index]
    const share = shareOf(child, across)
    if (!child || shares === 0 || share === 0) return size

    // Bounded again: `grow` used to be added AFTER `heldTo`, so a bar with a max width blew
    // through it the moment it also asked to grow.
    const extra = (spare * share) / shares
    return heldTo(
      across ? { ...size, width: size.width + extra } : { ...size, height: size.height + extra },
      child.place,
    )
  })

  // No slack left to justify once something has grown into it — the two share one room, and
  // handing the same pixels to both would push the line past its own edge.
  return { sizes: grown, spare: shares === 0 ? spare : 0 }
}

/**
 * What a child asks for of the room nothing fixed has claimed. `stretch` ALONG a stack counts as
 * one share, never the whole room — taken whole, every sibling landed on top of the others.
 */
function shareOf(child: UiElement | undefined, across: boolean): number {
  if (!child) return 0
  const along = across ? child.place.size.width : child.place.size.height

  return along.mode === 'stretch' ? Math.max(1, child.place.grow) : child.place.grow
}

/** Which indices share a line, once the room along the stack runs out. */
function wrapped(
  children: readonly UiElement[],
  sizes: readonly UiSize[],
  room: number,
  gap: number,
  across: boolean,
): number[][] {
  const lines: number[][] = []
  let line: number[] = []
  let along = 0

  for (const index of children.keys()) {
    const size = main(sizes[index], across)
    // A single child wider than the line still gets one of its own: wrapping it away would
    // leave an empty line and the element nowhere.
    if (line.length > 0 && along + gap + size > room) {
      lines.push(line)
      line = []
      along = 0
    }
    line.push(index)
    along += (line.length > 1 ? gap : 0) + size
  }
  if (line.length > 0) lines.push(line)

  return lines
}

type Grid = Extract<UiElement, { type: 'grid' }>['grid']

/**
 * Columns of equal width, rows as tall as what they hold. Rows follow from the children rather
 * than being named: a grid told both ways cannot take one more item without being edited.
 */
function gridded(
  grid: Grid,
  children: readonly UiElement[],
  content: UiBox,
  measure: UiMeasure,
): readonly Placed[] {
  const columns = Math.max(1, Math.round(grid.columns))
  const width = Math.max(0, (content.width - grid.gap * (columns - 1)) / columns)
  const sizes = children.map(child => sizeOf(child, { width, height: content.height }, measure))

  const placed: Placed[] = []
  let y = content.y

  for (let first = 0; first < children.length; first += columns) {
    const row = children.slice(first, first + columns)
    const tall = Math.max(0, ...row.map((_, rank) => sizes[first + rank]?.height ?? 0))

    for (const [rank, child] of row.entries()) {
      const size = sizes[first + rank] ?? { width: 0, height: 0 }
      const cell = inset(
        { x: content.x + rank * (width + grid.gap), y, width, height: tall },
        child.place.margin,
      )
      placed.push([child, alignedIn(cell, size, grid.align)])
    }
    y += tall + grid.gap
  }

  return placed
}

/** An element inside a cell, stretched or set against one of its edges. */
function alignedIn(cell: UiBox, size: UiSize, align: UiAlign): UiBox {
  if (align === 'stretch') return cell

  // Never trimmed to the column: an element wider than its cell overflows, as it does in a
  // stack. Reporting the column width instead told the inspector a size nobody typed.
  const shift = crossShift(cell.width, size.width, align)
  return { x: cell.x + shift, y: cell.y, width: size.width, height: size.height }
}

/** One child of a stack, on the line it landed on. */
function laid(
  child: UiElement,
  size: UiSize,
  content: UiBox,
  along: number,
  offCross: number,
  thickness: number,
  align: UiAlign,
  across: boolean,
): UiBox {
  const margin = child.place.margin
  // Stretching fills the LINE across the stack, whichever way it runs — a column that filled
  // the whole container instead overran every line but the first.
  const room = thickness - (across ? edgesY(child) : edgesX(child))
  const width = across ? size.width : align === 'stretch' ? room : size.width
  const height = across ? (align === 'stretch' ? room : size.height) : size.height
  const shift = align === 'stretch' ? 0 : crossShift(room, across ? height : width, align)

  return across
    ? {
        x: content.x + along + margin.left,
        y: content.y + offCross + shift + margin.top,
        width,
        height,
      }
    : {
        x: content.x + offCross + shift + margin.left,
        y: content.y + along + margin.top,
        width,
        height,
      }
}

const crossShift = (thickness: number, size: number, align: UiAlign): number =>
  align === 'center' ? (thickness - size) / 2 : align === 'end' ? thickness - size : 0

/** Where the first child of a line begins, once `justify` has said what to do with the slack. */
function startOf(spare: number, count: number, justify: UiJustify): number {
  if (justify === 'center') return spare / 2
  if (justify === 'end') return spare
  if (justify === 'around' && count > 0) return spare / count / 2
  return 0
}

/** What `justify` adds between two children, on top of the gap. */
function gapOf(spare: number, count: number, justify: UiJustify): number {
  if (justify === 'between' && count > 1) return spare / (count - 1)
  if (justify === 'around' && count > 0) return spare / count
  return 0
}

/**
 * How big one element is, before its parent has any say. An `auto` container is measured by
 * laying its children out and taking what they cover; a leaf falls to `measure`, the only thing
 * here that knows what a font does.
 */
function sizeOf(element: UiElement, available: UiSize, measure: UiMeasure): UiSize {
  const place = element.place
  const auto = autoSize(element, available, measure)

  return heldTo(
    {
      width: extentOn(place.size.width, available.width, auto.width),
      height: extentOn(place.size.height, available.height, auto.height),
    },
    place,
  )
}

/**
 * 🛑 A container measured this way is arranged TWICE — once for the answer, once for real — so
 * the cost is quadratic in DEPTH, never exponential. Measured 2026-08-28: 26 nested auto panels
 * stay under 0,5 ms, inside the noise of the JIT. Memoising it would buy nothing today.
 */
function autoSize(element: UiElement, available: UiSize, measure: UiMeasure): UiSize {
  if (!wantsAuto(element.place)) return { width: 0, height: 0 }

  const children = childrenOf(element)
  if (children.length === 0) return measure(element, available)

  const padding = element.style.padding
  const room = inset({ x: 0, y: 0, ...available }, padding)
  const covered = arrange(element, children, room, measure).reduce(
    (box, [, child]) => ({
      width: Math.max(box.width, child.x + child.width),
      height: Math.max(box.height, child.y + child.height),
    }),
    { width: 0, height: 0 },
  )

  return { width: covered.width + padding.right, height: covered.height + padding.bottom }
}

const wantsAuto = (place: UiPlacement): boolean =>
  place.size.width.mode === 'auto' || place.size.height.mode === 'auto'

function extentOn(sizing: UiSizing, available: number, auto: number): number {
  if (sizing.mode === 'stretch') return available
  if (sizing.mode === 'auto') return auto
  if (sizing.length.unit === 'percent') return (available * sizing.length.value) / 100

  return sizing.length.value
}

/**
 * Bounds and ratio, in that order. Width leads and height follows it, so an element told both a
 * ratio and two bounds is never left between two answers — the bounds are re-applied after.
 */
function heldTo(size: UiSize, place: UiPlacement): UiSize {
  const width = heldBetween(size.width, place.min.width, place.max.width)
  const ratioed = place.aspect > 0 ? width / place.aspect : size.height

  return { width, height: heldBetween(ratioed, place.min.height, place.max.height) }
}

/** A `max` of zero is no maximum at all — an element cannot be told to have no width. */
const heldBetween = (value: number, min: number, max: number): number =>
  Math.max(min, max > 0 ? Math.min(max, value) : value)

const main = (size: UiSize | undefined, across: boolean): number =>
  across ? (size?.width ?? 0) : (size?.height ?? 0)

const cross = (size: UiSize | undefined, across: boolean): number =>
  across ? (size?.height ?? 0) : (size?.width ?? 0)

function inset(box: UiBox, edges: UiEdges): UiBox {
  return {
    x: box.x + edges.left,
    y: box.y + edges.top,
    width: Math.max(0, box.width - edges.left - edges.right),
    height: Math.max(0, box.height - edges.top - edges.bottom),
  }
}

const FRACTION: Record<UiPlacement['anchor'], UiPoint> = {
  topLeft: { x: 0, y: 0 },
  top: { x: 0.5, y: 0 },
  topRight: { x: 1, y: 0 },
  left: { x: 0, y: 0.5 },
  center: { x: 0.5, y: 0.5 },
  right: { x: 1, y: 0.5 },
  bottomLeft: { x: 0, y: 1 },
  bottom: { x: 0.5, y: 1 },
  bottomRight: { x: 1, y: 1 },
}
