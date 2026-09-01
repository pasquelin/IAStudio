import { z } from 'zod'
import { UI_VERSION } from '@shared/domain/ui'

/**
 * What the file layer checks of an interface, and no more.
 *
 * 🛑 Shallow ON PURPOSE. The window reads the tree with type guards that drop what they cannot
 * make sense of, keeping the rest; this side only answers « is this an interface at all », so a
 * save cannot write a montage into a `.ui.json`, and a listing never walks a document to say
 * what it is. The main process owns every window, and a deep parse per file is a freeze.
 */
const uiFile = z.object({
  // Bounded high: a file written by a later build is refused rather than rewritten by this one.
  version: z.number().int().min(1).max(UI_VERSION),
  mode: z.string().min(1),
  root: z.object({ type: z.literal('screen') }).loose(),
})

export const isUiFile = (value: unknown): boolean => uiFile.safeParse(value).success
