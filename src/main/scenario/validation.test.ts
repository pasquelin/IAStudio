import { describe, expect, it } from 'vitest'
import { MODEL_PERIODS, MODEL_SORTS } from '@shared/domain/model'
import { GRAPH_EXPRESSION_MAX, GRAPH_ID_MAX, GRAPH_VARIABLES_MAX } from '@shared/domain/graph'
import {
  parseModelQuery,
  parseStoredJobs,
  parseTransformExpression,
  parseTransformVariables,
  parseWorkflowQuery,
} from './validation'

describe('model query validation', () => {
  /**
   * The schema used to retype the unions by hand, and fell behind: `sort: 'oldest'` reached
   * the menu while the handler still rejected it, surfacing as "an unexpected error".
   */
  it('accepts every sort the panel can offer', () => {
    for (const sort of MODEL_SORTS) {
      expect(parseModelQuery({ sort })).toEqual({ sort })
    }
  })

  it('accepts every period the panel can offer', () => {
    for (const since of MODEL_PERIODS) {
      expect(parseModelQuery({ since })).toEqual({ since })
    }
  })

  it('still refuses a value no facet offers', () => {
    expect(() => parseModelQuery({ sort: 'cheapest' })).toThrow()
  })

  // `limit` sizes the walk the registry performs before answering.
  it('refuses a page size that would freeze the main process', () => {
    expect(() => parseModelQuery({ limit: 10_000 })).toThrow()
  })
})

describe('workflow query validation', () => {
  it('accepts what the Apps panel asks for', () => {
    expect(parseWorkflowQuery({ privacy: 'public', limit: 24, cursor: 'next' })).toEqual({
      privacy: 'public',
      limit: 24,
      cursor: 'next',
    })
  })

  it('refuses a privacy the API does not offer', () => {
    expect(() => parseWorkflowQuery({ privacy: 'secret' })).toThrow()
  })

  // The channel takes no argument at all when the panel asks for the default listing.
  it('reads an absent query as an empty one', () => {
    expect(parseWorkflowQuery(undefined)).toEqual({})
  })

  it('refuses a page size that would freeze the main process', () => {
    expect(() => parseWorkflowQuery({ limit: 10_000 })).toThrow()
  })
})

describe('jobs read back from disk', () => {
  const NOTE = {
    id: 'job_local',
    remoteId: 'job_remote',
    label: 'Flux',
    accountId: 'fingerprint_studio',
    projectPath: '/projects/kingdom',
    createdAt: '2026-08-08T09:00:00.000Z',
  }

  /**
   * A note written before workflows existed names a `modelId` and no kind. Dropped rather than
   * read, it would abandon a generation that is running and has already been paid for.
   */
  it('reads a note an earlier version wrote', () => {
    const [job] = parseStoredJobs(JSON.stringify([{ ...NOTE, modelId: 'model_flux' }]))

    expect(job).toMatchObject({ kind: 'model', targetId: 'model_flux' })
  })

  it('reads a workflow note as one', () => {
    const stored = [{ ...NOTE, kind: 'workflow', targetId: 'workflow_1' }]

    expect(parseStoredJobs(JSON.stringify(stored))[0]).toMatchObject({
      kind: 'workflow',
      targetId: 'workflow_1',
    })
  })

  // A blank remote id would have the manager poll a job id that is not one.
  it('drops an entry it cannot make sense of, and keeps the rest', () => {
    const stored = [
      { ...NOTE, targetId: 'model_flux', remoteId: '  ' },
      { ...NOTE, modelId: 'm' },
    ]

    expect(parseStoredJobs(JSON.stringify(stored))).toHaveLength(1)
  })

  it('drops a note that names nothing to run', () => {
    expect(parseStoredJobs(JSON.stringify([NOTE]))).toEqual([])
  })
})

describe('transform validation', () => {
  it('takes an expression and the variables it reads', () => {
    expect(parseTransformExpression("'a' + text1_output")).toBe("'a' + text1_output")
    expect(parseTransformVariables({ text1_output: 'a cat', items: ['one', 'two'] })).toEqual({
      text1_output: 'a cat',
      items: ['one', 'two'],
    })
  })

  /** A node holding no expression is one the executor never submits, so a blank is a caller bug. */
  it('refuses a blank expression rather than evaluating one', () => {
    expect(() => parseTransformExpression('')).toThrow()
  })

  it('refuses an expression longer than the boundary accepts', () => {
    expect(() => parseTransformExpression('x'.repeat(GRAPH_EXPRESSION_MAX + 1))).toThrow()
  })

  /**
   * A variable's name is `<nodeId>_<output>`, so it has to clear a node id AND the port after it.
   * Bounded at the id's own length, a long node id made its own wire unnameable and the node read
   * "invalid expression" over an expression that was fine.
   */
  it('takes a variable named after a node id of the greatest length a graph allows', () => {
    const name = `${'n'.repeat(GRAPH_ID_MAX)}_output`

    expect(parseTransformVariables({ [name]: 'x' })).toEqual({ [name]: 'x' })
  })

  /** What a WIRE carries is a whole text node's contents, never bounded by what someone typed. */
  it('takes a variable far longer than an expression may be', () => {
    const long = 'x'.repeat(GRAPH_EXPRESSION_MAX + 1)

    expect(parseTransformVariables({ text1_output: long })).toEqual({ text1_output: long })
  })

  it('refuses a variable that is neither text nor a list of it', () => {
    expect(() => parseTransformVariables({ a: 3 })).toThrow()
    expect(() => parseTransformVariables({ a: [{ b: 1 }] })).toThrow()
  })

  /** Zod caps neither a record's keys nor this on its own — the refinement is what does. */
  it('refuses more variables than a node could ever have ports', () => {
    const many: Record<string, string> = {}
    for (let index = 0; index <= GRAPH_VARIABLES_MAX; index += 1) many[`v${index}`] = 'x'

    expect(() => parseTransformVariables(many)).toThrow()
  })
})
