import type { WorkspaceId } from '@shared/domain/workspace'

/** Three sentences per space for an empty centre. One key: the label IS the draft it writes. */
export const ASSISTANT_STARTERS: Readonly<Record<WorkspaceId, readonly string[]>> = {
  image: ['imageMake', 'imageRework', 'imageUpscale'],
  video: ['videoMake', 'videoFromImage', 'videoCut'],
  '3d': ['meshMake', 'meshFromImage', 'meshRig'],
  audio: ['audioMake', 'audioFromVideo', 'audioTrim'],
  materials: ['materialMake', 'materialFromImage', 'materialTile'],
  skyboxes: ['skyboxMake', 'skyboxRelight', 'skyboxExport'],
}

/** One spelling, so the guard and the screen cannot read the prefix differently. */
export function starterKey(starter: string): string {
  return `assistant.starters.${starter}`
}
