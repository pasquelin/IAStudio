import i18next from 'i18next'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { aiRoleId } from '@shared/domain/aiRole'
import type { LandingChoice as LandingPreference } from '@shared/domain/settings'
import { TRANSLATIONS } from '@shared/i18n'
import { installDocument } from '@/stores/document-fixtures'
import { useDocuments } from '@/stores/documents'
import { landingChoiceOf, landingCreatesOf, landingSiblingsOf } from './landingChoice'

const CODE2CODE = aiRoleId('code', 'code2code')
const TXT2CODE = aiRoleId('code', 'txt2code')
const IMG2IMG = aiRoleId('image', 'img2img')

const chosen = (role = CODE2CODE, preference: LandingPreference = 'ask', awaits = false) =>
  landingChoiceOf(role, useDocuments.getState(), preference, awaits)

/**
 * The name of a file yet to exist is a translated word — straight into i18next rather than
 * through `initI18n`, which reads `localStorage` and writes on the document.
 */
beforeAll(async () => {
  await i18next.init({
    lng: 'fr',
    defaultNS: 'studio',
    resources: { fr: { studio: TRANSLATIONS.fr } },
    interpolation: { escapeValue: false },
  })
})

beforeEach(() => {
  useDocuments.setState({ documents: {}, stored: [], activeId: null })
})

describe('where a shot lands, said before the click', () => {
  /** The whole of ADR-23 here: the operation decides, never a preference read off disk. */
  it('takes the operation over the preference, and names the file it writes into', () => {
    installDocument('Walk', 'code')

    expect(chosen()).toMatchObject({ derived: 'document', target: 'document', into: 'Walk.ts' })
  })

  it('opens a file of its own for an operation that reworks nothing', () => {
    installDocument('Walk', 'code')

    expect(chosen(TXT2CODE)).toMatchObject({ derived: 'newTab', sends: null })
  })

  /** 🛑 The same condition `bodyExtras` sends under, or the panel names a file nothing sees. */
  it('says the script in front travels only when the operation reworks one', () => {
    installDocument('Walk', 'code')

    expect(chosen().sends).toBe('Walk.ts')
    expect(chosen(TXT2CODE).sends).toBeNull()
  })

  it('has no document to write into when nothing is in front', () => {
    expect(chosen()).toMatchObject({ derived: 'newTab', into: null, sends: null })
  })

  /**
   * 🛑 `null` is the one answer a caller may not inherit: the studio would have put the question
   * on screen, and a call from outside cannot answer it.
   */
  it('answers nothing for a family that still asks, and a document is waiting', () => {
    expect(chosen(IMG2IMG, 'ask', true)).toMatchObject({ derived: null, target: null })
    expect(chosen(IMG2IMG, 'ask', false)).toMatchObject({ derived: null, target: 'newTab' })
    expect(chosen(IMG2IMG, 'document', true)).toMatchObject({ derived: null, target: 'document' })
  })
})

describe('the file a new-tab landing creates', () => {
  it('names one the folder does not already hold', () => {
    installDocument('Script 1', 'code')
    const siblings = landingSiblingsOf(CODE2CODE, useDocuments.getState())

    expect(siblings).toEqual(['Script 1.ts'])
    expect(landingCreatesOf(CODE2CODE, siblings)).toBe('Script 2.ts')
  })

  it('names nothing for a family that lands a row of the shelf', () => {
    expect(landingSiblingsOf(IMG2IMG, useDocuments.getState())).toEqual([])
    expect(landingCreatesOf(IMG2IMG, [])).toBeNull()
  })
})
