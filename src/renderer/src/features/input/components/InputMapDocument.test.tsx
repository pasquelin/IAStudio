// SPDX-License-Identifier: MIT
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { InputMap } from '@shared/domain/inputMap'
import { installFakeBridge } from '@/services/fakeBridge'
import { InputMapDocument } from './InputMapDocument'

const CHARACTER: InputMap = {
  version: 1,
  id: 'character',
  priority: 0,
  defaultActive: true,
  actions: [
    {
      id: 'jump',
      kind: 'button',
      bindings: [{ device: 'keyboard', code: 'Space' }],
    },
  ],
}

describe('the input map editor', () => {
  it('loads a map into the simple visual view', async () => {
    installFakeBridge({ inputMaps: { read: () => Promise.resolve(CHARACTER) } })

    render(<InputMapDocument path="Controls/character.input.json" />)

    expect(await screen.findByText('jump')).toBeInTheDocument()
    expect(screen.getByText(/Space/)).toBeInTheDocument()
  })

  it('reports a read failure instead of leaving a rejected task behind', async () => {
    installFakeBridge({ inputMaps: { read: () => Promise.reject(new Error('disk failed')) } })

    render(<InputMapDocument path="Controls/character.input.json" />)

    expect(
      await screen.findByText('Cette carte de contrôles n’a pas pu être lue.'),
    ).toBeInTheDocument()
  })

  it('validates and saves an edited JSON view', async () => {
    const write = vi.fn(() => Promise.resolve(true))
    installFakeBridge({
      inputMaps: { read: () => Promise.resolve(CHARACTER), write },
    })
    render(<InputMapDocument path="Controls/character.input.json" />)
    await screen.findByText('jump')

    await userEvent.click(screen.getByRole('button', { name: 'JSON' }))
    const source = screen.getByRole('textbox', { name: 'JSON de la carte' })
    fireEvent.change(source, {
      target: { value: JSON.stringify({ ...CHARACTER, priority: 20 }, null, 2) },
    })
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    await vi.waitFor(() =>
      expect(write).toHaveBeenCalledWith('Controls/character.input.json', {
        ...CHARACTER,
        priority: 20,
      }),
    )
  })

  it('keeps invalid JSON off disk and explains the refusal', async () => {
    const write = vi.fn(() => Promise.resolve(true))
    installFakeBridge({
      inputMaps: { read: () => Promise.resolve(CHARACTER), write },
    })
    render(<InputMapDocument path="Controls/character.input.json" />)
    await screen.findByText('jump')

    await userEvent.click(screen.getByRole('button', { name: 'JSON' }))
    const source = screen.getByRole('textbox', { name: 'JSON de la carte' })
    fireEvent.change(source, { target: { value: '{' } })
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    expect(
      await screen.findByText('Le JSON ne décrit pas une carte de contrôles valide.'),
    ).toBeInTheDocument()
    expect(write).not.toHaveBeenCalled()
  })

  it('does not replace edits typed while an earlier save is pending', async () => {
    const pending: { finish: ((value: boolean) => void) | null } = { finish: null }
    const write = vi.fn(
      () =>
        new Promise<boolean>(resolve => {
          pending.finish = resolve
        }),
    )
    installFakeBridge({ inputMaps: { read: () => Promise.resolve(CHARACTER), write } })
    render(<InputMapDocument path="Controls/character.input.json" />)
    await screen.findByText('jump')
    await userEvent.click(screen.getByRole('button', { name: 'JSON' }))
    const source = screen.getByRole('textbox', { name: 'JSON de la carte' })
    fireEvent.change(source, { target: { value: JSON.stringify({ ...CHARACTER, priority: 20 }) } })
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    fireEvent.change(source, { target: { value: JSON.stringify({ ...CHARACTER, priority: 30 }) } })

    pending.finish?.(true)

    await vi.waitFor(() =>
      expect(source).toHaveValue(JSON.stringify({ ...CHARACTER, priority: 30 })),
    )
  })
})
