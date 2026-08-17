/**
 * The four screens of the usage window, in the order its rail lists them.
 *
 * Here rather than in `UsageWindow.tsx`, and that is what splitting the window taught: its body
 * became a file of its own and still needed this type, so importing it back from the parent made
 * a cycle the ratchet caught on sight. **A type two halves of a component share belongs to
 * neither of them.**
 */
export type UsageSectionId = 'overview' | 'models' | 'activities' | 'journal'

export const SECTIONS: readonly UsageSectionId[] = ['overview', 'models', 'activities', 'journal']
