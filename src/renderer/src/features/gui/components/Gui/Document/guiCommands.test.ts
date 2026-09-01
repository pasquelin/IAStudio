import { describe, expect, it, vi } from 'vitest'
import { useGuis } from '@/stores/gui'
import { runGuiCommand } from './guiCommands'

describe('the commands of an interface', () => {
  it('sends a redo to the history of the document named', () => {
    const redo = vi.spyOn(useGuis.getState(), 'redo').mockImplementation(() => {})

    expect(runGuiCommand('doc-1', 'gui.redo')).toBe(true)

    expect(redo).toHaveBeenCalledWith('doc-1')
  })

  it('leaves a command of another scope unanswered', () => {
    expect(runGuiCommand('doc-1', 'canvas.undo')).toBe(false)
  })
})
