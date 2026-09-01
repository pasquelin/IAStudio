import { mdiSkull } from '@mdi/js'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DEFAULT_SETTINGS } from '@shared/domain/settings'
import { EmptyState } from '@/components/EmptyState'
import { Toolbar } from '@/components/Toolbar/Toolbar'
import { PANE_TOOLBAR } from '@/components/styles'
import { TooltipHost } from '@/components/TooltipHost'
import { WindowTitleBar } from '@/components/WindowTitleBar'
import { SceneRenderer } from '@/engines/scene/SceneRenderer'
import type { Bounds } from '@/engines/scene/rigFit'
import { TIP_BOTTOM } from '@/helpers/tooltip'
import { environmentDressOf } from '@/features/skybox/components/environmentDress'
import { wornModelDress } from '@/features/material/modelDress'
import { createCharacterStage, workshopIdOf } from '@/character/characterStage'
import { useAccounts } from '@/stores/accounts'
import { assetsById, assetVersionOf, useAssets } from '@/stores/assets'
import { saveCharacter, type CharacterSkinning } from '@/character/characterSave'
import { useConnections } from '@/hooks/useConnections'
import { useShortcuts } from '@/hooks/useShortcuts'
import { setCharacterBoneRest } from '@/engines/character/characterCommands'
import { characterOf, isCharacterDirty, useCharacters } from '@/stores/character'
import { useCharacterView } from '@/stores/characterView'
import { useProject } from '@/stores/project'
import { useSettings } from '@/stores/settings'
import { sceneOf, useScenes } from '@/stores/scenes'
import { StudioQueries } from '@/features/shell/components/StudioQueries'
import { CHARACTER_TOOLS } from './characterTools'
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
  const [bounds, setBounds] = useState<Bounds | null>(null)
  // The node of the workshop scene, which is what the surfaces of the studio address a model by.
  const nodeId = useScenes(state => sceneOf(state, workshopIdOf(assetId)).nodes[0]?.id)
  const picked = useCharacterView(state => state.pickedBone)
  const mode = useCharacterView(state => state.mode)

  // The window's own keys. Its OWN scope and not the scene's: ⌘Z here must not reach the scene a
  // studio window is showing beside it.
  useShortcuts({
    scope: 'character',
    enabled: true,
    onCommand: command => {
      const store = useCharacters.getState()
      if (command === 'character.undo') store.undo(assetId)
      if (command === 'character.redo') store.redo(assetId)
      // Awaited by nobody, and there is nothing to extract: the journal carries the reason.
      if (command === 'document.save') void saveCharacter(assetId, skins).catch(() => {})
    },
  })

  useEffect(() => {
    engineRef.current?.setMode(mode)
  }, [mode])

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
          const rest = setCharacterBoneRest(move.bone, move.transform)
          useCharacters.getState().runCommand(assetId, rest)
        }
      },
      // The workshop is the character and a floor: the furniture of a scene has nothing to say
      // about a skeleton.
      chrome: false,
      assetVersion: assetVersionOf,
      wornDress: wornModelDress,
      environmentDress: environmentDressOf,
      onCharacter: (_nodeId, rig, extras, measured) => {
        setBounds(measured)
        stage.read(rig, extras, measured)
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
    renderer.setMode(useCharacterView.getState().mode)

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
      <div className="bg-chrome flex h-full w-full flex-col gap-(--sc-gutter) p-(--sc-gutter)">
        {/* Frameless like the studio, so the traffic lights float in this strip rather than in a
            bar the system draws. It names the FILE being edited — the panel beside it holds the
            sections, not the subject. */}
        <WindowTitleBar
          title={t('character.window.titleOf', { name })}
          mark={
            dirty && (
              // The dock's own mark for an unsaved document, and the one it never explained:
              // a bullet nobody can read is a bullet somebody asks about.
              <span className="text-muted shrink-0" {...TIP_BOTTOM(t('character.window.unsaved'))}>
                •
              </span>
            )
          }
        />

        <div className="flex min-h-0 flex-1 gap-(--sc-gutter)">
          <div className="bg-monitor relative min-w-0 flex-1 overflow-hidden rounded-(--radius-sc-lg)">
            <div ref={hostRef} className="absolute inset-0" />
            <Toolbar
              className={PANE_TOOLBAR}
              label={t('character.tools')}
              tools={[...CHARACTER_TOOLS]}
              activeTool={mode}
              onTool={id => {
                const chosen = CHARACTER_TOOLS.find(tool => tool.id === id)
                if (chosen) useCharacterView.getState().setCharacterMode(chosen.mode)
              }}
            />
            {/* While the FILE is still landing, never while it merely carries no skeleton: a
                bare mesh is on screen and animatable from the panel beside it, and the sentence
                sat over a character plainly there. `bounds` is what the engine measured. */}
            {!bounds && (
              <div className="pointer-events-none absolute inset-0">
                <EmptyState icon={mdiSkull} message={t('character.window.waiting')} />
              </div>
            )}
          </div>
          <CharacterWindowInspector
            assetId={assetId}
            bounds={bounds}
            documentId={workshopIdOf(assetId)}
            nodeId={nodeId ?? ''}
          />
        </div>
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
