import { createSkyBinding } from '../viewport/skyBinding'
import { reportFailure } from '@/services/diagnostics'
import { studioFonts } from '@/services/fonts'
import { createGltfSource } from './gltfSource'
import { createRefCache } from '../core/refCache'
import { createModelCache, disposeTree } from './modelCache'
import BvhWorker from './bvh.worker?worker'
import CsgWorker from '../csg/csg.worker?worker'
import SkinWorker from '../character/skinWeights.worker?worker'
import RetargetWorker from './retarget.worker?worker'
import { createRetarget } from './retarget'
import { createSkinWeights } from '../character/skinWeights'
import { createBvhBuilder } from './bvhBuilder'
import './bvhPatches'
import { createCsgEvaluator } from '../csg/csgEvaluator'
import { createTextureCache, loadTexture } from './textureCache'
import type { SceneRendererOptions } from './sceneRendererSupport1'
import { groupsFor } from './sceneRendererSupport2'
import { SceneRendererFrame } from './SceneRendererFrame'
export class SceneRendererConstruction extends SceneRendererFrame {
  constructor(options: SceneRendererOptions) {
    super()
    this.options = options
    if (options.relief) {
      this.relief.dispose()
      this.relief = options.relief
    }
    // Injected rather than built here, so a test can drive the whole model path without a
    // decoder: jsdom parses no GLB, exactly as it decodes no image.
    // One cache for the whole scene: ten meshes sharing a map upload it once.
    this.textureCache = createTextureCache(
      options.loadTexture ?? loadTexture,
      (assetId, error) => reportFailure('scene.texture', assetId, error),
      options.assetVersion,
      options.livePreview,
    )
    const sceneTask1Step1 = () => {
      this.gltf = options.loadModel
        ? {
            load: options.loadModel,
            // A test that hands one stub reads animations off it too, exactly as a `.glb` holding
            // both would.
            loadAnimation: options.loadAnimation ?? options.loadModel,
            dispose: () => {},
          }
        : createGltfSource(() => this.viewport.gl)
      this.modelCache = createModelCache(
        this.gltf.load,
        // The node stays in the outliner and draws nothing: a corrupt or compressed GLB is
        // otherwise indistinguishable from one that was never asked for.
        (assetId, error) => reportFailure('scene.model', assetId, error),
      )
      this.clipSources = createRefCache({
        load: url => this.gltf.loadAnimation(url),
        free: disposeTree,
        // Under a scope of its own: a failing animation must not swallow what a failing model says.
        onFailure: (url, error) => reportFailure('scene.animation', url, error),
      })
      const sceneTask1Step2 = () => {
        this.bvh = options.bvh ?? createBvhBuilder(() => new BvhWorker())
        this.instances = groupsFor(options)(
          this.viewport.scene,
          mesh =>
            // What the document dresses it in, never what a view left on it: an instance born during
            // a solid pass would wear the stand-in for good.
            this.paneMemory.materials.get(mesh) ?? mesh.material,
        )
        this.csg = createCsgEvaluator({
          spawn: () => new CsgWorker(),
          // The key as subject, so two solids that both fail are two lines rather than one: the node
          // keeps drawing its raw brushes, and a silent second failure would look like a success.
          onFailure: (key, error) => reportFailure('scene.carved', key, error),
        })
        const sceneTask1Step3 = () => {
          this.skin = options.skin ?? createSkinWeights(() => new SkinWorker())
          this.retarget = options.retarget ?? createRetarget(() => new RetargetWorker())
          // Before any file lands: a skeleton this project has already been taught is recognised on
          // the first model that carries it, in a document that never saw the correction.
          for (const profile of options.profiles ?? []) this.retarget.remember(profile)
          const sceneTask1Step4 = () => {
            this.sky = createSkyBinding(this.textureCache, () => this.paintBackground())
            // The studio's own by default: a face parsed for a caption in the image workspace is the
            // same object a text node extrudes, and half a megabyte of glyph tables is worth sharing.
            this.fonts = options.fonts ?? studioFonts
            // No lights here: they are nodes of the state now, so the viewport shows what the outliner
            // lists — and hiding one actually darkens the scene.
            this.viewport.camera.position.set(5, 5, 5)
            const sceneTask1Step5 = () => {
              this.viewport.camera.lookAt(0, 0, 0)
            }
            return sceneTask1Step5()
          }
          return sceneTask1Step4()
        }
        return sceneTask1Step3()
      }
      return sceneTask1Step2()
    }
    sceneTask1Step1()
  }
}
