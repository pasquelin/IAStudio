import {
  CanvasTexture,
  Color,
  MeshMatcapMaterial,
  MeshStandardMaterial,
  type Material,
  type Texture,
} from 'three'
import { MeshBasicMaterial } from 'three'
import type { Substitute } from './scene-view'

/**
 * The stand-in materials a view paints with, built once and shared by every mesh.
 *
 * One object rather than three fields on the renderer: they are made together, freed together,
 * and a mesh has to be able to ask "is this one of yours?" — which is how the real material is
 * told apart from the one a previous pass left behind.
 */
export type PaneMaterials = {
  materialFor: (substitute: Substitute, density: number) => Material | null
  /** Whether a material is one of these, i.e. something a pass put there rather than the model. */
  owns: (material: Material | Material[]) => boolean
  dispose: () => void
}

/** Where the density ramp tops out: triangles per unit of enclosing surface. */
const DENSE = 400

/** The clay of the solid view, and the colour a matcap falls back to when no canvas draws one. */
const CLAY = 0.72

/**
 * Injected rather than called: a canvas hands back no 2D context under a test runner, so the
 * branch that HAS a matcap would be written, shipped and never once executed. The default is the
 * real thing; a test passes its own.
 */
export function createPaneMaterials(
  drawMatcap: () => Texture | null = studioMatcap,
): PaneMaterials {
  const solid = new MeshStandardMaterial({
    color: new Color(CLAY, CLAY, CLAY),
    roughness: 0.75,
    metalness: 0,
  })

  // Drawn by nobody: what a quad wireframe shows is its edge overlay, and the surfaces under it
  // would fill in every hole the reading depends on.
  const hidden = new MeshBasicMaterial({ visible: false })

  const matcapTexture = drawMatcap()
  const matcap = new MeshMatcapMaterial(
    // No texture means no shading at all from this material, so it falls back to the clay tint
    // rather than to the black a bare matcap draws.
    matcapTexture ? { matcap: matcapTexture } : { color: new Color(CLAY, CLAY, CLAY) },
  )

  /** One material per density step, so a scene of fifty objects builds at most eleven. */
  const ramp = new Map<number, MeshStandardMaterial>()
  const mine = new Set<Material>([solid, matcap, hidden])

  const densityMaterial = (density: number): Material => {
    const step = Math.min(10, Math.round((Math.min(density, DENSE) / DENSE) * 10))
    const held = ramp.get(step)
    if (held) return held

    // Green through to red, the reading every profiler uses: what is red is what to look at.
    const material = new MeshStandardMaterial({
      color: new Color().setHSL((1 - step / 10) * 0.33, 0.85, 0.45),
      roughness: 0.8,
      metalness: 0,
    })
    ramp.set(step, material)
    mine.add(material)
    return material
  }

  return {
    materialFor: (substitute, density) => {
      if (substitute === 'solid') return solid
      if (substitute === 'matcap') return matcap
      if (substitute === 'density') return densityMaterial(density)
      if (substitute === 'hidden') return hidden
      return null
    },
    owns: material =>
      Array.isArray(material) ? material.some(one => mine.has(one)) : mine.has(material),
    dispose: () => {
      solid.dispose()
      matcap.dispose()
      hidden.dispose()
      matcapTexture?.dispose()
      for (const material of ramp.values()) material.dispose()
      ramp.clear()
      mine.clear()
    },
  }
}

/** How wide the generated matcap is. Small on purpose: it is a gradient, not a photograph. */
const MATCAP_SIZE = 128

/**
 * A matcap drawn rather than shipped.
 *
 * A matcap is a sphere lit once and photographed; a radial gradient offset up and left is the
 * cheap version of exactly that, and it costs no asset in the bundle. `null` under a runner,
 * where a canvas hands back no 2D context.
 */
function studioMatcap(): Texture | null {
  const canvas = document.createElement('canvas')
  canvas.width = MATCAP_SIZE
  canvas.height = MATCAP_SIZE

  const context = canvas.getContext('2d')
  if (!context) return null

  const light = MATCAP_SIZE * 0.35
  const gradient = context.createRadialGradient(
    light,
    light,
    MATCAP_SIZE * 0.05,
    MATCAP_SIZE / 2,
    MATCAP_SIZE / 2,
    MATCAP_SIZE * 0.75,
  )
  gradient.addColorStop(0, '#ffffff')
  gradient.addColorStop(0.45, '#b9bec6')
  gradient.addColorStop(1, '#2a2d33')

  context.fillStyle = gradient
  context.fillRect(0, 0, MATCAP_SIZE, MATCAP_SIZE)

  return new CanvasTexture(canvas)
}
