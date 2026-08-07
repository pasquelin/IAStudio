import { describe, expect, it } from 'vitest'
import { bundledFfmpeg } from './resources'

describe('the shipped binary', () => {
  // The studio carries its own encoder on all three platforms: nothing to install, nothing to
  // look for, and no message about a codec to someone who only wanted to import a clip.
  it('sits under the resources of the running app', () => {
    expect(bundledFfmpeg('/Applications/Scenario.app/Contents/Resources', 'darwin')).toBe(
      '/Applications/Scenario.app/Contents/Resources/ffmpeg/ffmpeg',
    )
  })

  it('carries the extension Windows needs to run it', () => {
    expect(bundledFfmpeg('C:\\Program Files\\Scenario\\resources', 'win32')).toContain('ffmpeg.exe')
  })

  it('is named the same on Linux as on macOS', () => {
    expect(bundledFfmpeg('/opt/scenario/resources', 'linux')).toBe(
      '/opt/scenario/resources/ffmpeg/ffmpeg',
    )
  })
})
