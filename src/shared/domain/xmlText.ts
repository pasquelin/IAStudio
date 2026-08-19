/**
 * The three XML gestures the studio makes, having no parser and needing none: OpenRaster's
 * `stack.xml`, MaterialX and FCPXML are each a nesting of known element names.
 *
 * Under `shared/` rather than `main/` because the third speller was the renderer's FCPXML writer:
 * a rule this small reads as obviously right in every copy, and is wrong in one of them.
 */

export const escapeXml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export const unescapeXml = (text: string): string =>
  text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')

/**
 * One attribute of an open tag, or `''` when it carries none.
 *
 * **Anchored on whitespace, and that is not a nicety**: unanchored, `y="…"` matches inside
 * `opacity="…"` and reads another attribute's value as its own — a real failure, already paid.
 */
export const attribute = (tag: string, name: string): string =>
  new RegExp(`(?:^|\\s)${name}="([^"]*)"`).exec(tag)?.[1] ?? ''
