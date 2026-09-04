import ReliefSculptWorker from './reliefSculpt.worker?worker'
import { createReliefSculptor, type ReliefSculptor } from './reliefSculptor'
import {
  sculptEditOf,
  SCULPT_AMOUNT,
  STROKE_SPACING,
  strokeDabs,
  type SculptTool,
} from './reliefStroke'
import { SceneRendererMaterials } from './SceneRendererMaterials'
import { terrainIdOfObject } from './reliefSurface'
import { createReliefBrushCursor } from './reliefBrushCursor'
import { combinedAt, texelStep } from '@shared/domain/relief'
import { clamp } from '@shared/numeric'
import { emptyGroundPaint, paintGroundDisk, type GroundPaint } from '@shared/domain/groundPaint'
import { SCATTER_MASK_TEXELS, type WorldLayer } from '@shared/domain/scene'

type ArmedWorld =
  { kind: 'relief'; id: string; editId: string | null } | { kind: 'scatter'; id: string } | null

export abstract class SceneRendererSculpt extends SceneRendererMaterials {
  protected abstract dropMarquee(): void
  protected abstract attachGizmo(): void
  protected sculptMode = false
  protected sculptTool: SculptTool = 'raise'
  protected armedRelief: { terrainId: string; editId: string | null } | null = null
  protected armedWorld: ArmedWorld = null
  protected sculptRadius = 2
  protected sculptFalloff = 0
  protected sculptAmount = SCULPT_AMOUNT
  protected readonly brushCursor = createReliefBrushCursor()
  protected sculptStroke: {
    last: { x: number; z: number }
    terrainId: string
    editId: string
    target?: number
  } | null = null
  private reliefSculptor: {
    terrainId: string
    editId: string
    paint: boolean
    sculptor: ReliefSculptor
  } | null = null
  private readonly groundPaints = new Map<string, GroundPaint>()

  async raiseReliefDisk(
    terrainId: string,
    editId: string,
    disk: { x: number; z: number; radius: number },
    amount: number,
    falloff = 0,
    kind: SculptTool = 'raise',
    target?: number,
  ): Promise<boolean> {
    if (kind === 'paintGround') return false
    const source = this.relief.sculptSource(terrainId, editId)
    if (!source) return false
    const operation = kind === 'raise' ? 'raiseDisk' : kind === 'paint' ? 'paintMask' : kind
    const chunks = await this.sculptorFor(terrainId, editId, kind === 'paint').raiseDisk({
      ...source,
      sculpt: kind === 'paint' ? source.maskWeights : source.sculpt,
      disk,
      amount,
      falloff,
      kind: operation,
      target,
    })
    if (!chunks) return false
    if (kind === 'paint') this.options.onReliefMask?.(terrainId, editId, chunks)
    else this.options.onReliefSculpt?.(terrainId, editId, chunks)
    return true
  }

  private sculptorFor(terrainId: string, editId: string, paint = false): ReliefSculptor {
    const held = this.reliefSculptor
    if (held && held.terrainId === terrainId && held.editId === editId && held.paint === paint) {
      return held.sculptor
    }
    held?.sculptor.dispose()
    const sculptor =
      this.options.createReliefSculptor?.() ?? createReliefSculptor(() => new ReliefSculptWorker())
    this.reliefSculptor = { terrainId, editId, paint, sculptor }
    return sculptor
  }

  protected noteReliefSculpt(): void {
    const held = this.reliefSculptor
    if (!held) return
    const source = this.relief.sculptSource(held.terrainId, held.editId)
    held.sculptor.note(held.paint ? source?.maskWeights : source?.sculpt)
  }

  dispose(): void {
    // Before the cursor goes: a stroke still open closes the document's history gesture, and
    // nothing else would — closing a tab mid-dab left every later edit in that same undo step.
    this.endReliefStroke()
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
    this.brushCursor.set({
      x: 0,
      y: 0,
      z: 0,
      radius: this.sculptRadius,
      falloff: this.sculptFalloff,
      visible: false,
    })
    this.attachGizmo()
  }

  setArmedRelief(armed: { terrainId: string; editId: string | null } | null): void {
    this.armedRelief = armed
    this.armedWorld = armed ? { kind: 'relief', id: armed.terrainId, editId: armed.editId } : null
  }

  setArmedWorld(armed: ArmedWorld): void {
    this.armedWorld = armed
    this.armedRelief =
      armed?.kind === 'relief' ? { terrainId: armed.id, editId: armed.editId } : null
  }

  setSculptBrush(radius: number, falloff: number, amount = SCULPT_AMOUNT): void {
    this.sculptRadius = radius
    this.sculptFalloff = falloff
    this.sculptAmount = amount
  }

  setSculptTool(tool: SculptTool): void {
    this.sculptTool = tool
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
    if (hit && this.armedWorld?.kind === 'scatter' && this.sculptTool === 'paintGround') {
      void this.startGroundStroke(hit.terrainId, hit.x, hit.z)
      return true
    }
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
    this.sculptStroke = {
      last: { x, z },
      terrainId: target.terrainId,
      editId: target.editId,
      target: this.sculptTool === 'flatten' ? this.flattenTargetAt(target, x, z) : undefined,
    }
    this.options.onReliefStrokeStart?.()
    return this.paintReliefDab(x, z)
  }

  private async startGroundStroke(terrainId: string, x: number, z: number): Promise<boolean> {
    this.endReliefStroke()
    this.sculptStroke = { last: { x, z }, terrainId, editId: '' }
    this.options.onReliefStrokeStart?.()
    return this.paintGroundDisk(terrainId, x, z)
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
    if (this.sculptTool === 'paintGround') {
      return this.paintGroundDisk(stroke.terrainId, x, z)
    }
    return this.raiseReliefDisk(
      stroke.terrainId,
      stroke.editId,
      { x, z, radius: this.sculptRadius },
      this.sculptAmount,
      this.sculptFalloff,
      this.sculptTool,
      stroke.target,
    )
  }

  async paintGroundDisk(terrainId: string, x: number, z: number): Promise<boolean> {
    const terrain = this.world.layers.find(
      (layer): layer is Extract<WorldLayer, { kind: 'relief' }> =>
        layer.kind === 'relief' && layer.id === terrainId,
    )
    if (!terrain || terrain.locked.sculpt) return false
    const loaded = this.groundPaints.has(terrainId)
      ? this.groundPaints.get(terrainId)
      : await this.options.loadGroundPaint?.(terrainId)
    const before = loaded ?? emptyGroundPaint(SCATTER_MASK_TEXELS, SCATTER_MASK_TEXELS)
    const paint = paintGroundDisk(
      before,
      { origin: terrain.origin, size: terrain.size, elevation: terrain.elevation },
      {
        x,
        z,
        radius: this.sculptRadius,
        amount: this.sculptAmount,
        falloff: this.sculptFalloff,
        color: [32, 192, 64, 255],
      },
    )
    this.groundPaints.set(terrainId, paint)
    this.options.onGroundPaint?.(terrainId, paint)
    return true
  }

  private flattenTargetAt(
    target: { terrainId: string; editId: string },
    x: number,
    z: number,
  ): number | undefined {
    const source = this.relief.sculptSource(target.terrainId, target.editId)
    if (!source) return undefined
    const step = texelStep(source.extent.size, source.samples)
    const sx = clamp(Math.round((x - source.extent.origin.x) / step.x), 0, source.samples.width - 1)
    const sz = clamp(
      Math.round((z - source.extent.origin.z) / step.z),
      0,
      source.samples.height - 1,
    )
    return combinedAt(
      source.samples,
      source.grain,
      [
        ...source.overlays,
        {
          enabled: true,
          alpha: source.overlayAlpha,
          sculpt: source.sculpt,
          mask: source.overlayMask,
        },
      ],
      sx,
      sz,
      source.extent,
    )
  }
}
