import { describe, expect, it, vi } from 'vitest'
import { useMaterials } from '@/stores/materials'
import { runMaterialCommand } from './materialCommands'

describe('the commands of a material', () => {
  it('sends an undo to the history of the document named', () => {
    const undo = vi.spyOn(useMaterials.getState(), 'undo').mockImplementation(() => {})

    expect(runMaterialCommand('doc-1', 'material.undo')).toBe(true)

    expect(undo).toHaveBeenCalledWith('doc-1')
  })

  it('leaves a command of another scope unanswered', () => {
    expect(runMaterialCommand('doc-1', 'canvas.undo')).toBe(false)
  })
})
