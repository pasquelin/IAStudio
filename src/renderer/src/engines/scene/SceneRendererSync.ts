import { GridHelper, type Object3D } from 'three'
import { type ClipLane } from '@shared/domain/scene'
import { drawsNode, isolating, type Isolation } from './isolation'
import { type SceneNode } from './sceneState'
import { applyTransform } from './pivot'
import { applyShadowFlags } from './shadows'
import './bvhPatches'
import { keepsItsGroup } from './instancing'
import { GRID_SINKAGE, receivesShadow, pointsElsewhere } from './sceneRendererSupport2'
import { SceneRendererWorld } from './SceneRendererWorld'
export abstract class SceneRendererSync extends SceneRendererWorld {
  protected abstract release(id: string): void
  protected abstract build(node: SceneNode): Object3D
  protected abstract applyDisplay(object: Object3D): void
  protected abstract syncDescriptors(
    object: Object3D,
    previous: SceneNode | undefined,
    node: SceneNode,
  ): void
  protected abstract ensureBundled(nodeId: string, lanes: readonly ClipLane[]): void
  /** Pulls the studio palette off the canvas, so the viewport follows a theme change with it. */
  protected applyPalette(): void {
    // The centre axes take the muted token so they stand out from the grid rather than blend in.
    const axis = this.viewport.paletteToken('--color-muted')
    const line = this.viewport.paletteToken('--color-viewport-line')
    this.meshColor = this.viewport.paletteToken('--color-mesh')
    // `elevated` is what a marker is made of and `muted` what outlines it: the fill sits a step
    // off the viewport so the body reads as an object, and the edges carry the shape.
    this.markerColor = this.viewport.paletteToken('--color-elevated')
    this.markerEdge = this.viewport.paletteToken('--color-muted')
    this.negativeColor = this.viewport.paletteToken('--color-danger')
    // Apart from the anchors', which wear the mesh colour: two things one drags for different
    // reasons must not read as one.
    this.handleColor = this.viewport.paletteToken('--color-warning')
    this.startColor = this.viewport.paletteToken('--color-accent')
    this.paintBackground()
    if (this.grid) {
      this.viewport.scene.remove(this.grid)
      this.grid.dispose()
      // Cleared, not merely disposed: with the grid hidden the reference would survive, and the
      // next theme change would remove and dispose an object that is already gone.
      this.grid = null
    }
    if (!this.view.showGrid) return
    // Divisions equal to the extent, so one square is one metre whatever the size.
    const size = this.view.gridSize
    this.grid = new GridHelper(size, size, axis || undefined, line || undefined)
    // JUST under the zero plane, where a floor laid on it hides the grid rather than fighting it
    // for the same depth. Coplanar, the two flickered against each other square by square, and a
    // level that lays its own ground had the reference grid drawn across it.
    this.grid.position.y = -GRID_SINKAGE
    this.viewport.scene.add(this.grid)
  }
  /**
   * Skips a node whose object is identical to the one already applied. Commands rebuild only the
   * nodes they touch, so a selection — which rebuilds the state but not the array — costs nothing
   * instead of re-deriving a quaternion per object and re-uploading a helper per light.
   */
  protected syncNode(node: SceneNode): void {
    const previous = this.applied.get(node.id)
    if (previous === node) return
    // Past that guard something about this node really changed — its shape, or where it stands.
    // A selection changes no node, so it never reaches here: that walk was 12 % of the CPU of
    // one click on 8 000 nodes, measured 20/08.
    //
    // A node that only MOVED keeps its slot, so the slot is rewritten rather than the grouping
    // redone: 47.5 ms against 1.35 µs on 40 000 nodes. The counters are left alone too —
    // `keepsItsGroup` lets nothing they read through.
    if (previous && keepsItsGroup(previous, node)) this.movedNodes.add(node.id)
    else this.markContentChanged()
    const syncNodeStep1 = () => {
      const syncNodeStep1 = () => {
        this.placementChanged = true
        // A model is its file: pointing a node at another asset is a different object, not an edit
        // of this one. Released and rebuilt — patching it would leave the old file on screen and
        // its reference held for good, since `release` only ever knows the asset applied last.
        if (
          previous?.type === 'model' &&
          (node.type !== 'model' || pointsElsewhere(previous, node))
        ) {
          this.release(node.id)
        }
        this.applied.set(node.id, node)
        const syncNodeStep2 = () => {
          let object = this.objects.get(node.id)
          if (!object) {
            object = this.build(node)
            object.name = node.id
            this.objects.set(node.id, object)
            this.viewport.scene.add(object)
            // A node built while a display mode is on has to arrive in it, or it would be the one
            // object in the scene still drawn shaded.
            if (this.needsEdges()) this.applyDisplay(object)
          } else {
            // Only what an edit actually changed: rebuilding a geometry or recompiling a shader on
            // every move of the gizmo would cost the drag its frame rate.
            this.syncDescriptors(object, previous, node)
          }
          // Only when they moved: the flags are set per mesh, so a model of a few thousand of them
          // would be walked on every value an inspector drag emits. What a model brings later is
          // flagged where it arrives, in `buildModel`.
          if (
            previous?.castShadow !== node.castShadow ||
            previous.receiveShadow !== node.receiveShadow
          ) {
            applyShadowFlags(
              object,
              node.castShadow,
              receivesShadow(node),
              this.belongsToAnotherNode,
            )
          }
          const syncNodeStep3 = () => {
            // The shadows are NOT tuned here: their reach is read off what the scene occupies, and a
            // light synced before the set it lights would measure half a level. `apply` does it once
            // the last node is in place.
            // The clips of a model that is already on stage. Skipped for one still loading: `buildModel`
            // binds what the file brought the moment it lands, and applies this reference there.
            if (node.type === 'model' && this.animations.has(node.id)) {
              this.animations.apply(node.id, node.model.lanes ?? [])
              this.ensureBundled(node.id, node.model.lanes ?? [])
              this.holdPreview(node.id)
              this.redraw()
            }
            // A carried object holds a transform relative to the pivot, and the state holds one relative
            // to the scene: writing the second into the first mid-drag teleports it. The release puts
            // the truth back, so an undo during a gesture repaints everything but where things are.
            if (object.parent !== this.pivot) applyTransform(object, node.transform)
            object.visible = drawsNode(this.isolation, node.id, node.visible)
            const syncNodeStep4 = () => {
              const helper = this.helpers.get(node.id)
              if (helper) {
                helper.visible = object.visible
                // After the move, never before: the helper draws where the light was until it is told.
                helper.update()
              }
            }
            return syncNodeStep4()
          }
          return syncNodeStep3()
        }
        return syncNodeStep2()
      }
      return syncNodeStep1()
    }
    return syncNodeStep1()
  }
  /**
   * What the VIEWPORT hides, on top of what the document already does.
   *
   * A pass of its own because nothing about the nodes changed: `syncNode` skips a node it has
   * already applied, so an isolation pushed through the document would never reach the screen.
   */
  setIsolation(isolation: Isolation): void {
    this.isolation = isolation
    // Here rather than in `applyVisibility`: this is the one call of the three that CHANGES what
    // is visible, and `statsOf` skips a hidden mesh — see there.
    this.markContentChanged()
    this.applyVisibility()
    this.showAidsForSelection()
    this.refreshAids()
    this.regroupInstances()
    this.reportStats()
    this.redraw()
  }
  /**
   * Every node's `visible`, from what the document says and what the viewport hides over it.
   *
   * It does NOT mark the counters stale, though hiding a mesh moves them: two of its three
   * callers RESTORE a visibility they had just set aside — `asDocumented` and the workshop's
   * own — and marking here made every read under an isolation walk the whole scene again.
   */
  protected applyVisibility(): void {
    for (const [id, node] of this.applied) {
      const object = this.objects.get(id)
      if (object) object.visible = drawsNode(this.isolation, id, node.visible)
    }
  }
  /**
   * Runs something against the scene the DOCUMENT describes, with whatever the viewport is
   * hiding put back for the length of the call.
   *
   * `Object3D.visible` is the one flag three.js draws, picks, counts AND exports through, so an
   * isolation left in place reaches all four — a `.glb` written mid-isolation comes out amputated,
   * and `onlyVisible` makes that a silent success rather than an error. Isolating is a way of
   * LOOKING; anything that leaves the viewport has to see past it.
   */
  protected asDocumented<T>(run: () => T): T {
    if (!isolating(this.isolation)) return run()
    for (const [id, node] of this.applied) {
      const object = this.objects.get(id)
      if (object) object.visible = node.visible
    }
    try {
      return run()
    } finally {
      this.applyVisibility()
    }
  }
}
