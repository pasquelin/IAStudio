import { type Object3D, PerspectiveCamera } from 'three'
import { type HelperVisibility, showsAid } from '@shared/domain/scene'
import { railOf } from './nodeRail'
import { railsInUse } from './cameraShots'
import { applyCamera, showPathHandles, showPathKnobs, showRailLine } from './threeSync'
import { type Us } from '@shared/domain/time'
import { type PreviewWatch } from './sceneView'
import './bvhPatches'
import { FRUSTUM_REACH } from './sceneRendererSupport1'
import { SceneRendererLifecycle } from './SceneRendererLifecycle'
export abstract class SceneRendererAnimation extends SceneRendererLifecycle {
  protected abstract applyPoses(): void
  protected abstract applyCameraShots(): void
  protected abstract redraw(): void
  /**
   * The working aids — a camera's frustum, a light's helper, a rail's knobs — shown on what is
   * SELECTED and on nothing else.
   *
   * A directional light draws a line clear across the scene and a frustum reaches its camera's
   * `far`: three lamps and two cameras already cross the whole viewport, which is what made a
   * scene unreadable. Selected, a frustum is still drawn SHORT — a thousand metres of outline
   * says nothing a couple of metres does not, and the projection it is read off is put straight
   * back, so what a film renders through is untouched.
   *
   * The price, and it is real: a light or a camera nobody has selected is no longer under the
   * pointer, so it is selected from the scene tree. A resting mark that stays clickable is what
   * would give that back.
   */
  protected showAidsForSelection(): void {
    const selected = new Set(this.selectedIds)
    // A window that plays the scene shows none of them, whatever the settings say — the same cut
    // `hideWorkshop` makes for a render, held for the life of the engine rather than one draw.
    const chrome = this.options.chrome !== false
    // An aid stands BESIDE its node rather than under it, so it inherits nothing: a lamp the
    // document hides, or one an isolation excludes, would go on drawing its line across the
    // scene without this. `selected` stays the default and the paragraph above says why.
    const shows = (visibility: HelperVisibility, id: string): boolean =>
      showsAid(visibility, selected, id) && (this.objects.get(id)?.visible ?? false)
    const showAidsForSelectionStep1 = () => {
      const showAidsForSelectionStep1 = () => {
        for (const [id, frustum] of this.frustums) {
          const node = this.applied.get(id)
          const camera = this.objects.get(id)
          if (node?.type !== 'camera' || !(camera instanceof PerspectiveCamera)) continue
          applyCamera(camera, node.camera, FRUSTUM_REACH)
          frustum.visible = chrome && shows(this.view.cameraHelpers, id)
        }
        for (const [id, helper] of this.helpers) {
          helper.visible = chrome && shows(this.view.lightHelpers, id)
        }
        // The body of a camera and the bulb of a lamp stand where the thing they draw stands, so a
        // game would be played looking at the marker somebody put there to find the light by.
        if (!chrome) for (const marker of this.markers.values()) marker.visible = false
        const showAidsForSelectionStep2 = () => {
          const rails = this.workedRailIds()
          for (const [id, node] of this.applied) {
            if (!railOf(node)) continue
            const rail = this.objects.get(id)
            if (!rail) continue
            // A rail node is nothing BUT its line, so hiding the chrome hides it whole. A band is a
            // surface of the scene: only its aids go.
            if (!chrome && node.type === 'path') rail.visible = false
            const worked = chrome && rails.has(id)
            showPathKnobs(rail, worked)
            if (node.type !== 'path') showRailLine(rail, worked)
            // The pair of the ANCHOR being worked on, and of no other — see `showPathHandles`. The
            // index whichever of the three is held: taking a tangent must not put its own pair away.
            const held = this.pickedPathPoint
            showPathHandles(rail, chrome && held?.nodeId === id ? held.index : null)
          }
        }
        return showAidsForSelectionStep2()
      }
      return showAidsForSelectionStep1()
    }
    return showAidsForSelectionStep1()
  }
  /**
   * The rails being worked on — `railsInUse` holds the rule, so this side and the selection
   * connector cannot come to disagree. Only the ids that ARE rails: everything selected goes in
   * there, and a camera is not a rail.
   */
  protected workedRailIds(): Set<string> {
    const rails = new Set<string>()
    for (const id of railsInUse(this.selectedIds, this.timeline.shots)) {
      if (railOf(this.applied.get(id))) rails.add(id)
    }
    return rails
  }
  /** The objects of those rails — what a click may reach a control point of. */
  protected workedRails(): Object3D[] {
    return [...this.workedRailIds()].flatMap(id => this.objects.get(id) ?? [])
  }
  /**
   * Where the head stands, in seconds. Session state, so it arrives by a call of its own rather
   * than inside the document — playing would otherwise put one undo entry per frame.
   */
  setPlayhead(time: Us): void {
    if (time === this.playhead) return
    this.playhead = time
    this.applyPoses()
    this.applyCameraShots()
    // The clips of every imported model follow the head too, which is what puts them on the band
    // rather than on real time — and what stops a render from writing a frozen character.
    this.animations.seek(time)
    this.redraw()
  }
  /**
   * Watches one block on a clock of its own, leaving the head where it stands. `null` gives the
   * model back to the head. A loop of its own rather than the head's: this is a look at a block,
   * not a move of the scene's clock.
   */
  setPreview(target: PreviewWatch | null): void {
    cancelAnimationFrame(this.previewFrame)
    this.previewFrame = 0
    this.heldPreview = target?.playing === false ? target : null
    if (!target) {
      this.animations.seek(this.playhead)
      this.redraw()
      return
    }
    // Held at one position: the pose is looked AT, so one frame answers it and no loop follows.
    if (!target.playing) {
      this.animations.preview(target.nodeId, target.clipId, target.at)
      this.redraw()
      return
    }
    const from = performance.now()
    const step = (now: number): void => {
      const length = this.animations.preview(
        target.nodeId,
        target.clipId,
        target.at + (now - from) / 1000,
      )
      this.redraw()
      // The grace stays on the WALL clock and not on the clip's: a run resumed from a scrub
      // starts past a second in, and would give up before the file it waits for had landed.
      if (length > 0 || now - from < 1000) this.previewFrame = requestAnimationFrame(step)
    }
    this.previewFrame = requestAnimationFrame(step)
  }
  /**
   * Puts a HELD pose back after the mixer was asked to apply the document.
   *
   * `SceneAnimations.apply` finishes by posing the model from the scene's head, and a held
   * preview has no loop of its own to write it again — editing the speed of the very block being
   * looked at would otherwise snap the character back to frame zero.
   */
  protected holdPreview(nodeId: string): void {
    if (this.heldPreview?.nodeId !== nodeId) return
    this.animations.preview(nodeId, this.heldPreview.clipId, this.heldPreview.at)
  }
}
