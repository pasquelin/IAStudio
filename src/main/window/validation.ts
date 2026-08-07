import { z } from 'zod'
import { PATH_KINDS, type PathKind } from '@shared/domain/settings-registry'

// Throws rather than falling back: the value decides which native picker opens, and a renderer
// is what sends it. Built from the shared list, never retyped.
const pathKind = z.enum(PATH_KINDS)

export function parsePathKind(value: unknown): PathKind {
  return pathKind.parse(value)
}
