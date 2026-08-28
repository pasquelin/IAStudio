// SPDX-License-Identifier: MIT

import type {
  UiBox,
  UiEdges,
  UiElement,
  UiFill,
  UiFit,
  UiPoint,
  UiSize,
  UiStyle,
  UiText,
} from '@shared/domain/ui'
import type { AssetPort } from '../ports/assetPort'
import type { UiFrame, UiHit, UiRenderPort, UiValue, UiValues } from '../ports/uiRenderPort'
import { childrenOf } from '../ui/uiTree'
import { pickAt, piled, type UiPickOptions } from '../ui/uiPick'
import { UI_LINE_HEIGHT, cssFontOf } from './canvasUiMeasure'

export type DomUiRendererOptions = {
  /** What the overlay is laid inside. The renderer owns one child of it and nothing else. */
  host: HTMLElement
  assets: AssetPort
  /** Editing only: a locked element is not pickable. The runtime leaves this alone. */
  picking?: UiPickOptions
}

/**
 * An interface drawn as plain DOM — no React, no stylesheet, nothing of the studio. It POSES the
 * boxes it is handed and computes none, which `main/game-imports.test.ts` holds by refusing the
 * names that would read the tree back.
 *
 * 🛑 FLAT, so two things nesting gives for free are done by hand and a third is NOT done at all:
 * a `scroll` does not crop what it holds, and a group's opacity is applied per element rather
 * than to the subtree once — two overlapping children of a faded parent darken each other.
 */
export function createDomUiRenderer(options: DomUiRendererOptions): UiRenderPort {
  const owner = options.host.ownerDocument
  const root = owner.createElement('div')
  root.dataset.uiRoot = ''
  // 🛑 Pointer-transparent as a whole: gestures are read by whoever hosts this and answered by
  // `pick`, so what is on screen never becomes a second, disagreeing hit-test. The ink is the
  // one colour a control falls back on — the format gives a tick and a thumb none of their own.
  root.style.cssText = 'position:absolute;inset:0;overflow:hidden;pointer-events:none;color:#ffffff'
  options.host.appendChild(root)

  const memory = new Map<string, Held>()
  let drawn: readonly UiFrame[] = []

  return {
    draw: (frames: readonly UiFrame[]): void => {
      drawn = frames
      const wanted = laidOut(frames)
      const keys = new Set<string>()
      let at = root.firstChild

      for (const one of wanted) {
        keys.add(one.key)
        const node = held(owner, options.assets, memory, one)
        // A cursor rather than `children[index]`: that collection is live, and every insert
        // below invalidates it — one read per element per frame for an answer already held.
        if (at === node) at = node.nextSibling
        else root.insertBefore(node, at)
      }

      for (const [key, one] of memory) {
        if (keys.has(key)) continue
        one.node.remove()
        memory.delete(key)
      }
    },
    pick: (point: UiPoint): UiHit | null => pickAt(drawn, point, options.picking),
    resize: (size: UiSize): void => {
      root.style.width = `${size.width}px`
      root.style.height = `${size.height}px`
    },
    dispose: (): void => {
      root.remove()
      memory.clear()
    },
  }
}

/** One element of one interface, ready to be posed. */
type Posed = {
  key: string
  ui: string
  element: UiElement
  box: UiBox
  /** Multiplied down the tree, which is what nesting would have given for free. */
  opacity: number
  values: UiValues
}

/**
 * What the last draw posed, so a frame that changed nothing does no work at all.
 *
 * 🛑 The guard is on IDENTITY, not on the finished CSS: `mapped` shares every untouched subtree,
 * so an element the drag did not reach is the same object frame after frame. Comparing built
 * strings meant composing them for all of them, every frame, only to throw them away — measured
 * at 0,267 ms for 200 elements against 0,020 ms for this walk.
 */
type Held = {
  node: HTMLElement
  element: UiElement
  box: UiBox
  opacity: number
  values: UiValues
}

function laidOut(frames: readonly UiFrame[]): readonly Posed[] {
  const posed: Posed[] = []

  for (const frame of piled(frames)) gather(frame, frame.document.root, 1, posed)

  return posed
}

function gather(frame: UiFrame, element: UiElement, above: number, into: Posed[]): void {
  if (!element.visible) return

  const opacity = above * element.style.opacity
  const box = frame.boxes.get(element.id)
  // After its parent and before its children, which IS the paint order of a flat overlay. The
  // key holds both names: two interfaces open at once each carry their own root, called `root`.
  if (box) {
    into.push({
      key: `${frame.ui}\u0000${element.id}`,
      ui: frame.ui,
      element,
      box,
      opacity,
      values: frame.values,
    })
  }

  for (const child of childrenOf(element)) gather(frame, child, opacity, into)
}

function held(
  owner: Document,
  assets: AssetPort,
  memory: Map<string, Held>,
  one: Posed,
): HTMLElement {
  const last = memory.get(one.key)
  if (last && unchanged(last, one)) return last.node

  // Rebuilt only when what it IS changed: the inner parts of a bar or a tick follow from the
  // type, and rebuilding them every frame is what a drag cannot afford.
  const node = last && last.element.type === one.element.type ? last.node : made(owner, one)
  if (last && node !== last.node) last.node.replaceWith(node)

  node.style.cssText = cssOf(one, assets)
  inscribe(node, one)
  memory.set(one.key, {
    node,
    element: one.element,
    box: one.box,
    opacity: one.opacity,
    values: one.values,
  })

  return node
}

const unchanged = (last: Held, one: Posed): boolean =>
  last.element === one.element &&
  last.opacity === one.opacity &&
  last.values === one.values &&
  last.box.x === one.box.x &&
  last.box.y === one.box.y &&
  last.box.width === one.box.width &&
  last.box.height === one.box.height

function made(owner: Document, one: Posed): HTMLElement {
  const node = owner.createElement('div')
  node.dataset.uiType = one.element.type
  node.dataset.uiElement = one.element.id
  node.dataset.ui = one.ui
  // The one part a control is made of, created once: a bar's fill, a slider's thumb, a tick, or
  // the line a caption is set on.
  if (HAS_INNER.has(one.element.type)) node.appendChild(owner.createElement('div'))

  return node
}

const HAS_INNER = new Set(['progress', 'slider', 'checkbox', 'text', 'button', 'input'])

/** What the running interface says this element holds, or nothing when it is not live. */
function valueOf(one: Posed): UiValue | null {
  return one.values.get(one.element.id) ?? null
}

function inscribe(node: HTMLElement, one: Posed): void {
  const inner = node.firstElementChild
  if (!(inner instanceof HTMLElement)) return

  const live = valueOf(one)
  const { element } = one

  if (element.type === 'progress') {
    inner.style.cssText = barCss(shareOf(live, element.progress), element.progress.fill)
    return
  }
  if (element.type === 'slider') {
    inner.style.cssText = thumbCss(shareOf(live, element.slider))
    return
  }
  if (element.type === 'checkbox') {
    inner.style.cssText = tickCss(typeof live === 'boolean' ? live : element.checkbox.checked)
    return
  }

  inner.textContent = wordsOf(element, live)
}

/** The words on screen: what the running interface holds, or what the document says. */
function wordsOf(element: UiElement, live: UiValue | null): string {
  if (element.type === 'text' || element.type === 'button') {
    return typeof live === 'string' ? live : element.text.value
  }
  if (element.type !== 'input') return ''

  const value = typeof live === 'string' ? live : element.input.value
  if (value === '') return element.input.placeholder
  return element.input.secret ? SECRET_MARK.repeat(value.length) : value
}

const SECRET_MARK = '\u2022'

/** Zero when the ends meet: a bar from 5 to 5 is not full, it is undefined, and empty is honest. */
function shareOf(
  live: UiValue | null,
  bounds: { value: number; min: number; max: number },
): number {
  const value = typeof live === 'number' ? live : bounds.value
  if (bounds.max <= bounds.min) return 0
  return Math.max(0, Math.min(1, (value - bounds.min) / (bounds.max - bounds.min)))
}

const barCss = (part: number, colour: string): string =>
  `position:absolute;left:0;top:0;bottom:0;width:${part * 100}%;background:${colour}`

const thumbCss = (part: number): string =>
  `position:absolute;top:0;bottom:0;left:${part * 100}%;width:2px;background:currentColor`

const tickCss = (ticked: boolean): string =>
  `position:absolute;inset:25%;background:currentColor;display:${ticked ? 'block' : 'none'}`

function cssOf(one: Posed, assets: AssetPort): string {
  const { element, box } = one
  const said: string[] = [
    'position:absolute',
    'box-sizing:border-box',
    `left:${box.x}px`,
    `top:${box.y}px`,
    `width:${box.width}px`,
    `height:${box.height}px`,
    `opacity:${one.opacity}`,
    ...styleCss(element.style, assets),
  ]

  if (element.type === 'image') {
    said.push(...pictureCss(assets, element.image.assetId, element.image.fit, element.image.tint))
  }
  if (element.type === 'text' || element.type === 'button') said.push(...textCss(element.text))
  if (element.type === 'input')
    said.push('display:flex', 'align-items:center', `font:${FIELD_FACE}`)

  return said.join(';')
}

/** What an unstyled field is set in — the format gives an input no face of its own yet. */
const FIELD_FACE = '400 14px sans-serif'

function styleCss(style: UiStyle, assets: AssetPort): readonly string[] {
  const said = [...fillCss(style.background, assets), `padding:${edgesCss(style.padding)}`]
  if (style.border.width > 0)
    said.push(`border:${style.border.width}px solid ${style.border.color}`)
  if (style.border.radius > 0) said.push(`border-radius:${style.border.radius}px`)

  return said
}

function fillCss(background: UiFill, assets: AssetPort): readonly string[] {
  if (background.kind === 'color') return [`background-color:${background.color}`]
  if (background.kind === 'image') {
    return pictureCss(assets, background.assetId, background.fit, WHITE)
  }
  return []
}

const WHITE = '#ffffff'

const FIT_SIZES: Record<UiFit, string> = {
  contain: 'contain',
  cover: 'cover',
  fill: '100% 100%',
  none: 'auto',
}

/**
 * A tint multiplies, and only when it is not white — a blend mode otherwise costs a compositing
 * layer for no visible change. An id the host cannot serve draws nothing rather than a `url()`
 * the browser asks for again on every repaint.
 */
function pictureCss(
  assets: AssetPort,
  assetId: string,
  fit: UiFit,
  tint: string,
): readonly string[] {
  const url = assetId === '' ? null : assets.urlOf({ kind: 'asset', id: assetId })
  if (url === null) return []

  const said = [
    `background-image:url("${url}")`,
    `background-size:${FIT_SIZES[fit]}`,
    'background-repeat:no-repeat',
    'background-position:center',
  ]
  if (tint.toLowerCase() !== WHITE)
    said.push(`background-color:${tint}`, 'background-blend-mode:multiply')

  return said
}

function textCss(text: UiText): readonly string[] {
  return [
    `font:${cssFontOf(text)}`,
    `line-height:${UI_LINE_HEIGHT}`,
    `color:${text.color}`,
    `text-align:${text.align}`,
    `white-space:${text.wrap ? 'pre-wrap' : 'pre'}`,
    'display:flex',
    'flex-direction:column',
    'justify-content:center',
  ]
}

const edgesCss = (edges: UiEdges): string =>
  `${edges.top}px ${edges.right}px ${edges.bottom}px ${edges.left}px`
