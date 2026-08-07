import { describe, expect, it } from 'vitest'
import { hasFailed, isTerminal, needsDismissing, type IngestStage } from './media'

describe('what an ingest stage means for the list', () => {
  it('calls every outcome terminal, since each one left the catalogue changed', () => {
    const outcomes: IngestStage[] = ['done', 'cancelled', 'failed', 'duplicate', 'unreadable']
    expect(outcomes.filter(isTerminal)).toEqual(outcomes)
  })

  it('calls a file still being prepared anything but terminal', () => {
    const running: IngestStage[] = ['queued', 'probe', 'hash', 'proxy', 'peaks']
    expect(running.filter(isTerminal)).toEqual([])
  })

  it('takes a finished or cancelled file off the list on its own', () => {
    expect(needsDismissing('done')).toBe(false)
    expect(needsDismissing('cancelled')).toBe(false)
  })

  // Three of five picks already in the project would otherwise leave three rows vanishing with
  // nothing said, and no new asset to show for them either.
  it('keeps a duplicate up, which is the only thing that says where the file went', () => {
    expect(needsDismissing('duplicate')).toBe(true)
  })

  it('keeps a failure up too', () => {
    expect(needsDismissing('unreadable')).toBe(true)
    expect(needsDismissing('failed')).toBe(true)
  })

  it('calls a refused file a failure, so the row shows in red like any other', () => {
    expect(hasFailed('unreadable')).toBe(true)
    expect(hasFailed('failed')).toBe(true)
  })

  // A proxy that broke after a good probe is a failure; a duplicate is the file being there.
  it('calls a duplicate no kind of failure', () => {
    expect(hasFailed('duplicate')).toBe(false)
    expect(hasFailed('done')).toBe(false)
  })
})
