import { orElse } from '@shared/promises'
import { DEFAULT_ROLE_PATHS } from '@shared/domain/folderRole'
import { ANIMATION_GRAPH_EXTENSION } from '@shared/domain/animationGraph'
import { animationGraphPreset, type AnimationPresetId } from '@shared/domain/animationPresets'
import { INPUT_MAP_EXTENSION } from '@shared/domain/inputMap'
import { inputMapPreset, type InputPresetId } from '@shared/domain/inputPresets'
import { documentPathFor } from '@shared/domain/documentName'
import type { SceneTemplateId } from '@shared/domain/sceneTemplate'
import { TEMPLATE_SCRIPT_SOURCES, type TemplateScriptId } from '@shared/domain/templateScript'
import { getBridge } from '@/services/bridge'
import { scriptRefAt, useCode } from '@/stores/code'
import { useDocuments } from '@/stores/documents'

/** What each template plays with — the script its pilot carries, and the context that drives it. */
const PLAYED: Partial<
  Record<
    SceneTemplateId,
    { script: TemplateScriptId; map: InputPresetId; graph?: AnimationPresetId }
  >
> = {
  firstPerson: { script: 'player', map: 'character', graph: 'character' },
  thirdPerson: { script: 'player', map: 'character', graph: 'character' },
  topDown: { script: 'player', map: 'character', graph: 'character' },
  car: { script: 'car', map: 'vehicle' },
  plane: { script: 'plane', map: 'flight' },
}

/**
 * The files a scene template lays down beside itself: the control map its actions are bound by,
 * and the script its pilot carries.
 *
 * 🛑 A template SHOWS. The runtime walks and drives off its own contexts with no file at all, so
 * none of this is needed to PLAY — it is needed to be read, opened and changed.
 *
 * Never overwritten: a second scene from the same template joins the files the first laid down,
 * which is what makes a control map a project's rather than a scene's.
 */
export async function seedTemplateFiles(template: SceneTemplateId): Promise<string> {
  const played = PLAYED[template]
  const bridge = getBridge()
  const folder = await orElse(bridge?.project.folderFor('code'), DEFAULT_ROLE_PATHS.code)
  if (!played || !bridge) return folder

  await Promise.all([
    writeMap(played.map),
    writeScript(played.script, folder),
    played.graph ? writeGraph(played.graph) : Promise.resolve(),
  ])
  await useDocuments.getState().relist()
  return folder
}

async function writeMap(preset: InputPresetId): Promise<void> {
  const bridge = getBridge()
  if (!bridge) return
  const folder = await orElse(bridge.project.folderFor('input'), DEFAULT_ROLE_PATHS.input)
  const path = `${folder}/${preset}${INPUT_MAP_EXTENSION}`
  const taken = await orElse(bridge.inputMaps.list(), [])
  if (taken.some(one => one.toLowerCase() === path.toLowerCase())) return

  await bridge.inputMaps.write(path, { ...structuredClone(inputMapPreset(preset)), id: preset })
}

/**
 * The state machine the module is already animated by, written down beside the scene.
 *
 * 🛑 Not needed to PLAY — a module with an empty `graph` field walks off the shipped preset. It
 * is written so the thresholds, the clips and the ways out can be READ and changed.
 */
async function writeGraph(preset: AnimationPresetId): Promise<void> {
  const bridge = getBridge()
  if (!bridge) return
  const folder = await orElse(bridge.project.folderFor('animations'), DEFAULT_ROLE_PATHS.animations)
  const path = `${folder}/${preset}${ANIMATION_GRAPH_EXTENSION}`
  const taken = await orElse(bridge.animationGraphs.list(), [])
  if (taken.some(one => one.toLowerCase() === path.toLowerCase())) return

  await bridge.animationGraphs.write(path, structuredClone(animationGraphPreset(preset)))
}

async function writeScript(script: TemplateScriptId, folder: string): Promise<void> {
  const bridge = getBridge()
  if (!bridge) return
  const path = documentPathFor(script, 'script', folder)
  // 🛑 Asked BEFORE writing, as `writeMap` asks for its own: `game.writeScript` OVERWRITES, so a
  // second scene from one template threw away whatever the first one's author had written in it.
  const held = await orElse(bridge.game.scripts(), [])
  if (held.some(one => one.path.toLowerCase() === path.toLowerCase())) return

  const source = TEMPLATE_SCRIPT_SOURCES[script]
  await bridge.game.writeScript(path, source)
  // 🛑 Told to the editor's own store, which is what the inspector reads: without it the script
  // this very function just wrote reads as missing in the field that points at it.
  useCode.getState().installed(scriptRefAt(path), source)
}
