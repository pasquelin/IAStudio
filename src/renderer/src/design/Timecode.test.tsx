import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '@/engines/timeline/timelineState'
import { Timecode } from './Timecode'

describe('Timecode', () => {
  it('shows the position as hours, minutes, seconds and frames', () => {
    render(<Timecode time={3_723_000_000} fps={DEFAULT_SETTINGS.fps} />)
    expect(screen.getByText('01:02:03:00')).toBeInTheDocument()
  })

  it('follows the frame rate of the sequence it is given', () => {
    render(<Timecode time={958_333} fps={24} />)
    expect(screen.getByText('00:00:00:23')).toBeInTheDocument()
  })

  it('keeps tabular figures, so the digits stop dancing while it plays', () => {
    render(<Timecode time={0} fps={DEFAULT_SETTINGS.fps} />)
    expect(screen.getByText('00:00:00:00')).toHaveClass('tabular-nums')
  })
})
