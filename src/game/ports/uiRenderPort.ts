// SPDX-License-Identifier: MIT

import type { UiBoxes, UiDocument, UiPoint, UiSize } from '@shared/domain/ui'

/** What a running interface holds of its own — a caption, a bar's fill, a box ticked. */
export type UiValue = string | number | boolean

/** By element id. An element absent from it wears what its document says. */
export type UiValues = ReadonlyMap<string, UiValue>

/**
 * For a surface with nothing live — the editor. Shared rather than built per frame: a renderer
 * skipping what has not changed compares this by IDENTITY, and a fresh map every draw defeats it.
 */
export const NO_UI_VALUES: UiValues = new Map()

/**
 * One interface, ready to be drawn: what it IS, where its elements landed, and what is live in
 * it. `order` is the pile — the last opened on top — and the renderer paints in that order.
 */
export type UiFrame = {
  readonly ui: string
  readonly document: UiDocument
  readonly boxes: UiBoxes
  readonly values: UiValues
  readonly order: number
}

/** Which element of which interface a point landed on. */
export type UiHit = { ui: string; element: string }

/**
 * What draws interfaces, for the environment they are drawn in — the studio's editor, an
 * exported page, one day a texture in the world.
 *
 * It follows `RenderPort`: the runtime publishes a STATE and whatever draws decides what that
 * looks like. So there is no `open`, no `fade`, no `highlight` here — a frame handed over is
 * everything there is to say.
 *
 * 🛑 `pick` takes a point in the interface's own space, never screen pixels, and answers from
 * the boxes alone. Reading the live tree back — `elementFromPoint`, `getBoundingClientRect` —
 * would make the model depend on one renderer and leave a world-space one with no answer at all.
 */
export type UiRenderPort = {
  draw: (frames: readonly UiFrame[]) => void
  pick: (point: UiPoint) => UiHit | null
  resize: (size: UiSize) => void
  dispose: () => void
}
