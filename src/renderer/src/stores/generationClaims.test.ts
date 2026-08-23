import { describe, expect, it } from 'vitest'
import { DOCUMENT_KINDS } from '@shared/domain/document'
import { CLAIMED_KINDS } from './generationClaims'

/**
 * 🛑 A workspace with no claim is a generation that lands nowhere: the result reaches the shelf
 * and no document at all, and nothing says so. Three of the six were in that state until
 * ADR-23 — the montage, the audio editor and the material.
 */
describe('the workspaces a generation can land in', () => {
  it('covers every kind of document the studio opens', () => {
    expect([...CLAIMED_KINDS].sort()).toEqual([...DOCUMENT_KINDS].sort())
  })
})
