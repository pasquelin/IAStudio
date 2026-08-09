import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import type { IngestProgress } from '@shared/domain/media'
import { useAssets } from '@/stores/assets'
import { useMedia } from '@/stores/media'
import { ImportProgress } from './ImportProgress'

const INGESTING: Record<string, IngestProgress> = {
  a1: { assetId: 'a1', stage: 'probe', ratio: 0.2 },
}

describe('ImportProgress', () => {
  beforeEach(() => {
    useAssets.setState({ items: [] })
    useMedia.setState({ progress: {}, capabilities: { ffmpeg: true } })
  })

  // The band costs a whole row above the grid, and the missing-ffmpeg notice used to keep it
  // there for the entire session with nothing to report.
  it('takes no height when nothing is being ingested, ffmpeg or not', () => {
    useMedia.setState({ capabilities: { ffmpeg: false } })
    const { container } = render(<ImportProgress />)

    expect(container).toBeEmptyDOMElement()
  })

  it('stays a band for the ingests, which are rows and belong to no title bar', () => {
    useMedia.setState({ progress: INGESTING, capabilities: { ffmpeg: false } })
    render(<ImportProgress />)

    expect(screen.getByText('a1')).toBeInTheDocument()
  })
})
