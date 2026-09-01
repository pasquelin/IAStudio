import { describe, expect, it } from 'vitest'
import { mcpTools } from './tools'

/**
 * 🛑 What publishing the registry COSTS a client, measured rather than supposed — the plan's
 * § 16.5 makes it a criterion of this lot.
 *
 * A tool arrives at a model as its name, its description and its JSON schema. Four characters to
 * the token is the ratio every measurement of this repository has used; what matters here is not
 * the third digit but the ORDER, and that a lot which adds thirteen actions is not what tips the
 * session over.
 *
 * Measured 2026-08-27, on the **268** tools this lot leaves behind: **144 905 characters** of
 * schema in all — some 36 000 tokens if a client were handed every one at once — against **3 490
 * characters of NAMES**, under 900 tokens. The studio's own client is handed the names and fetches
 * a schema when it calls, which is the +3 638 per session `CLAUDE.md` records for 233 tools.
 *
 * 🛑 So what this lot spends is thirteen NAMES, some 170 characters — and the answer to the
 * plan's R5 is measured rather than assumed: it is not the count that would saturate a context,
 * it is handing out schemas, which nothing here does.
 */
describe('what the registry costs a client', () => {
  const published = mcpTools()
  const written = JSON.stringify(published)

  it('publishes every action, and says how much that weighs', () => {
    expect(published.length).toBeGreaterThan(260)
    // The FLOOR of the measurement rather than a ceiling: a bound that fails on growth would be
    // a test nobody could add an action past, and this one is here to be read.
    expect(written.length).toBeGreaterThan(100_000)
  })

  /**
   * 🛑 The bound that matters: no ONE tool may cost what a whole family should. A schema that ran
   * away — an enum of every asset of a project, a description holding a manual — is what would
   * make the list unreadable, and it would arrive one tool at a time.
   */
  it('keeps every single tool under two thousand characters of schema', () => {
    const heavy = published
      .map(tool => ({ name: tool.name, size: JSON.stringify(tool).length }))
      .filter(one => one.size > 2_000)
      .map(one => one.name)

    // 🛑 ONE exception, named rather than absorbed by a higher bound: `command.runStudioCommand` publishes
    // every command of the studio as an enum, which is what makes it worth its size — and what
    // makes a SECOND tool of that shape the thing to notice.
    expect(heavy).toEqual(['command_runStudioCommand'])
  })

  it('says the names of this lot, so a client can reach the loop at all', () => {
    const names = published.map(tool => tool.name)

    for (const one of [
      'play_start',
      'play_step',
      'runtime_errors',
      'script_write',
      'studio_batch',
    ]) {
      expect(names).toContain(one)
    }
  })
})
