import { z } from 'zod'
import { PATH_KINDS, type PathKind } from '@shared/domain/settings-registry'

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

/** Only the payload: a `data:` prefix would be written into the file as if it were pixels. */
const base64Payload = z
  .string()
  .min(1)
  // The head alone: the payload is megabytes long, and the one mistake worth catching — a
  // `data:image/png;base64,` prefix — is at the front. An unanchored class would match `data`
  // and let the rest through.
  .refine(value => /^[A-Za-z0-9+/=]+$/.test(value.slice(0, 64)), 'expected raw base64')

export function parseBase64Payload(value: unknown): string {
  return base64Payload.parse(value)
}
