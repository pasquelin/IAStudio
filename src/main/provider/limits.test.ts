import { describe, expect, it } from 'vitest'
import { chunk } from '@shared/collections'
import { DELETE_MAX, GET_BULK_MAX } from './limits'

describe('what each endpoint accepts at once', () => {
  it('cuts a full page of ids to the body limit of its call', () => {
    const ids = Array.from({ length: 250 }, (_, index) => index)

    expect(chunk(ids, GET_BULK_MAX).map(batch => batch.length)).toEqual([200, 50])
    expect(chunk(ids, DELETE_MAX).map(batch => batch.length)).toEqual([100, 100, 50])
  })
})
