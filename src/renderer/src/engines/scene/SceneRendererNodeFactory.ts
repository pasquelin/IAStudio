import { CameraHelper, Light, Mesh, Object3D, PerspectiveCamera, Sprite } from 'three'
import { type LightDescriptor } from '@shared/domain/scene'
import {
  type ModelNode,
  type SceneNode,
  type SpriteNode,
  type CarvedNode,
  type MeshNode,
  type TextNode,
} from './sceneState'
import { railOf } from './nodeRail'
import { dressWithRail, type RailColours, cameraBody } from './threeFactory'
import { applyLightBody } from './lightBodies'
import {
  applyCamera,
  wearGeometry,
  applyLight,
  applyMaterial,
  applyNegative,
  applyPath,
  applySprite,
  standardMaterialOf,
} from './threeSync'
import './bvhPatches'
import { isCarvable, isNegative } from '../csg/carve'
import { SceneRendererSync } from './SceneRendererSync'
export abstract class SceneRendererNodeFactory extends SceneRendererSync {
  protected abstract applyDisplay(object: Object3D): void
  protected abstract dressLight(id: string, light: Light, descriptor: LightDescriptor): void
  protected abstract recut(node: CarvedNode, into: Mesh): Promise<void>
  protected abstract reshapeText(node: TextNode): Promise<void>
  protected abstract buildMesh(
    node: SceneNode & {
      type: 'mesh'
    },
  ): Mesh
  protected abstract buildLight(
    node: SceneNode & {
      type: 'light'
    },
  ): Light
  protected abstract buildModel(node: ModelNode): Object3D
  protected abstract buildSprite(node: SpriteNode): Sprite
  protected abstract buildText(node: TextNode): Mesh
  protected abstract railColours(): RailColours
  protected abstract buildCarved(node: CarvedNode): Mesh
  /**
   * What an edit changed on the object already in the scene. Compared against the node last
   * applied rather than against the three.js object: a descriptor is one reference, and an edit
   * that did not touch the material must not walk it field by field.
   */
  protected syncDescriptors(
    object: Object3D,
    previous: SceneNode | undefined,
    node: SceneNode,
  ): void {
    const syncMesh = (): boolean => {
      if (node.type !== 'mesh' || !(object instanceof Mesh)) return false
      const before = previous?.type === 'mesh' ? previous : null
      if (
        before?.geometry !== node.geometry ||
        before.material.tilesPerMetre !== node.material.tilesPerMetre
      ) {
        const worn = wearGeometry(
          object,
          this.shapes.acquire(node.geometry, node.material.tilesPerMetre),
        )
        if (worn) this.freeGeometry(worn)
        else this.shapes.release(object.geometry)
        if (this.needsEdges()) this.applyDisplay(object)
        const rail = railOf(node)
        if (rail) applyPath(object, rail, this.meshColor)
      }
      this.paintShape(object, node, before)
      return true
    }
    if (syncMesh()) return
    if (node.type === 'light' && object instanceof Light) {
      const before = previous?.type === 'light' ? previous : null
      if (before?.light === node.light) return
      applyLight(object, node.light)
      const marker = this.markers.get(node.id)
      if (marker && before?.light.kind === node.light.kind) applyLightBody(marker, node.light)
      else this.dressLight(node.id, object, node.light)
      return
    }
    if (node.type === 'sprite' && object instanceof Sprite) {
      const before = previous?.type === 'sprite' ? previous : null
      if (before?.sprite === node.sprite) return
      applySprite(object.material, node.sprite, this.meshColor)
      this.spriteMaps.get(node.id)?.apply(node.sprite)
      return
    }
    const syncDescriptorsStep1 = () => {
      const syncDescriptorsStep1 = () => {
        if (node.type === 'model') {
          const before = previous?.type === 'model' ? previous : null
          if (before?.model.dress !== node.model.dress) this.dressModel(node.id)
          return
        }
        if (node.type === 'camera' && object instanceof PerspectiveCamera) {
          const before = previous?.type === 'camera' ? previous : null
          if (before?.camera !== node.camera) applyCamera(object, node.camera)
          return
        }
        if (node.type === 'path') {
          const before = previous?.type === 'path' ? previous : null
          if (before?.path !== node.path) applyPath(object, node.path, this.meshColor)
          return
        }
        const syncDescriptorsStep2 = () => {
          if (node.type === 'carved' && object instanceof Mesh) {
            const before = previous?.type === 'carved' ? previous : null
            if (before?.carved !== node.carved) void this.recut(node, object)
            this.paintShape(object, node, before)
            return
          }
          if (node.type === 'text' && object instanceof Mesh) {
            const before = previous?.type === 'text' ? previous : null
            if (before?.text !== node.text) void this.reshapeText(node)
            const material = standardMaterialOf(object)
            if (material && before?.material !== node.material) {
              applyMaterial(material, node.material, this.meshColor)
            }
          }
        }
        return syncDescriptorsStep2()
      }
      return syncDescriptorsStep1()
    }
    return syncDescriptorsStep1()
  }
  /**
   * What a shape is painted with — its material, then the TOOL MARK that overrides it.
   *
   * The mark belongs in the same test as the material: taking one off repaints nothing otherwise,
   * and the shape stays red for the rest of the session. The texture slots follow, exactly as a
   * mesh's do — without them a map assigned in the inspector changes the document and not the
   * screen.
   */
  protected paintShape(object: Mesh, node: MeshNode | CarvedNode, before: SceneNode | null): void {
    const material = standardMaterialOf(object)
    const wore = before?.id === node.id && isCarvable(before) ? before : null
    if (!material || (wore?.material === node.material && wore.negative === node.negative)) return
    applyMaterial(material, node.material, this.meshColor)
    applyNegative(material, this.negativeColor, isNegative(node))
    this.textures.get(node.id)?.apply(node.material)
  }
  protected build(node: SceneNode): Object3D {
    if (node.type === 'mesh') return this.buildMesh(node)
    if (node.type === 'light') return this.buildLight(node)
    if (node.type === 'model') return this.buildModel(node)
    if (node.type === 'sprite') return this.buildSprite(node)
    if (node.type === 'text') return this.buildText(node)
    if (node.type === 'camera') return this.buildCamera(node)
    if (node.type === 'path') {
      return dressWithRail(new Object3D(), node.path, this.railColours(), false)
    }
    if (node.type === 'carved') return this.buildCarved(node)
    // A group is its transform and nothing else: an empty object others hang from.
    return new Object3D()
  }
  /**
   * A camera of the scene: the body one sees and clicks, and the frustum selection adds to it.
   *
   * The body hangs UNDER the camera, so it follows every move; the frustum hangs BESIDE it, in
   * the scene, like a light's helper — and that is not a preference. `CameraHelper` sets
   * `this.matrix = camera.matrixWorld` with `matrixAutoUpdate` off, so it places itself ON the
   * camera: made a child of it, that matrix applied TWICE and the outline was drawn at double
   * the camera's placement. A camera at (0, 2, 6) had its frustum floating at (0, 4, 12), which
   * is what a selection looked like until Alban pointed at it.
   *
   * The body carries no name of its own, so a click on it walks up to the camera's id.
   */
  protected buildCamera(
    node: SceneNode & {
      type: 'camera'
    },
  ): Object3D {
    const camera = new PerspectiveCamera(node.camera.fov, 1, node.camera.near, node.camera.far)
    const helper = new CameraHelper(camera)
    this.viewport.scene.add(helper)
    const body = cameraBody(this.markerColor, this.markerEdge)
    camera.add(body)
    // Kept beside the light helpers, and for the same reason: the preview hides all of them on
    // every frame it draws, and finding them by walking each node's children would be a scan.
    this.frustums.set(node.id, helper)
    this.markers.set(node.id, body)
    return camera
  }
}
