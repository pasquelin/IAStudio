import { type Mesh, type Object3D, SkinnedMesh, type Bone } from 'three'
import { isBoneObject, rigStateOf } from './rigState'
import {
  applyRig,
  positionsIn,
  reskinnableMeshesOf,
  restRig,
  unrig,
  wearsRig,
} from '../character/rigBuild'
import { createIkBinding, ikSpecsOf } from '../character/ik'
import { createBoneJoints } from './boneJoints'
import { createBoneShapes } from './boneShapes'
import type { SkinBinding } from '../character/skinVertices'
import type { Rig } from '@shared/domain/rig'
import './bvhPatches'
import { SceneRendererRig } from './SceneRendererRig'
export abstract class SceneRendererSkinning extends SceneRendererRig {
  protected abstract redraw(): void
  protected abstract accelerateOrReport(object: Object3D, subject: string): Promise<void>
  protected abstract paintPickedJoint(): void
  /**
   * Weights every mesh of a model against a rig, then binds them — what « make animatable » does.
   *
   * Public because the skeleton window is what asks for it now: a scene reads the skin its files
   * already carry, and only an editor puts a new one on. Off the UI thread and reporting as it
   * goes — half a million vertices against fifty-two bones is twenty-six million distances.
   */
  async skinModel(nodeId: string, rig: Rig): Promise<void> {
    const holder = this.objects.get(nodeId)
    if (!holder) return
    // Before the branches below, which all return early: the leash needs the rig either way.
    this.rigRests.set(nodeId, new Map(rig.bones.map(one => [one.name, one.rest])))
    const skinModelStep1 = async () => {
      const skinModelStep1 = async () => {
        // 🛑 A model already wearing these very bones is having its REST edited, not its rig
        // rebuilt: the weights are per vertex and unchanged, so putting the bones back where the
        // rig now rests and taking the inverses again is the whole of it. Re-weighing here would
        // cost half a million distances per joint dragged — and `skinnableMeshesOf` answers nothing
        // for a skinned model anyway, so this used to return in silence and leave the character
        // posed against a rest pose that no longer existed.
        if (wearsRig(holder, rig)) {
          restRig(holder, rig)
          this.bindIk(nodeId, holder, rig)
          this.redraw()
          return
        }
        // Captured once: `applyRig` is told which meshes these weights belong to rather than walking
        // the holder again after the awaits, when it may hold others. The SKINNED ones too — a rig
        // that changed shape is weighed again, and refusing them left « add hands » doing nothing.
        const meshes = reskinnableMeshesOf(holder)
        if (meshes.length === 0) return
        const skinModelStep2 = async () => {
          this.stopSkinning(nodeId)
          const stop = new AbortController()
          this.skinning.set(nodeId, stop)
          const skinModelStep3 = async () => {
            try {
              const bound: {
                mesh: Mesh
                binding: SkinBinding
              }[] = []
              for (const [index, mesh] of meshes.entries()) {
                const binding = await this.skin.bind(positionsIn(mesh, holder), rig, {
                  signal: stop.signal,
                  onProgress: progress =>
                    this.options.onRigProgress?.(nodeId, (index + progress) / meshes.length),
                })
                // Taken back, or the port let go — either way this model is no longer being skinned.
                if (!binding) return
                bound.push({ mesh, binding })
              }
              // The model may have been released while the weights were out.
              if (this.objects.get(nodeId) !== holder) return
              // The skeleton this one replaces, off first: left on, `wearsRig` would count both sets and
              // every later rest edit would be measured against bones nothing drives.
              unrig(holder)
              applyRig(holder, rig, bound)
              this.bindIk(nodeId, holder, rig)
              // Handed over rather than recomputed at save time: only this side ever weighs a mesh, and
              // the order is `skinnableMeshesOf`'s — the same order a `.glb` spells its primitives in.
              this.options.onSkinning?.(
                nodeId,
                bound.map((one, index) => ({
                  mesh: index,
                  primitive: 0,
                  joints: one.binding.skinIndex,
                  weights: one.binding.skinWeight,
                })),
              )
              // 🛑 `applyRig` CLONES each geometry, and a clone carries no `boundsTree`: rigging threw
              // away the tree built when the model landed.
              void this.accelerateOrReport(holder, nodeId)
              // The bones exist only now: the helper was bound before them, when the holder carried none,
              // and without this a locally rigged character has a skeleton nothing can show or pick.
              this.bindSkeleton(nodeId, holder, true)
              this.options.onRig?.(nodeId, rigStateOf(holder, this.animations.clipsOf(nodeId)))
              await this.precompile()
              this.redraw()
            } finally {
              this.skinning.delete(nodeId)
              // In every exit, cancellation included: what says "binding" is the progress being there,
              // so leaving it behind would hide both buttons of the inspector for good.
              this.options.onRigProgress?.(nodeId, 1)
            }
          }
          return skinModelStep3()
        }
        return skinModelStep2()
      }
      return skinModelStep1()
    }
    return skinModelStep1()
  }
  /**
   * The chains this model reaches with, if any — solved once a frame in `advance`.
   *
   * Built from the skeleton the rig just made rather than from the document: the solver holds
   * bone INDICES, so it only means anything against the bones actually bound.
   */
  protected bindIk(nodeId: string, holder: Object3D, rig: Rig): void {
    this.iks.delete(nodeId)
    if (!rig.ik?.length) return
    const skinned = holder.getObjectByProperty('isSkinnedMesh', true)
    if (!(skinned instanceof SkinnedMesh)) return
    const names = skinned.skeleton.bones.map(one => one.name)
    const binding = createIkBinding(skinned, ikSpecsOf(names, rig.ik))
    if (binding) this.iks.set(nodeId, binding)
  }
  /**
   * The programs the stage now needs, built BEFORE the frame that would need them.
   *
   * 🛑 A skinned mesh is a shader variant of its own, so binding a rig asks for four programs the
   * first frame after it: 292 ms on a warm shader cache, 8.4 SECONDS cold — and invisible to a
   * JavaScript profile, since a driver compiles in the GPU process. Measured 2026-09-02.
   */
  protected async precompile(): Promise<void> {
    const gl = this.viewport.gl
    if (!gl) return
    try {
      await gl.compileAsync(this.viewport.scene, this.viewport.camera)
    } catch {
      // Nothing to fall back to: the frame compiles what this could not, as it always did.
    }
  }
  /** Twenty-six million distances are not worth finishing for a model nobody will see again. */
  protected stopSkinning(nodeId: string): void {
    this.skinning.get(nodeId)?.abort()
    this.skinning.delete(nodeId)
  }
  /**
   * Joints and solids are built from the instance and hung beside the nodes, like the grid and
   * the trihedron — never inside the model, where the outliner would list them and a click could
   * pick them.
   */
  protected bindSkeleton(nodeId: string, root: Object3D, hasBones: boolean): void {
    this.unbindSkeleton(nodeId)
    if (!hasBones) return
    // Not three's `SkeletonHelper`: its lines showed through the solids, and a skeleton read as
    // half wireframe — measured on screen.
    const bones: Bone[] = []
    root.traverse(object => {
      if (isBoneObject(object)) bones.push(object)
    })
    // The joints mark where two bones MEET, which is the thing a click and a gizmo are aimed at.
    const joints = createBoneJoints(bones)
    joints.points.visible = this.skeletonsVisible()
    this.joints.set(nodeId, joints)
    this.viewport.scene.add(joints.points)
    // The bones as solids: a segment tells nothing about a bone's facing, so a rotation had no
    // landmark at all.
    const solids = createBoneShapes(bones)
    solids.mesh.visible = this.skeletonsVisible()
    this.boneSolids.set(nodeId, solids)
    this.viewport.scene.add(solids.mesh)
    // A skeleton bound after the pick — every reload of a model does this — would otherwise draw
    // its joints at rest while a panel names one of them.
    this.paintPickedJoint()
  }
  protected unbindSkeleton(nodeId: string): void {
    const solids = this.boneSolids.get(nodeId)
    if (solids) {
      solids.mesh.removeFromParent()
      solids.dispose()
      this.boneSolids.delete(nodeId)
    }
    const joints = this.joints.get(nodeId)
    if (joints) {
      joints.points.removeFromParent()
      joints.dispose()
      this.joints.delete(nodeId)
    }
  }
}
