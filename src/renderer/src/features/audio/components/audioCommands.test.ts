import { describe, expect, it, vi } from 'vitest'
import { useAudioEdits } from '@/stores/audioEdits'
import { useSequences } from '@/stores/sequences'
import { runAudioCommand } from './audioCommands'

describe('the commands of a take', () => {
  it('undoes the montage while the chain over the take has nothing to give back', () => {
    const take = vi.spyOn(useAudioEdits.getState(), 'undo').mockImplementation(() => {})
    const montage = vi.spyOn(useSequences.getState(), 'undo').mockImplementation(() => {})

    expect(runAudioCommand('doc-1', 'audio.undo')).toBe(true)

    expect(take).not.toHaveBeenCalled()
    expect(montage).toHaveBeenCalledWith('doc-1')
  })

  it('leaves a command of another scope unanswered', () => {
    expect(runAudioCommand('doc-1', 'canvas.undo')).toBe(false)
  })
})
