import { mdiSkull } from '@mdi/js'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DEFAULT_SETTINGS } from '@shared/domain/settings'
import { EmptyState } from '@/components/EmptyState'
import { SceneRenderer } from '@/engines/scene/SceneRenderer'
import type { Bounds } from '@/engines/scene/rigFit'
import { environmentDressOf } from '@/features/skybox/components/environmentDress'
import { wornModelDress } from '@/features/material/modelDress'
import { createCharacterStage, workshopIdOf } from '@/character/characterStage'
import { assetVersionOf } from '@/stores/assets'
import { saveCharacter, type CharacterSkinning } from '@/character/characterSave'
import { useShortcuts } from '@/hooks/useShortcuts'
import { characterOf, isCharacterDirty, useCharacters } from '@/stores/character'
import { useCharacterView } from '@/stores/characterView'
import { useProject } from '@/stores/project'
import { sceneOf, useScenes } from '@/stores/scenes'
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
  const hostRef = useRef<HTMLDivElement>(null)
  const [name, setName] = useState(assetId)
  const character = useCharacters(state => characterOf(state, assetId))
  const dirty = useCharacters(state => isCharacterDirty(state, assetId))
  // Empty while the file carries its own skin, which is every character rigged elsewhere. What
  // fills it is fitting a skeleton HERE — the weights are the engine's, and it alone has them.
  const [skins, setSkins] = useState<CharacterSkinning>([])
  const [bounds, setBounds] = useState<Bounds | null>(null)
  // The node of the workshop scene, which is what the surfaces of the studio address a model by.
  const nodeId = useScenes(state => sceneOf(state, workshopIdOf(assetId)).nodes[0]?.id)

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
    const element = hostRef.current
    if (!element) return

    // 🛑 The project, and not just this file: a model wears the material of OTHER documents, and
    // the ports that read them walk this window's own stores.
    const leaving = useProject.getState().connect()

    const renderer = new SceneRenderer({
      onSelect: () => {},
      onTransform: () => {},
      // The workshop is the character and a floor: the furniture of a scene has nothing to say
      // about a skeleton.
      chrome: false,
      assetVersion: assetVersionOf,
      wornDress: wornModelDress,
      environmentDress: environmentDressOf,
      onCharacter: (_nodeId, rig, extras) => stage.read(rig, extras),
      // What the mesh MEASURES, which is what a fit proportions itself off — and the only thing
      // that says whether one can be laid at all.
      onRig: (_nodeId, state) => setBounds(state.bounds),
      // Kept for ⌘S: only the engine ever weighs a mesh against a rig.
      onSkinning: (_nodeId, weighed) => setSkins(weighed),
      // A bone is not a node: it has no id in any document, and it is picked apart from anything
      // a scene would select — which is why the engine reports it on its own channel.
      onSelectBone: bone => useCharacterView.getState().pickBone(bone?.bone ?? null),
    })
    renderer.mount(element)
    renderer.configure({
      ...DEFAULT_SETTINGS.three,
      showGrid: true,
      lightHelpers: 'off',
      cameraHelpers: 'off',
      boundingBoxes: 'off',
    })

    // Armed from the first frame: this window is ABOUT the bones, where a scene draws them on
    // demand. Posing turns them rather than moving them, and a click picks a joint.
    renderer.setSkeletons(true)
    renderer.setPoseMode(true)

    const stage = createCharacterStage({ renderer, assetId, onName: setName })

    return () => {
      stage.close()
      renderer.dispose()
      void leaveProject(leaving)
    }
  }, [assetId])

  return (
    <div className="bg-chrome flex h-full w-full flex-col gap-(--sc-gutter) p-(--sc-gutter)">
      <div className="flex min-h-0 flex-1 gap-(--sc-gutter)">
        <div className="bg-monitor relative min-w-0 flex-1 overflow-hidden rounded-(--radius-sc-lg)">
          <div ref={hostRef} className="absolute inset-0" />
          {character.rig === null && (
            <div className="pointer-events-none absolute inset-0">
              <EmptyState icon={mdiSkull} message={t('character.window.waiting')} />
            </div>
          )}
        </div>
        <CharacterWindowInspector
          assetId={assetId}
          name={dirty ? `${name} •` : name}
          bounds={bounds}
          documentId={workshopIdOf(assetId)}
          nodeId={nodeId ?? ''}
        />
      </div>
    </div>
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
