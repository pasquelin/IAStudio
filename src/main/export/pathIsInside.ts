import { isAbsolute, relative, sep } from 'node:path'

/**
 * Whether `target` sits under `root` — `join` having resolved whatever `..` the name carried.
 *
 * 🛑 The first SEGMENT: `startsWith('..')` refuses a file named `..notes`, and `..${sep}` alone
 * lets the parent folder itself through.
 */
export function pathIsInside(root: string, target: string): boolean {
  const within = relative(root, target)
  return within !== '' && within !== '..' && !within.startsWith(`..${sep}`) && !isAbsolute(within)
}
