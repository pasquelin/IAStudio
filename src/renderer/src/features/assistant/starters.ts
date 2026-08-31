import type { ToolSurface } from '@shared/domain/tool'

/**
 * What one can ask, per surface, filtered as the sentence is typed. One key: the label IS the
 * draft it writes.
 *
 * 🛑 **Nothing checks that a sentence here reaches an action.** They are written from the gestures
 * `scripts/banc/BATTERIE.md` names, but the tie is a HAND's, not a guard's: a suggestion the
 * studio cannot carry out is the studio promising in its own words, and it would stay green.
 */
export const ASSISTANT_STARTERS: Readonly<Record<ToolSurface, readonly string[]>> = {
  // The home acts on the PROJECT and on the studio: it holds no document to act on, so a
  // suggestion about layers or tracks would name something that is not on screen.
  home: [
    'projectOpen',
    'projectCreate',
    'projectFind',
    'projectChanges',
    'projectCommit',
    'libraryFind',
  ],
  image: ['imageMake', 'imageRework', 'imageUpscale', 'imageVariant', 'imageText', 'imageResize'],
  video: ['videoMake', 'videoFromImage', 'videoCut', 'videoAppend', 'videoVolume', 'videoExport'],
  '3d': ['meshMake', 'meshFromImage', 'meshRig', 'sceneShape', 'sceneLight', 'sceneCamera'],
  code: ['scriptMake', 'scriptExplain', 'scriptFix', 'scriptRun', 'scriptAttach', 'scriptProblems'],
  audio: ['audioMake', 'audioFromVideo', 'audioTrim', 'audioTrack', 'audioVolume', 'audioExport'],
  materials: [
    'materialMake',
    'materialFromImage',
    'materialTile',
    'materialAssign',
    'materialTexture',
    'materialExport',
  ],
  skyboxes: [
    'skyboxMake',
    'skyboxRelight',
    'skyboxExport',
    'skyboxSun',
    'skyboxApply',
    'skyboxOpen',
  ],
}

/** One spelling, so the guard and the screen cannot read the prefix differently. */
export function starterKey(starter: string): string {
  return `assistant.starters.${starter}`
}
