import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_VIDEO_TOOL } from '@/spaces/video/videoTools'
import { useVideoTool } from './videoTool'

describe('video tool store', () => {
  beforeEach(() => {
    useVideoTool.setState({ tool: DEFAULT_VIDEO_TOOL })
  })

  it('arms the selection tool to begin with', () => {
    expect(useVideoTool.getState().tool).toBe('select')
  })

  it('arms whatever the bar picks', () => {
    useVideoTool.getState().setTool('blade')
    expect(useVideoTool.getState().tool).toBe('blade')
  })
})
