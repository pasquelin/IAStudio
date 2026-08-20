import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const WORKFLOW = readFileSync(
  join(import.meta.dirname, '..', '..', '.github/workflows/pages.yml'),
  'utf8',
)

/**
 * What the site advertises for download, and the one way it went wrong.
 *
 * `/releases/latest` is a resource of its own and it lags: read ten seconds after `v1.0.0` went
 * public, on 20/08, it still answered `v0.2.0` — so the manifest carried the previous version and
 * the previous download links, from a run that was green. The release that fires the workflow is
 * in the event payload; nothing has to be asked for.
 */
describe('the site naming the release that was just published', () => {
  it('reads the tag off the event rather than asking which release is latest', () => {
    expect(WORKFLOW).toContain('github.event.release.tag_name')
    expect(WORKFLOW).toContain('releases/tags/')
  })

  /**
   * `/releases/latest` filters drafts and pre-releases; the payload does not. Reading the tag
   * without the two flags would put a published `-rc` on the front page.
   */
  it('leaves a draft or a pre-release off the page', () => {
    expect(WORKFLOW).toContain('github.event.release.draft')
    expect(WORKFLOW).toContain('github.event.release.prerelease')
  })

  /**
   * The fallback stays: a dispatch and a push carry no release, and a repository with none at all
   * answers 404, which the step treats as "keep the built-in wording".
   */
  it('keeps asking for the latest release where no event names one', () => {
    expect(WORKFLOW).toContain('releases/latest')
  })

  /**
   * The blind spot, in clear: this reads the workflow as TEXT. It cannot tell that the branch is
   * taken, only that both sources are spelled out — a `run:` block that names them and uses
   * neither would pass. What it does catch is the whole of what happened: a single unconditional
   * `/releases/latest`, with no mention of the event.
   */
  it('names the two sources in the same step, not in two workflows', () => {
    const step = WORKFLOW.slice(WORKFLOW.indexOf('Write the release manifest'))
    expect(step.slice(0, step.indexOf('- uses:'))).toContain('releases/tags/')
  })
})
