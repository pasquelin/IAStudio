import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { GitDiff } from '@shared/domain/gitDiff'
import { installFakeBridge } from '@/services/fake-bridge'
import { useGit } from '@/stores/git'
import { DiffPane } from './DiffPane'

const TEXT: GitDiff = {
  kind: 'text',
  hunks: [
    {
      header: '@@ -1,3 +1,4 @@',
      lines: [
        { side: 'context', text: 'inchangé', before: 1, after: 1 },
        { side: 'removed', text: 'parti', before: 2, after: null },
        { side: 'added', text: 'arrivé', before: null, after: 2 },
      ],
    },
  ],
}

beforeEach(() => useGit.setState({ compared: null, diff: null }))

describe('the comparison pane', () => {
  it('draws nothing at all until a file is being compared', () => {
    installFakeBridge()
    const { container } = render(<DiffPane />)

    expect(container.firstChild).toBeNull()
  })

  /**
   * "Not answered yet" is a different screen from "nothing changed": an empty note where git is
   * still working would say the comparison had come back with nothing in it.
   */
  it('waits visibly while git is still working', async () => {
    installFakeBridge({ git: { diff: () => new Promise<GitDiff>(() => {}) } })
    render(<DiffPane />)

    void useGit.getState().compare('notes.txt', null)

    expect(await screen.findByLabelText('Comparaison en cours')).toBeTruthy()
  })

  it('shows both sides of a text change, numbered against their own versions', async () => {
    installFakeBridge({ git: { diff: () => Promise.resolve(TEXT) } })
    render(<DiffPane />)

    await useGit.getState().compare('notes.txt', null)

    expect(await screen.findByText('parti')).toBeTruthy()
    expect(screen.getByText('arrivé')).toBeTruthy()
    expect(screen.getByText('@@ -1,3 +1,4 @@')).toBeTruthy()
  })

  it('tallies what the change adds and takes away', async () => {
    installFakeBridge({ git: { diff: () => Promise.resolve(TEXT) } })
    render(<DiffPane />)

    await useGit.getState().compare('notes.txt', null)

    expect(await screen.findByText('+1')).toBeTruthy()
    expect(screen.getByText('−1')).toBeTruthy()
  })

  /**
   * Git says "Binary files differ" about a PNG, which is true and useless. What is wanted there
   * is to SEE the two — which is the comparison a studio project is mostly made of.
   */
  it('puts two pictures side by side where git can only say the bytes differ', async () => {
    const bytes = vi.fn(() => Promise.resolve(new Uint8Array([137, 80, 78, 71])))
    installFakeBridge({ git: { diff: () => Promise.resolve({ kind: 'binary' }), bytes } })
    render(<DiffPane />)

    await useGit.getState().compare('Images/hero.png', null)

    expect(await screen.findByAltText('Avant')).toBeTruthy()
    expect(screen.getByAltText('Après')).toBeTruthy()
    // The earlier side of a working change is the last recorded version; the later side is disk.
    expect(bytes).toHaveBeenCalledWith('Images/hero.png', 'HEAD')
    expect(bytes).toHaveBeenCalledWith('Images/hero.png', null)
  })

  it('says a comparison came back with nothing in it', async () => {
    installFakeBridge({ git: { diff: () => Promise.resolve({ kind: 'empty' }) } })
    render(<DiffPane />)

    await useGit.getState().compare('notes.txt', null)

    expect(await screen.findByText('Rien à comparer dans ce fichier.')).toBeTruthy()
  })

  it('closes, leaving the panels beside it alone', async () => {
    installFakeBridge({ git: { diff: () => Promise.resolve(TEXT) } })
    render(<DiffPane />)
    await useGit.getState().compare('notes.txt', null)

    await userEvent.click(await screen.findByRole('button', { name: 'Fermer la comparaison' }))

    await waitFor(() => expect(useGit.getState().compared).toBeNull())
  })
})

describe('two files clicked in a row', () => {
  /**
   * A diff is the slowest thing git is asked for, so a second file clicked while the first is
   * still out is the ordinary case — and the slower answer must not land on top of the newer one.
   */
  it('keeps the answer to the one being looked at, not the one that came back last', async () => {
    const settle: Record<string, (diff: GitDiff) => void> = {}
    installFakeBridge({
      git: {
        diff: path =>
          new Promise<GitDiff>(done => {
            settle[path] = done
          }),
      },
    })
    render(<DiffPane />)

    void useGit.getState().compare('slow.txt', null)
    void useGit.getState().compare('notes.txt', null)

    settle['notes.txt']?.(TEXT)
    await screen.findByText('arrivé')

    settle['slow.txt']?.({ kind: 'empty' })

    await waitFor(() => expect(useGit.getState().compared?.path).toBe('notes.txt'))
    expect(screen.getByText('arrivé')).toBeTruthy()
  })
})
