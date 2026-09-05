import { installFakeBridge } from '@/services/fakeBridge'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const openFileView = vi.fn()
vi.mock('@/features/shell/components/dockviewApi', () => ({ openFileView }))

const { createInputMapFromPreset } = await import('./createInputMap')

beforeEach(() => {
  openFileView.mockReset()
})

describe('input map creation', () => {
  it('writes the chosen preset under an available standard filename and opens it', async () => {
    const write = vi.fn(async () => true)
    installFakeBridge({
      inputMaps: {
        list: async () => ['character.input.json'],
        read: async () => null,
        write,
      },
    })

    expect(await createInputMapFromPreset('character')).toBe('character-2.input.json')
    expect(write).toHaveBeenCalledWith(
      'character-2.input.json',
      expect.objectContaining({ id: 'character' }),
    )
    expect(openFileView).toHaveBeenCalledWith({
      id: 'inputMap',
      path: 'character-2.input.json',
      title: 'character-2',
    })
  })
})
