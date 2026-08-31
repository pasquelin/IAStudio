import { describe, expect, it, vi } from 'vitest'
import { aiRoleId } from '@shared/domain/aiRole'
import { claimScriptOnSubmit } from './codeGeneration'

/** Evaluated only when the chunk is actually fetched, which is the whole of what is measured. */
const fetched = vi.fn()
vi.mock('@/features/code/landScript', () => {
  fetched()
  return { landScript: () => Promise.resolve(true) }
})

/**
 * 🛑 The order is the measurement: a mocked module is evaluated ONCE per graph, so the case that
 * asserts NOTHING was fetched has to run while nothing has been. A claim is fanned out to all
 * SEVEN spaces, and this chunk pulls `app/newDocument` with the scene stack behind it.
 */
describe('the landing chunk, fetched while the model is still writing', () => {
  it('is not fetched for a generation of another family', async () => {
    claimScriptOnSubmit(undefined, aiRoleId('image', 'txt2img'))
    await new Promise(resolve => setTimeout(resolve, 20))

    expect(fetched).not.toHaveBeenCalled()
  })

  it('is fetched for a code generation', async () => {
    claimScriptOnSubmit(undefined, aiRoleId('code', 'txt2code'))

    await vi.waitFor(() => expect(fetched).toHaveBeenCalled())
  })
})
