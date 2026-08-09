import { afterEach, describe, expect, it, vi } from 'vitest'
import { editableOf, insertAtCaret, insertInto } from './insert-at-caret'

function field(value = '', type = 'text'): HTMLInputElement {
  const input = document.createElement('input')
  input.type = type
  input.value = value
  document.body.append(input)
  return input
}

function area(value = ''): HTMLTextAreaElement {
  const textarea = document.createElement('textarea')
  textarea.value = value
  document.body.append(textarea)
  return textarea
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('insertInto', () => {
  it('writes at the caret rather than at the end', () => {
    const input = field('un phare rouge')
    input.setSelectionRange(8, 8)

    insertInto(input, 'petit')

    expect(input.value).toBe('un phare petit rouge')
  })

  it('replaces the selection, as typing would', () => {
    const input = field('un phare rouge')
    input.setSelectionRange(9, 14)

    insertInto(input, 'bleu')

    expect(input.value).toBe('un phare bleu')
  })

  it('leaves the caret after what it wrote', () => {
    const input = field('début fin')
    input.setSelectionRange(5, 5)

    insertInto(input, 'milieu')

    expect(input.selectionStart).toBe(12)
    expect(input.selectionEnd).toBe(12)
  })

  // Two sentences dictated one after another should read as two sentences, not astwo.
  it('spaces the text off the word before it', () => {
    const input = field('bonjour')
    input.setSelectionRange(7, 7)

    insertInto(input, 'monde')

    expect(input.value).toBe('bonjour monde')
  })

  it('adds no space after a space, nor at the start', () => {
    const spaced = field('bonjour ')
    spaced.setSelectionRange(8, 8)
    insertInto(spaced, 'monde')
    expect(spaced.value).toBe('bonjour monde')

    const empty = field('')
    insertInto(empty, 'monde')
    expect(empty.value).toBe('monde')
  })

  // This is what makes every field of the studio work without being rewritten: react-hook-form
  // and every controlled input listen for a bubbling `input` event and nothing else.
  it('fires an input event that bubbles', () => {
    const input = field('')
    const heard = vi.fn()
    document.addEventListener('input', heard)

    insertInto(input, 'texte')

    expect(heard).toHaveBeenCalledTimes(1)
    document.removeEventListener('input', heard)
  })

  it('writes nothing at all for an empty sentence', () => {
    const input = field('intact')
    const heard = vi.fn()
    document.addEventListener('input', heard)

    insertInto(input, '')

    expect(input.value).toBe('intact')
    expect(heard).not.toHaveBeenCalled()
    document.removeEventListener('input', heard)
  })

  it('works the same in a textarea', () => {
    const textarea = area('première ligne')
    textarea.setSelectionRange(14, 14)

    insertInto(textarea, 'suite')

    expect(textarea.value).toBe('première ligne suite')
  })
})

describe('editableOf', () => {
  it('accepts the fields a sentence can be spoken into', () => {
    for (const type of ['text', 'search', 'email', 'url', 'password', 'tel', 'number']) {
      expect(editableOf(field('', type))).not.toBeNull()
    }
    expect(editableOf(area())).not.toBeNull()
  })

  // A checkbox has a value, and writing a sentence into it does nothing visible while quietly
  // changing what the form submits.
  it('refuses what has no caret', () => {
    for (const type of ['checkbox', 'radio', 'range', 'color', 'file', 'submit']) {
      expect(editableOf(field('', type))).toBeNull()
    }
    expect(editableOf(document.createElement('div'))).toBeNull()
    expect(editableOf(null)).toBeNull()
  })
})

describe('insertAtCaret', () => {
  it('writes into the field that has the focus', () => {
    const first = field('')
    const second = field('')
    second.focus()

    expect(insertAtCaret('dicté')).toBe(true)
    expect(second.value).toBe('dicté')
    expect(first.value).toBe('')
  })

  // Writing a sentence into a field nobody was looking at is worse than not writing it: the
  // caller learns it went nowhere and can say so.
  it('answers false, and writes nothing, when the focus is elsewhere', () => {
    const input = field('intact')
    input.blur()

    expect(insertAtCaret('perdu')).toBe(false)
    expect(input.value).toBe('intact')
  })
})
