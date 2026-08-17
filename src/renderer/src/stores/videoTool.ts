import { create } from 'zustand'
import { DEFAULT_VIDEO_TOOL, type VideoToolId } from '@/spaces/video/videoTools'

type VideoToolState = {
  tool: VideoToolId
  setTool: (tool: VideoToolId) => void
}

/**
 * The armed timeline tool. In a store rather than in a component because the bar lives in the
 * panel's title row and the canvas under it — two siblings that must read the same value.
 *
 * Not per document: a montage tool is a habit of the hand, and switching tab should not disarm
 * the blade.
 */
export const useVideoTool = create<VideoToolState>()(set => ({
  tool: DEFAULT_VIDEO_TOOL,
  setTool: tool => set({ tool }),
}))
