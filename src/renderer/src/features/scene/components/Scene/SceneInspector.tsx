import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useTranslation } from 'react-i18next'
import {
  setGeometryOn,
  setLightOn,
  setMaterialOn,
  dressModel,
  wearMaterialAt,
  setSpriteOn,
  setTextOn,
} from '@/engines/scene/commands'
import { ownedStackOf } from '@shared/domain/postProcessing'
import { railCommand } from '@/engines/scene/nodeRail'
import type { FieldValue } from '@/engines/scene/propertyFields'
import { cameraFields, geometryFields, lightFields } from '@/engines/scene/propertyFields'
import { lensToCommand } from '@/engines/scene/animationCommands'
import { lensAt } from '@/engines/scene/animationEval'
import { newShotAt, shotOfCameraAt } from '@/engines/scene/cameraShots'
import { newId } from '@/helpers/ids'
import { selectedNodes } from '@/engines/scene/sceneState'
import { SCENE_POST, type PostTargetRef } from '@/engines/scene/postCommands'
import { sceneKeyingAt } from '@/helpers/sceneKeyingAt'
import { sceneViewChromeOf, useSceneFrameHead, useSceneViews } from '@/stores/sceneViews'
import { changedFields } from '@/helpers/objects'
import { useToken } from '@/hooks/useToken'
import { sceneOf, useScenes } from '@/stores/scenes'
import { DescriptorSection } from '../../../../components/DescriptorSection'
import { CameraAlignButton } from '../Camera/CameraAlignButton'
import { CameraShotSection } from '../Camera/ShotSection/CameraShotSection'
import { ComponentsSection } from '../ComponentsSection'
import { RigSection } from '../RigSection'
import { EnvironmentPanel } from '../Environment/EnvironmentPanel'
import { CameraPostSection } from '../Camera/CameraPostSection'
import { PostProcessingSection } from '../Post/PostProcessingSection'
import { MaterialSection } from '../../../material/components/Material/MaterialSection'
import { ModelDressSection } from '../ModelDressSection/ModelDressSection'
import { materialSlotsOfNode, useModelFiles } from '@/stores/modelFiles'
import { PathSection } from '../PathSection'
import { AttachSection } from '../AttachSection'
import { ShadowSection } from '../ShadowSection'
import { SpriteSection } from '../SpriteSection'
import { TextSection } from '../TextSection'
import { TransformSection } from '../TransformSection'
import { useSceneEdit } from '@/hooks/useSceneEdit'

export type SceneInspectorProps = { documentId: string }

/**
 * Everything that defines the selected nodes, and lets them be played with.
 *
 * The anchor — the last node picked — is what the fields read out; typing into one writes the
 * value onto every selected node built the same way, as one entry in the history. Which nodes
 * those are is a rule about the scene, so it lives in the commands rather than here. The name is
 * the one field that stays on the anchor: three nodes of one name is not a rename.
 *
 * One face of the inspector rather than the whole of it: which document is in front is decided
 * by `Inspector`.
 */
export function SceneInspector({ documentId }: SceneInspectorProps) {
  const { t } = useTranslation()
  const nodes = useScenes(state => sceneOf(state, documentId).nodes)
  const animation = useScenes(state => sceneOf(state, documentId).animation)
  const at = useSceneFrameHead(documentId, animation.fps)
  const selectedIds = useScenes(state => sceneOf(state, documentId).selectedIds)
  const world = useScenes(state => sceneOf(state, documentId).world)
  const lockedAxes = useScenes(state => sceneOf(state, documentId).lockedAxes)
  const view = useSceneViews(useShallow(state => sceneViewChromeOf(state, documentId)))
  const selection = useMemo(() => selectedNodes(nodes, selectedIds), [nodes, selectedIds])
  const node = selection.at(-1) ?? null

  const edit = useSceneEdit(documentId)
  // Cached per theme, not per render: this component re-renders on every frame of a drag.
  const meshColor = useToken('--color-mesh')

  const mesh = node?.type === 'mesh' ? node : null
  const carved = node?.type === 'carved' ? node : null
  const light = node?.type === 'light' ? node : null
  const sprite = node?.type === 'sprite' ? node : null
  const text = node?.type === 'text' ? node : null
  const model = node?.type === 'model' ? node : null
  const modelSlots = useModelFiles(state =>
    model ? materialSlotsOfNode(state, documentId, model.id) : 0,
  )
  const camera = node?.type === 'camera' ? node : null
  const path = node?.type === 'path' ? node : null
  const band =
    mesh && mesh.geometry.kind === 'ribbon' ? { id: mesh.id, shape: mesh.geometry } : null
  const rail = path?.path ?? band?.shape.path ?? null
  const geometry = useMemo(() => (mesh ? geometryFields(mesh.geometry) : []), [mesh])
  const lit = useMemo(() => (light ? lightFields(light.light) : []), [light])
  const cameraStack = ownedStackOf(camera?.camera.post)
  const cameraTarget = useMemo(
    (): PostTargetRef => ({ kind: 'camera', nodeId: camera?.id ?? '' }),
    [camera?.id],
  )
  const lens = useMemo(
    () => (camera ? cameraFields(lensAt(camera.camera, animation, camera.id, at)) : []),
    [camera, animation, at],
  )

  // Which lens fields can be keyed is `lensToCommand`'s to know, not a panel's. Read at call time
  // rather than from the render above, so a value typed as playback runs keys where it lands.
  const changeLens = (name: string, value: FieldValue): void => {
    const keying = sceneKeyingAt(documentId)
    edit.run(
      lensToCommand(keying.state.animation, selection, name, value, keying.at, keying.recording),
    )
  }

  // The environment belongs to the document rather than to a node, so it shows either way — and
  // it is what keeps the panel from being empty when nothing is selected, in place of a message.
  return (
    <>
      <EnvironmentPanel
        documentId={documentId}
        world={world}
        // The pane being worked in, not the first: a display mode is per view, and the panel has
        // to name the one the hand is over. Published by the engine — see `setActivePane`.
        mode={view.displays[view.activePane] ?? 'shaded'}
        onMode={mode => useSceneViews.getState().setDisplay(documentId, view.activePane, mode)}
        skeletons={view.skeletons}
        onSkeletons={skeletons => useSceneViews.getState().setSkeletons(documentId, skeletons)}
        snapping={view.snapping}
        onSnap={(kind, on) => useSceneViews.getState().setSceneSnap(documentId, kind, on)}
      />

      {/* Beside the environment and for the same reason: a composition belongs to the DOCUMENT
          rather than to a node, so it is there to be built the moment a scene is opened — with
          no camera to make first, which is the whole of § 2. */}
      <PostProcessingSection
        documentId={documentId}
        target={SCENE_POST}
        stack={world.post}
        edit={edit}
        title={t('postfx.title')}
      />

      {node && (
        <>
          <TransformSection
            node={node}
            nodes={nodes}
            selection={selection}
            lockedAxes={lockedAxes}
            edit={edit}
          />
          <ShadowSection node={node} selection={selection} edit={edit} />
          {/* The anchor alone: two objects hung on one socket would stand inside each other. */}
          <AttachSection node={node} documentId={documentId} edit={edit} />
          {/* The anchor alone, unlike the sections above: a component carries values of its own,
              and writing one onto every selected object would overwrite what each was given. */}
          <ComponentsSection node={node} nodes={nodes} edit={edit} />
        </>
      )}

      {mesh && (
        <>
          <DescriptorSection
            title={t('inspector.geometry')}
            scId="geometry"
            fields={geometry}
            onChange={(name, value) =>
              edit.run(setGeometryOn(selection, mesh.geometry, name, value))
            }
            gesture={edit.gesture}
          />
          <MaterialSection
            material={mesh.material}
            fallbackColor={meshColor}
            onChange={material =>
              edit.run(setMaterialOn(selection, changedFields(mesh.material, material)))
            }
            gesture={edit.gesture}
          />
        </>
      )}

      {/* The material section a mesh gets, and only it: a solid's SHAPE is its recipe, which has
          no descriptor to draw fields from. Minus the tiling — a solid's grid is written into its
          UVs from each BRUSH's own density (`brushOf`), so the node's would settle nothing. */}
      {carved && (
        <MaterialSection
          material={carved.material}
          fallbackColor={meshColor}
          tiling={false}
          onChange={material =>
            edit.run(setMaterialOn(selection, changedFields(carved.material, material)))
          }
          gesture={edit.gesture}
        />
      )}

      {text && (
        <>
          <TextSection
            text={text.text}
            onChange={next => edit.run(setTextOn(selection, changedFields(text.text, next)))}
            gesture={edit.gesture}
          />
          {/* The very section a mesh gets: a text is lit the same way and wears the same
              descriptor, so neither has to know the other exists. Minus the tiling — a text's
              outline is not a primitive, and its UVs never go through `uvTiling`. */}
          <MaterialSection
            material={text.material}
            fallbackColor={meshColor}
            tiling={false}
            onChange={material =>
              edit.run(setMaterialOn(selection, changedFields(text.material, material)))
            }
            gesture={edit.gesture}
          />
        </>
      )}

      {model && (
        <>
          <RigSection documentId={documentId} node={model} />
          {/* On the anchor alone, unlike a material: how many slots a model has depends on what
              its own file carries, so spreading a dress over a selection would name slots meshes
              beside it never had. */}
          <ModelDressSection
            assetId={model.model.assetId}
            name={model.name}
            dress={model.model.dress}
            slots={modelSlots}
            onChange={dress => edit.run(dressModel(model.id, dress))}
            // A COMMAND, so the list it edits is the one the document holds when it lands — not
            // the one this panel was drawn with, several awaits earlier.
            onWearAt={(slot, materialId) => edit.run(wearMaterialAt(model.id, slot, materialId))}
          />
        </>
      )}

      {sprite && (
        <SpriteSection
          sprite={sprite.sprite}
          fallbackColor={meshColor}
          onChange={next => edit.run(setSpriteOn(selection, changedFields(sprite.sprite, next)))}
          gesture={edit.gesture}
        />
      )}

      {rail && (
        <PathSection
          path={rail}
          onChange={next => {
            const command = node ? railCommand(node, next) : null
            if (command) edit.run(command)
          }}
          gesture={edit.gesture}
        />
      )}

      {camera && <CameraPostSection documentId={documentId} camera={camera} edit={edit} />}

      {/* Only while it OWNS one: a camera that inherits edits the scene's stack above, and a
          second panel writing into the same place is two panels disagreeing about one value. */}
      {cameraStack && camera && (
        <PostProcessingSection
          documentId={documentId}
          target={cameraTarget}
          stack={cameraStack}
          edit={edit}
          title={t('postfx.cameraOwner', { name: camera.name })}
        />
      )}

      {camera && (
        <>
          <DescriptorSection
            title={t('inspector.camera')}
            scId="camera"
            fields={lens}
            onChange={changeLens}
            gesture={edit.gesture}
          >
            <CameraAlignButton documentId={documentId} camera={camera} />
          </DescriptorSection>
          <CameraShotSection
            camera={camera}
            shot={shotOfCameraAt(animation, camera.id, at)}
            shotAtHead={() =>
              newShotAt(animation, camera.id, newId(), sceneKeyingAt(documentId).at)
            }
            nodes={nodes}
            run={command => edit.run(command)}
            gesture={edit.gesture}
          />
        </>
      )}

      {light && (
        <DescriptorSection
          title={t('inspector.light')}
          scId="light"
          fields={lit}
          onChange={(name, value) => edit.run(setLightOn(selection, light.light, name, value))}
          gesture={edit.gesture}
        />
      )}
    </>
  )
}
