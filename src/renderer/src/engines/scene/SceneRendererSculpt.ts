import ReliefSculptWorker from './reliefSculpt.worker?worker'
import { createReliefSculptor, type ReliefSculptor } from './reliefSculptor'
import { sculptEditOf, SCULPT_AMOUNT, STROKE_SPACING, strokeDabs } from './reliefStroke'
import { SceneRendererMaterials } from './SceneRendererMaterials'
import { terrainIdOfObject } from './reliefSurface'
import { createReliefBrushCursor } from './reliefBrushCursor'

export abstract class SceneRendererSculpt extends SceneRendererMaterials {
  protected abstract dropMarquee(): void
  protected abstract attachGizmo(): void
  protected sculptMode = false
  protected armedRelief: { terrainId: string; editId: string | null } | null = null
  protected sculptRadius = 2
  protected sculptFalloff = 0
  protected sculptAmount = SCULPT_AMOUNT
  protected readonly brushCursor = createReliefBrushCursor()
  protected sculptStroke: {
    last: { x: number; z: number }
    terrainId: string
    editId: string
  } | null = null
  private reliefSculptor: { terrainId: string; editId: string; sculptor: ReliefSculptor } | null =
    null

  async raiseReliefDisk(
    terrainId: string,
    editId: string,
    disk: { x: number; z: number; radius: number },
    amount: number,
    falloff = 0,
  ): Promise<boolean> {
    const source = this.relief.sculptSource(terrainId, editId)
    if (!source) return false
    const chunks = await this.sculptorFor(terrainId, editId).raiseDisk({
      ...source,
      disk,
      amount,
      falloff,
    })
    if (!chunks) return false
    this.options.onReliefSculpt?.(terrainId, editId, chunks)
    return true
  }

  private sculptorFor(terrainId: string, editId: string): ReliefSculptor {
    const held = this.reliefSculptor
    if (held?.terrainId === terrainId && held.editId === editId) return held.sculptor
    held?.sculptor.dispose()
    const sculptor =
      this.options.createReliefSculptor?.() ?? createReliefSculptor(() => new ReliefSculptWorker())
    this.reliefSculptor = { terrainId, editId, sculptor }
    return sculptor
  }

  protected noteReliefSculpt(): void {
    const held = this.reliefSculptor
    if (!held) return
    held.sculptor.note(this.relief.sculptSource(held.terrainId, held.editId)?.sculpt)
  }

  dispose(): void {
    this.brushCursor.dispose()
    this.reliefSculptor?.sculptor.dispose()
    this.reliefSculptor = null
    super.dispose()
  }

  setSculptMode(on: boolean): void {
    if (on === this.sculptMode) return
    if (!this.brushCursor.object.parent) this.viewport.scene.add(this.brushCursor.object)
    this.sculptMode = on
    if (on) {
      this.poseMode = false
      this.refreshSkeletons()
      this.gizmo?.detach()
      this.dropMarquee()
      return
    }
    this.endReliefStroke()
    this.attachGizmo()
  }

  setArmedRelief(armed: { terrainId: string; editId: string | null } | null): void {
    this.armedRelief = armed
  }

  setSculptBrush(radius: number, falloff: number, amount = SCULPT_AMOUNT): void {
    this.sculptRadius = radius
    this.sculptFalloff = falloff
    this.sculptAmount = amount
  }

  protected reliefHitAt(event: PointerEvent) {
    const ndc = this.viewport.pointerNdcOf(event)
    if (!ndc) return null
    this.pointer.set(ndc.x, ndc.y)
    this.raycaster.setFromCamera(this.pointer, this.cameraInHand())
    const hit = this.raycaster.intersectObject(this.relief.object, true)[0]
    if (!hit) return null
    const terrainId = terrainIdOfObject(hit.object)
    return terrainId ? { terrainId, x: hit.point.x, y: hit.point.y, z: hit.point.z } : null
  }

  protected aimReliefBrush(event: PointerEvent): void {
    const hit = this.reliefHitAt(event)
    this.brushCursor.set({
      x: hit?.x ?? 0,
      y: hit?.y ?? 0,
      z: hit?.z ?? 0,
      radius: this.sculptRadius,
      falloff: this.sculptFalloff,
      visible: hit !== null,
      color: this.startColor,
    })
  }

  protected beginReliefStrokeFrom(event: PointerEvent): boolean {
    const hit = this.reliefHitAt(event)
    const target = sculptEditOf(this.world.layers, this.armedRelief)
    if (!hit || !target || target.terrainId !== hit.terrainId) return false
    void this.startReliefStroke(hit.x, hit.z)
    return true
  }

  protected moveReliefStrokeFrom(event: PointerEvent): void {
    const hit = this.reliefHitAt(event)
    if (hit) void this.moveReliefStroke(hit.x, hit.z)
  }

  protected moveSculptPointer(event: PointerEvent): void {
    if (!this.sculptMode) return
    this.aimReliefBrush(event)
    if (!this.sculptStroke) return
    if ((event.buttons & 1) === 0) this.endReliefStroke()
    else this.moveReliefStrokeFrom(event)
  }

  async startReliefStroke(x: number, z: number): Promise<boolean> {
    const target = sculptEditOf(this.world.layers, this.armedRelief)
    if (!target) return false
    this.endReliefStroke()
    this.sculptStroke = { last: { x, z }, ...target }
    this.options.onReliefStrokeStart?.()
    return this.paintReliefDab(x, z)
  }

  async moveReliefStroke(x: number, z: number): Promise<void> {
    const stroke = this.sculptStroke
    if (!stroke) return
    for (const dab of strokeDabs(
      stroke.last,
      { x, z },
      Math.max(this.sculptRadius * STROKE_SPACING, 0.01),
    )) {
      stroke.last = dab
      await this.paintReliefDab(dab.x, dab.z)
    }
  }

  endReliefStroke(): void {
    if (!this.sculptStroke) return
    this.sculptStroke = null
    this.options.onReliefStrokeEnd?.()
  }

  private paintReliefDab(x: number, z: number): Promise<boolean> {
    const stroke = this.sculptStroke
    if (!stroke) return Promise.resolve(false)
    return this.raiseReliefDisk(
      stroke.terrainId,
      stroke.editId,
      { x, z, radius: this.sculptRadius },
      this.sculptAmount,
      this.sculptFalloff,
    )
  }
}
