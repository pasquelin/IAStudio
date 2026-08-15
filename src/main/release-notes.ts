/**
 * The body of a GitHub release, taken from `CHANGELOG.md`.
 *
 * Read by `scripts/release-notes.mjs`, which turns an empty answer into an exit code. Why the
 * changelog rather than `--generate-notes` is written where that flag used to be, in
 * `.github/workflows/release.yml`.
 */

/** Keep a Changelog gathers these at the foot of the file, past the oldest section. */
const LINK_DEFINITION = /^\[[^\]]+\]: /

/**
 * Everything between a version's heading and whatever closes its section, trimmed.
 *
 * Empty both when the version has no section and when its section holds nothing: a reader meets
 * the same wall either way, and the caller treats them alike.
 */
export const releaseNotes = (changelog: string, version: string): string => {
  const lines = changelog.split('\n')
  const opens = lines.findIndex(line => line.startsWith(`## [${version}]`))
  if (opens === -1) return ''

  const after = lines.slice(opens + 1)
  const closes = after.findIndex(line => line.startsWith('## [') || LINK_DEFINITION.test(line))

  return (closes === -1 ? after : after.slice(0, closes)).join('\n').trim()
}
