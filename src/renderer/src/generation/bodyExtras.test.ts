import { beforeEach, describe, expect, it } from 'vitest'
import { CODE_API_FIELD, CODE_SOURCE_FIELD } from '@shared/domain/codeGeneration'
import { useCode } from '@/stores/code'
import { installDocument } from '@/stores/document-fixtures'
import { useDocuments } from '@/stores/documents'
import { withBodyExtras } from './bodyExtras'

beforeEach(() => {
  useDocuments.setState({ documents: {}, activeId: null })
  useCode.setState({ files: {}, problems: [], goto: null })
})

describe('what a family adds to a generation beyond the form', () => {
  it('sends the script in front, which no model schema can publish', () => {
    installDocument('doc-1', 'code')
    useCode.getState().installed('script:scripts/doc-1.ts', 'export const x = 1')

    const body = withBodyExtras('code', { prompt: 'a spin' })

    expect(body[CODE_SOURCE_FIELD]).toBe('export const x = 1')
    // 🛑 The declaration travels with it: the main process cannot inline it — see `CODE_API_FIELD`.
    expect(body[CODE_API_FIELD]).toContain('declare module')
  })

  /** 🛑 Absent, not empty: what tells `code2code` from `txt2code` is whether there is one. */
  it('sends no source when no script is in front', () => {
    expect(withBodyExtras('code', { prompt: 'a spin' })[CODE_SOURCE_FIELD]).toBeUndefined()
  })

  it('leaves the form alone for a family that adds nothing', () => {
    installDocument('doc-1', 'code')
    useCode.getState().installed('script:scripts/doc-1.ts', 'export const x = 1')

    expect(withBodyExtras('image', { prompt: 'a cat' })).toEqual({ prompt: 'a cat' })
  })

  /** The home asks with no family at all — it browses no catalogue and generates nothing. */
  it('leaves the form alone with no family', () => {
    expect(withBodyExtras(null, { prompt: 'a cat' })).toEqual({ prompt: 'a cat' })
  })
})
