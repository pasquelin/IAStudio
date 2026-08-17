import { dragListChannel } from '@/helpers/drag'

/**
 * The channel a list of the project folder drags on, shared by the tree and the grid.
 *
 * One channel and not one per surface: the two are the same entries drawn two ways, a file picked
 * up in either must be droppable in the other, and two spellings of one MIME type is a drop the
 * browser refuses without a word — `carries` is what a target asks before it may call
 * `preventDefault`, and it compares the string.
 *
 * The type still says `tree-row`, which is where it was declared: renaming it would change nothing
 * a user can see and everything a half-updated target reads.
 */
export const rowDrag = dragListChannel('application/x-scenario-tree-row')
