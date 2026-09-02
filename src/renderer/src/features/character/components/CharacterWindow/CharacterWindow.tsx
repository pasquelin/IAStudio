import { mdiSkull } from '@mdi/js'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { CommandId } from '@shared/domain/command'
import { DEFAULT_SETTINGS } from '@shared/domain/settings'
import type { Transform } from '@shared/domain/transform'
import { EmptyState } from '@/components/EmptyState'
import { Toolbar } from '@/components/Toolbar/Toolbar'
import { PANE_TOOLBAR } from '@/components/styles'
import { TooltipHost } from '@/components/TooltipHost'
import { WindowTitleBar } from '@/components/WindowTitleBar'
import { SceneRenderer } from '@/engines/scene/SceneRenderer'
import type { MeshSample } from '@/engines/scene/rigSnap'
import { environmentDressOf } from '@/features/skybox/components/environmentDress'
import { wornModelDress } from '@/features/material/modelDress'
import { createCharacterStage, workshopIdOf } from '@/character/characterStage'
import { useAccounts } from '@/stores/accounts'
import { assetsById, assetVersionOf, useAssets } from '@/stores/assets'
import { saveCharacter, type CharacterSkinning } from '@/character/characterSave'
import { saveCharacterMotion } from '@/character/characterMotion'
import { useConnections } from '@/hooks/useConnections'
import { reportFailure } from '@/services/diagnostics'
import { useMenuScope } from '@/hooks/useMenuScope'
import { useShortcuts } from '@/hooks/useShortcuts'
import { restWithin } from '@/engines/character/boneRest'
import { setCharacterBoneRest } from '@/engines/character/characterCommands'
import { characterOf, isCharacterDirty, useCharacters } from '@/stores/character'
import { useCharacterView } from '@/stores/characterView'
import { useProject } from '@/stores/project'
import { useSettings } from '@/stores/settings'
import { nodeById } from '@/engines/scene/sceneState'
import { renameNode } from '@/engines/scene/commands'
import { sceneOf, useScenes } from '@/stores/scenes'
import { AnimationPanel } from '@/features/animation/components/Animation/AnimationPanel'
import { StudioQueries } from '@/features/shell/components/StudioQueries'
import {
  CHARACTER_EDIT_REST,
  CHARACTER_LOCK_LENGTHS,
  CHARACTER_LOCK_TOOL,
  CHARACTER_REST_TOOL,
  CHARACTER_TOOLS,
} from './characterTools'
import { CharacterWindowInspector } from './CharacterWindowInspector'

export type CharacterWindowProps = { assetId: string }

/**
 * One character, edited on its own: its skeleton on the left, what it is made of on the right.
 *
 * It holds an ENGINE of its own — a WebGL context never crosses a window — and its subject is a
 * FILE, never a node of a scene. A fixed layout and no dock: there is nothing here to rearrange.
 */
export function CharacterWindow({ assetId }: CharacterWindowProps) {
  const { t } = useTranslation()

  // The three the studio window replicates and this one reads too: the catalogue for the name and
  // the weight of the file, the settings for whether an account is signed in, the accounts for
  // which one. Without them the inspector reads an empty catalogue and asks for no plan at all.
  useConnections([
    useSettings(state => state.connect),
    useAccounts(state => state.connect),
    useAssets(state => state.connect),
  ])

  const hostRef = useRef<HTMLDivElement>(null)
  const engineRef = useRef<SceneRenderer | null>(null)
  const character = useCharacters(state => characterOf(state, assetId))
  const name = useAssets(state => assetsById(state).get(assetId)?.name ?? assetId)
  const dirty = useCharacters(state => isCharacterDirty(state, assetId))
  // Empty while the file carries its own skin, which is every character rigged elsewhere. What
  // fills it is fitting a skeleton HERE — the weights are the engine's, and it alone has them.
  const [skins, setSkins] = useState<CharacterSkinning>([])
  // What the mesh measures AND what it is made of: a fit reads the first for proportions and
  // the second to pull each joint inside the body.
  const [sample, setSample] = useState<MeshSample | null>(null)
  // The node of the workshop scene, which is what the surfaces of the studio address a model by.
  const nodeId = useScenes(state => sceneOf(state, workshopIdOf(assetId)).nodes[0]?.id)
  const picked = useCharacterView(state => state.pickedBone)
  const mode = useCharacterView(state => state.mode)
  const lockedLengths = useCharacterView(state => state.lockedLengths)
  const heldAxes = useCharacterView(state => state.heldAxes)
  const editingRest = useCharacterView(state => state.editingRest)

  // Its OWN scope and not the scene's: ⌘Z here must not reach the scene a studio window is
  // showing beside it. Two doors to one handler: the keys the window sees, and the rows the menu
  // fires — which is the only way ⌘S arrives, the menu carrying that key on macOS.
  const runCommand = (command: CommandId): void => {
    const store = useCharacters.getState()
    if (command === 'character.undo') store.undo(assetId)
    if (command === 'character.redo') store.redo(assetId)
    // Awaited by nobody, and nothing to extract: the journal is the only place the failure goes.
    if (command === 'document.save')
      void saveCharacter(assetId, skins).catch(error =>
        reportFailure('document.save', assetId, error),
      )
  }
  useShortcuts({ scope: 'character', enabled: true, onCommand: runCommand })
  useMenuScope('character', runCommand)

  /**
   * The band's own motion, filed as a project asset: the workshop scene exported with the clip
   * the timeline bakes. Here rather than in the panel, since only this window holds the engine.
   */
  const saveMotion = async (): Promise<void> => {
    const engine = engineRef.current
    if (!engine) return

    try {
      await saveCharacterMotion(
        assetId,
        t('character.motionNew'),
        await engine.exportTo('glb', 'scene'),
      )
    } catch (error) {
      reportFailure('assets.copy', assetId, error)
    }
  }

  useEffect(() => {
    engineRef.current?.setMode(mode)
  }, [mode])

  // 🛑 The padlocks reach the DRAG, not just the release: unleashed for the length of a gesture,
  // a joint leaves the body and drags the skin after it — seen on screen the 2026-09-02.
  useEffect(() => {
    engineRef.current?.setBoneHold({ heldAxes, lockedLengths })
  }, [heldAxes, lockedLengths])

  // 🛑 The rest is put back BEFORE the engine measures the skins against it: a bone left where a
  // pose placed it would be bound there, and that pose would become the character's own shape.
  useEffect(() => {
    const engine = engineRef.current
    if (!engine || !nodeId) return

    if (editingRest)
      for (const bone of characterOf(useCharacters.getState(), assetId).rig?.bones ?? [])
        engine.poseBone(nodeId, bone.name, bone.rest)

    engine.setRestEditing(editingRest)
  }, [editingRest, assetId, nodeId])

  // The band names its subject after the node, and a workshop is laid before the catalogue has
  // answered: without this its one row reads `asset_d826b135-…` rather than the character.
  useEffect(() => {
    if (!nodeId || name === assetId) return

    const scene = sceneOf(useScenes.getState(), workshopIdOf(assetId))
    if (nodeById(scene, nodeId)?.name === name) return

    useScenes.getState().runCommand(workshopIdOf(assetId), renameNode(nodeId, name))
  }, [assetId, name, nodeId])

  // 🛑 What puts a gizmo on a joint, and paints it as the chosen one. Without it the engine hears
  // its own pick back from nobody: a bone could be named by the panel and still not be held.
  useEffect(() => {
    engineRef.current?.setPickedBone(picked && nodeId ? { nodeId, bone: picked } : null)
  }, [picked, nodeId])

  // 🛑 The skeleton the store holds, put ON the model. Without this a fitted rig lives in a
  // state nobody draws, no weights are ever worked out, and ⌘S writes bones bound to nothing.
  useEffect(() => {
    const engine = engineRef.current
    if (!engine || !nodeId || !character.rig) return

    void engine.skinModel(nodeId, character.rig)
  }, [character.rig, nodeId])

  useEffect(() => {
    const element = hostRef.current
    if (!element) return

    // 🛑 The project, and not just this file: a model wears the material of OTHER documents, and
    // the ports that read them walk this window's own stores.
    const leaving = useProject.getState().connect()

    const renderer = new SceneRenderer({
      onSelect: () => {},
      // The gizmo's own report, once per gesture. A joint dragged is a joint that RESTS there:
      // the fit lands each one near enough off a bounding box, and this is the hand correcting it.
      onTransform: moves => {
        for (const move of moves) {
          if (!move.bone) continue
          // 🛑 The padlock bites on the gizmo too, not just on the fields: a hold the viewport
          // walked through would be a padlock that only draws itself.
          const kept = boneRestHeld(assetId, move.bone, move.transform)
          // The two gestures of this window: editing writes the skeleton of the FILE, posing
          // leaves it untouched and lets the mesh follow — see `CHARACTER_REST_TOOL`.
          if (useCharacterView.getState().editingRest)
            useCharacters.getState().runCommand(assetId, setCharacterBoneRest(move.bone, kept))
          else engineRef.current?.poseBone(move.id, move.bone, kept)
        }
      },
      // The workshop is the character and a floor: the furniture of a scene has nothing to say
      // about a skeleton.
      chrome: false,
      assetVersion: assetVersionOf,
      wornDress: wornModelDress,
      environmentDress: environmentDressOf,
      onCharacter: (_nodeId, rig, extras, measured) => {
        setSample(measured)
        stage.read(rig, extras, measured?.bounds ?? null)
      },
      // Kept for ⌘S: only the engine ever weighs a mesh against a rig.
      onSkinning: (_nodeId, weighed) => setSkins(weighed),
      // A bone is not a node: it has no id in any document, and it is picked apart from anything
      // a scene would select — which is why the engine reports it on its own channel.
      onSelectBone: bone => useCharacterView.getState().pickBone(bone?.bone ?? null),
    })
    renderer.mount(element)
    engineRef.current = renderer
    renderer.configure({
      ...DEFAULT_SETTINGS.three,
      showGrid: true,
      lightHelpers: 'off',
      cameraHelpers: 'off',
      boundingBoxes: 'off',
    })

    // Armed from the first frame: this window is ABOUT the bones, where a scene draws them on
    // demand. A click picks a joint, and the gizmo it hands it to MOVES it — a skeleton is
    // edited by placing its joints, where a scene poses one by turning them.
    renderer.setSkeletons(true)
    renderer.setPoseMode(true)
    renderer.setRestEditing(useCharacterView.getState().editingRest)
    renderer.setMode(useCharacterView.getState().mode)
    renderer.setBoneHold({
      heldAxes: useCharacterView.getState().heldAxes,
      lockedLengths: useCharacterView.getState().lockedLengths,
    })

    const stage = createCharacterStage({ renderer, assetId })

    return () => {
      engineRef.current = null
      stage.close()
      renderer.dispose()
      void leaveProject(leaving)
    }
  }, [assetId])

  return (
    // The rigging services come from the model registry, which every window reads through the
    // same cache: without a client of its own this window is an error screen, not a character.
    <StudioQueries>
      <div className="bg-chrome flex h-full w-full flex-col">
        {/* Flush with the top like every other window's, so the title lands on the traffic
            lights — padded by the gutter it sat 6px off them. Unsaved is said the way every tab
            says it: a bullet after the name, as `setDocumentTitle` writes one. */}
        <WindowTitleBar title={`${t('character.window.titleOf', { name })}${dirty ? ' •' : ''}`} />

        {/* The gutter around the panes and not around the bar, as the studio frames its docks. */}
        <div className="flex min-h-0 flex-1 gap-(--sc-gutter) p-(--sc-gutter)">
          <div className="bg-monitor relative min-w-0 flex-1 overflow-hidden rounded-(--radius-sc-lg)">
            <div ref={hostRef} className="absolute inset-0" />
            <Toolbar
              className={PANE_TOOLBAR}
              label={t('character.tools')}
              tools={[
                ...CHARACTER_TOOLS,
                { ...CHARACTER_LOCK_TOOL, pressed: lockedLengths },
                { ...CHARACTER_REST_TOOL, pressed: editingRest },
              ]}
              activeTool={mode}
              onTool={id => {
                const view = useCharacterView.getState()
                if (id === CHARACTER_LOCK_LENGTHS) {
                  view.lockCharacterLengths(!view.lockedLengths)
                  return
                }
                if (id === CHARACTER_EDIT_REST) {
                  view.editCharacterRest(!view.editingRest)
                  return
                }

                const chosen = CHARACTER_TOOLS.find(tool => tool.id === id)
                if (chosen) view.setCharacterMode(chosen.mode)
              }}
            />
            {/* While the FILE is still landing, never while it merely carries no skeleton: a
                bare mesh is on screen and animatable from the panel beside it, and the sentence
                sat over a character plainly there. `sample` is what the engine measured. */}
            {!sample && (
              <div className="pointer-events-none absolute inset-0">
                <EmptyState icon={mdiSkull} message={t('character.window.waiting')} />
              </div>
            )}
          </div>
          <CharacterWindowInspector
            assetId={assetId}
            sample={sample}
            onSaveMotion={saveMotion}
            documentId={workshopIdOf(assetId)}
            nodeId={nodeId ?? ''}
          />
        </div>

        {/* The studio's own band, on this window's workshop scene: laying a key by hand is the
            one thing a posed character is for, and a band written again here would be a second
            copy of every gesture. No lanes and no shots live in a workshop, so what is left of
            it is exactly the two this window needs — scrubbing, and keying. */}
        <section
          aria-label={t('character.band')}
          className="bg-panel mt-(--sc-gutter) h-64 shrink-0 overflow-hidden rounded-(--radius-sc-lg)"
        >
          <AnimationPanel documentId={workshopIdOf(assetId)} />
        </section>
      </div>

      {/* Per window, and easy to forget: without it every tooltip attribute in here writes a
          sentence nobody ever sees. */}
      <TooltipHost />
    </StudioQueries>
  )
}

/** The unsubscribe the connection answers with, awaited where a teardown cannot be async. */
async function leaveProject(leaving: Promise<() => void>): Promise<void> {
  try {
    ;(await leaving)()
  } catch {
    /* the connection never landed */
  }
}

/**
 * What a gizmo just wrote, brought back within the holds this window offers.
 *
 * Here rather than in the command: a command is what the MCP and the fields both run, and a hold
 * is a state of this WINDOW — one bound into the command would hold an axis for a caller that
 * never closed a padlock.
 */
function boneRestHeld(assetId: string, bone: string, moved: Transform): Transform {
  const view = useCharacterView.getState()
  const rested = characterOf(useCharacters.getState(), assetId).rig?.bones.find(
    one => one.name === bone,
  )?.rest

  return rested ? restWithin(rested, moved, view) : moved
}
