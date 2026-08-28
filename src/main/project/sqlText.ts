/**
 * The two pieces of SQL that get written by hand wherever a query is composed, and were spelt
 * five times between the catalogue and the memory before they were named.
 */

/** `?, ?, ?` for a list of values. Written out because SQLite binds no arrays. */
export function holes(count: number): string {
  return Array.from({ length: count }, () => '?').join(', ')
}

/** `%` and `_` are wildcards: typed by a person they must match themselves, not everything. */
export function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, character => `\\${character}`)
}
