import { z } from 'zod'
import type { ContextMenuItem } from '@shared/domain/contextMenu'
import { PATH_KINDS, type PathKind } from '@shared/domain/settingsRegistry'
import { parseBase64 } from '@main/scenario/validation'
import { pathSegment } from '@main/validation'

// Throws rather than falling back: the value decides which native picker opens, and a renderer
// is what sends it. Built from the shared list, never retyped.
const pathKind = z.enum(PATH_KINDS)

export function parsePathKind(value: unknown): PathKind {
  return pathKind.parse(value)
}

// Where the picker opens. Undefined is normal — it then opens wherever the OS last was.
const startIn = z.string().min(1).optional()

export function parseStartIn(value: unknown): string | undefined {
  return startIn.parse(value)
}

export function parseFileName(value: unknown): string {
  return pathSegment.parse(value)
}

/** The same rule the upload path applies: only the payload, never a data URL. */
export function parseBase64Payload(value: unknown): string {
  return parseBase64(value)
}

/**
 * A menu icon on its way to `nativeImage.addRepresentation`, which takes any URL string it is
 * handed. A PNG data URL and nothing else: `file:` would read whatever path a window named, and
 * an `http:` one would have the main process fetch it.
 *
 * The cap is generous rather than tight — a 32 px glyph encodes to about a kilobyte, and the
 * point of the bound is that a window cannot hand over a bitmap it never drew.
 */
const menuIcon = z
  .string()
  .max(64_000)
  .refine(value => /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(value))

/**
 * The rows a window asks the system to draw. Every field crosses the boundary as it is written
 * on screen, so every field is checked here: this is the one channel where a renderer composes
 * something the main process hands straight to the platform.
 *
 * `label` is not trimmed to a path segment or anything like it — it is a sentence in the user's
 * language, and the only thing that can go wrong with it is length.
 */
const contextMenuLeaf = z.object({
  id: z.string().min(1).max(120),
  // A rule carries no label, which is the one row where the empty string is the truth.
  label: z.string().max(200),
  separator: z.literal(true).optional(),
  enabled: z.boolean().optional(),
  icon: menuIcon.optional(),
  /**
   * Electron parses this itself and THROWS on a shape it does not know — the menu then never
   * opens, and what the window hears is a rejected invoke rather than a menu.
   *
   * Bounded to what `acceleratorOf` actually produces: its four modifier names, spelled out
   * rather than "any word" — `Foobar+A` used to pass a rule whose own comment claimed it
   * could not — then `+`, then a key of letters, digits or the punctuation it names.
   */
  accelerator: z
    .string()
    .max(60)
    .regex(/^(?:(?:CmdOrCtrl|Ctrl|Alt|Shift)\+)*[A-Za-z0-9,.=\-/\\]+$/)
    .optional(),
  tooltip: z.string().min(1).max(300).optional(),
})

// One level, spelled as two schemas rather than as a recursion with a depth to count: a leaf
// has no `submenu` field at all, so nothing deeper can be described, let alone sent.
const contextMenuItem = contextMenuLeaf
  .extend({ submenu: z.array(contextMenuLeaf).min(1).max(40).optional() })
  // A rule that opens onto rows is neither, and this schema is the only thing standing between
  // the two: the template builds a labelled parent from it and draws no rule at all.
  .refine(item => !(item.separator && item.submenu))

const contextMenuItems = z
  .array(contextMenuItem)
  .min(1)
  // Well above the longest menu of the studio — an asset with every intent it can have — and low
  // enough that a runaway list cannot ask the system to draw ten thousand rows.
  .max(40)

export function parseContextMenuItems(value: unknown): ContextMenuItem[] {
  return contextMenuItems.parse(value)
}
