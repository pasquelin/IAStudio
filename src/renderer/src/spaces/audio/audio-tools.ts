import {
  mdiAbTesting,
  mdiContentCut,
  mdiContentSaveOutline,
  mdiContentSavePlusOutline,
  mdiScissorsCutting,
  mdiSineWave,
  mdiVolumeMedium,
} from '@mdi/js'
import type { ToolbarItem } from '@/design/Toolbar'

export type AudioToolId =
  'crop' | 'fadeIn' | 'fadeOut' | 'normalize' | 'trimSilence' | 'compare' | 'apply' | 'saveAs'

/**
 * What the audio editor does, and nothing more. No noise reduction, no de-esser, no spectral
 * repair: generated audio is clean by construction, and those tools would be answering a
 * problem this studio does not have — see spec § 13.
 */
export type AudioTool = ToolbarItem & { id: AudioToolId }

export const AUDIO_TOOLS: readonly AudioTool[] = [
  {
    id: 'crop',
    labelKey: 'audioTools.crop',
    descriptionKey: 'audioTools.cropHint',
    icon: mdiContentCut,
  },
  {
    id: 'fadeIn',
    labelKey: 'audioTools.fadeIn',
    descriptionKey: 'audioTools.fadeInHint',
    icon: mdiSineWave,
  },
  {
    id: 'fadeOut',
    labelKey: 'audioTools.fadeOut',
    descriptionKey: 'audioTools.fadeOutHint',
    icon: mdiSineWave,
  },
  {
    id: 'normalize',
    labelKey: 'audioTools.normalize',
    descriptionKey: 'audioTools.normalizeHint',
    icon: mdiVolumeMedium,
    separatorBefore: true,
  },
  {
    id: 'trimSilence',
    labelKey: 'audioTools.trimSilence',
    descriptionKey: 'audioTools.trimSilenceHint',
    icon: mdiScissorsCutting,
  },
  {
    id: 'compare',
    labelKey: 'audioTools.compare',
    descriptionKey: 'audioTools.compareHint',
    icon: mdiAbTesting,
    separatorBefore: true,
  },
  {
    id: 'apply',
    labelKey: 'audioTools.apply',
    descriptionKey: 'audioTools.applyHint',
    icon: mdiContentSaveOutline,
    separatorBefore: true,
  },
  {
    id: 'saveAs',
    labelKey: 'audioTools.saveAs',
    descriptionKey: 'audioTools.saveAsHint',
    icon: mdiContentSavePlusOutline,
  },
]

/** The bar hands back a plain string; this is where it becomes one of ours again. */
export function isAudioTool(id: string): id is AudioToolId {
  return AUDIO_TOOLS.some(tool => tool.id === id)
}
