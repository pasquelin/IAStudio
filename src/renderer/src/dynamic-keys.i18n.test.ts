import { describe, expect, it } from 'vitest'
import { isRecord } from '@shared/guards'
import { LANGUAGES, TRANSLATIONS, type Language } from '@shared/i18n'
import { PBR_CHANNELS, type PbrChannel } from '@shared/domain/texture'
import { WORKSPACE_IDS } from '@shared/domain/workspace'
import { BODY_PARTS } from '@shared/domain/humanoid'
import { ROOT_MOTIONS } from '@shared/domain/scene'
import { EASINGS } from '@shared/domain/animation'
import { BLEND_MODES } from '@shared/domain/canvasBlend'
import { ADJUSTMENT_KINDS, LAYER_KINDS, type LayerKind } from '@/engines/canvas/canvasState'
import { TRACK_KINDS, type TrackKind } from '@/engines/timeline/timelineState'
import { LAYER_LOCKS } from '@/panels/layers/layerLocks'
import { LAYER_OPERATIONS, type LayerOperation } from '@/panels/layers/LayerStackActions'
import { ADD_ENTRIES } from '@/engines/scene/nodeKinds'
import { ENVIRONMENT_PRESETS } from '@/engines/scene/environmentPresets'
import { SHADOW_LEVELS } from '@/engines/scene/shadowLevels'
import { RIG_STATUSES, type RigStatus } from '@/engines/scene/rigState'
import { RIG_FIT_FAULTS, type RigFitFault } from '@/engines/scene/rigFit'
import { CHARACTER_KINDS } from '@/panels/inspector/RigSection'
import { ASSET_INTENTS } from '@/helpers/assetIntents'
import { FOLDER_SORTS } from '@/helpers/folderSort'
import { TRACK_FLAGS } from '@/panels/timeline/trackFlags'
import { DOCUMENT_NAME_REFUSALS } from '@/app/documentName'
import { FILE_KINDS } from '@shared/domain/folder'
import { FILE_INFO_SECTIONS } from '@/fileInfo/sections'

function resolve(code: Language, key: string): unknown {
  // Widened, not cast: the bundle's inferred type has no index signature, and every key here is
  // composed from a registry rather than written down beside it.
  const bundle: unknown = TRANSLATIONS[code]
  return key
    .split('.')
    .reduce<unknown>((current, part) => (isRecord(current) ? current[part] : undefined), bundle)
}

/** The label AND the sentence beside it — the shape `choicesOf` composes, missing in two ways. */
function explained(prefix: string, values: readonly string[]): string[] {
  return values.flatMap(value => [`${prefix}${value}`, `${prefix}${value}Hint`])
}

/**
 * The keys the interface builds at runtime, from the lists the renderer owns — the ones in
 * `shared/` are covered beside the bundles themselves.
 *
 * They are what a bundle loses quietly. `layerKind_text` was missing for as long as the text
 * tool has existed: drop a caption on a picture, select the layer, and the inspector read
 * `inspector.layerKind_text` where a word belongs.
 */
const COMPOSED_KEYS: readonly string[] = [
  // One button per kind in the timeline's bar, and the label composed from the kind. The union
  // lives in the renderer, so its check does too — beside the list it derives from.
  ...TRACK_KINDS.map(kind => `timeline.addTrack.${kind}`),
  ...TRACK_KINDS.map(kind => `timeline.addTrackHint.${kind}`),
  ...ADJUSTMENT_KINDS.map(kind => `adjustment.${kind}`),
  // The sentence beside each of them. A menu row explains what it does, and the explanation is
  // composed the same way the label is — so it goes missing the same way, and is caught here.
  ...ADJUSTMENT_KINDS.map(kind => `adjustment.${kind}Hint`),
  ...LAYER_LOCKS.map(padlock => `${padlock.labelKey}Hint`),
  ...LAYER_OPERATIONS.map(operation => `layers.${operation}Hint`),
  ...BLEND_MODES.map(mode => `blend.${mode}`),
  ...LAYER_KINDS.map(kind => `inspector.layerKind_${kind}`),
  // What the inspector says an imported model IS. A state with no sentence would read as the
  // raw key on the one surface that tells a user their model cannot be animated yet.
  ...RIG_STATUSES.map(status => `inspector.rigStatus_${status}`),
  // Why a mesh cannot take a skeleton. Composed the same way, and it stands in for the button
  // itself: a fault with no sentence would leave the user a raw key where the offer used to be.
  ...RIG_FIT_FAULTS.map(fault => `inspector.rigFault_${fault}`),
  // The four answers to « what is this », in the dialogue that lays a skeleton.
  ...CHARACTER_KINDS.map(kind => `inspector.characterKinds.${kind}`),
  // Which half of a body a block drives. A part with no sentence would read as a raw key inside
  // the one control that makes two animations stack rather than average.
  ...BODY_PARTS.map(part => `inspector.clipPart_${part}`),
  // Whether a block moves the character or plays on the spot. Same control, same trap.
  ...ROOT_MOTIONS.map(motion => `inspector.rootMotion_${motion}`),
  // How a camera picks up speed along its rail. The only control of the shot section whose rows
  // are composed, so a fifth curve would read as a raw key inside a camera move.
  ...EASINGS.map(easing => `inspector.easing_${easing}`),
  ...TRACK_KINDS.map(kind => `inspector.kind_${kind}`),
  ...TRACK_FLAGS.map(flag => `inspector.${flag.key}`),
  ...LAYER_OPERATIONS.map(operation => `layers.${operation}`),
  ...PBR_CHANNELS.map(channel => `texture.channel.${channel}`),
  // Every row of the menu that says where an asset may go.
  ...ASSET_INTENTS.map(intent => `${intent.labelKey}Hint`),
  // Everything a scene can gain: the panels' add menus draw the mesh and light families, and
  // the 3D bar's own add menu draws all three — `objects` included, which is why it is here.
  ...ADD_ENTRIES.flatMap(({ labelKey }) => [labelKey, `${labelKey}Hint`]),
  // The orders the explorer's bar offers, composed from the union rather than written beside it.
  ...FOLDER_SORTS.map(sort => `explorer.sort.${sort}`),
  ...WORKSPACE_IDS.map(workspace => `home.tools.${workspace}`),
  // The heading of each run of the file information window, composed from the section it draws.
  ...FILE_INFO_SECTIONS.map(id => `fileInfo.sections.${id}`),
  // What the disk answers an entry IS — composed from the fact, not written beside it.
  ...FILE_KINDS.map(kind => `fileInfo.kind.${kind}`),
  // The rail label, built by `workspaceLabelKey` — the most visible string in the window, and
  // the one thing the workspace table does NOT make the compiler demand of a new space.
  ...WORKSPACE_IDS.map(workspace => `workspaces.${workspace}`),
  // Why a typed name was refused, read off the failure the shared check answers with. The
  // compiler holds the other half — the record has one entry per failure or it does not build.
  ...Object.values(DOCUMENT_NAME_REFUSALS),
  // The two unions the 3D environment panel owns itself — the rest of its rows come from
  // `domain/scene` and are held next door. A sixth look or a fifth shadow level without its line
  // reads as its own key inside the panel that settles how a scene is lit.
  ...explained('environment.preset_', ENVIRONMENT_PRESETS),
  ...explained('environment.shadows_', SHADOW_LEVELS),
]

describe('the keys the renderer composes', () => {
  it.each(LANGUAGES.map(language => language.code))('are all named in %s', code => {
    for (const key of COMPOSED_KEYS) {
      const text = resolve(code, key)
      expect(typeof text === 'string' && text.trim() !== '', `${key} is missing`).toBe(true)
    }
  })
})

/**
 * A list that stands for a union has to cover it, or the walk above skips what it never reaches.
 * `LAYER_KINDS` is the one that matters here: it was written to close this very gap.
 */
describe('the lists behind those keys', () => {
  it('holds every kind a layer can be', () => {
    const all: Record<LayerKind, true> = {
      pixel: true,
      group: true,
      adjustment: true,
      text: true,
    }

    expect([...LAYER_KINDS].sort()).toEqual(Object.keys(all).sort())
  })

  it('holds every operation the stack menu offers', () => {
    const all: Record<LayerOperation, true> = { group: true, ungroup: true, duplicate: true }

    expect([...LAYER_OPERATIONS].sort()).toEqual(Object.keys(all).sort())
  })

  it('holds every kind a track can be', () => {
    const all: Record<TrackKind, true> = { video: true, audio: true }

    expect([...TRACK_KINDS].sort()).toEqual(Object.keys(all).sort())
  })

  it('holds every reason a mesh cannot take a skeleton', () => {
    const all: Record<RigFitFault, true> = { noGeometry: true, lyingDown: true }

    expect([...RIG_FIT_FAULTS].sort()).toEqual(Object.keys(all).sort())
  })

  it('holds every state an imported model can be in', () => {
    const all: Record<RigStatus, true> = {
      staticMesh: true,
      skinnedMesh: true,
      riggedCharacter: true,
      animatedCharacter: true,
      skeletonOnly: true,
    }

    expect([...RIG_STATUSES].sort()).toEqual(Object.keys(all).sort())
  })

  it('holds every channel a material carries', () => {
    const all: Record<PbrChannel, true> = {
      baseColor: true,
      normal: true,
      roughness: true,
      metalness: true,
      ao: true,
      height: true,
      emissive: true,
      edge: true,
    }

    expect([...PBR_CHANNELS].sort()).toEqual(Object.keys(all).sort())
  })
})
