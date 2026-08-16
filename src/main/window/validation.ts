import { z } from 'zod'
import type { ContextMenuItem } from '@shared/domain/context-menu'
import { PATH_KINDS, type PathKind } from '@shared/domain/settings-registry'
import { parseBase64 } from '@main/scenario/validation'

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

/** A file name and nothing else: a separator here would write outside the folder that was picked. */
const fileName = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .refine(value => !value.includes('/') && !value.includes('\\') && !value.includes('..'), {
    message: 'expected a plain file name',
  })

export function parseFileName(value: unknown): string {
  return fileName.parse(value)
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
const contextMenuItems = z
  .array(
    z.object({
      id: z.string().min(1).max(120),
      // A rule carries no label, which is the one row where the empty string is the truth.
      label: z.string().max(200),
      separator: z.literal(true).optional(),
      enabled: z.boolean().optional(),
      icon: menuIcon.optional(),
      // Electron parses this itself and THROWS on a shape it does not know, which would take the
      // menu down with it. Bounded to what `acceleratorOf` produces: modifier names, `+`, and a
      // key of letters, digits or one of the punctuation marks it spells out.
      accelerator: z
        .string()
        .max(60)
        .regex(/^(?:[A-Za-z]+\+)*[A-Za-z0-9,.=\-/\\]+$/)
        .optional(),
      tooltip: z.string().min(1).max(300).optional(),
    }),
  )
  .min(1)
  // Well above the longest menu of the studio — an asset with every intent it can have — and low
  // enough that a runaway list cannot ask the system to draw ten thousand rows.
  .max(40)

export function parseContextMenuItems(value: unknown): ContextMenuItem[] {
  return contextMenuItems.parse(value)
}
