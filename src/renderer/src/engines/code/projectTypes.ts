import { byCodeUnit } from '@shared/text'

/** 🛑 ONE family, and it grows with the lot that FILLS it — never ahead of one. */
export type ProjectNames = {
  /** Component types the studio has a descriptor for. */
  components: readonly string[]
}

/**
 * 🛑 What turns a typo RED before a Play: `self.get('Helth')` is not a string the union holds.
 * An empty list widens back to `string` rather than `never`, or a project holding none would
 * make every use of the name an error.
 */
export function projectTypes(names: ProjectNames): string {
  const held = [...new Set(names.components)].filter(one => one.length > 0).sort(byCodeUnit)
  // Nothing at all rather than an empty union: `StudioNames` stays un-augmented, and every name
  // of `studio.d.ts` widens back to `string` on its own.
  if (held.length === 0) return EMPTY

  return [
    '// Generated for THIS project. Nothing edits it: it is rebuilt whenever the project changes.',
    "declare module '@studio' {",
    '  interface StudioNames {',
    `    components: ${held.map(one => JSON.stringify(one)).join(' | ')}`,
    '  }',
    '}',
    '',
  ].join('\n')
}

const EMPTY = '// This project declares no name of its own yet.\n'
