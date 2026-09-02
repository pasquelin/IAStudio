import { DirectionalLight } from 'three'

/**
 * Ce que les bancs de PAGE se partagent. `benchSupport.ts` ne peut pas les porter : il importe
 * `node:fs`, donc il ne se charge que sous Node.
 */

export const round = (value: number): number => Math.round(value * 1000) / 1000

export const median = (values: number[]): number => {
  const sorted = [...values].sort((one, other) => one - other)
  return sorted.length === 0 ? 0 : (sorted[Math.floor(sorted.length / 2)] ?? 0)
}

export const mean = (values: number[]): number =>
  values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length

export const top = (values: number[]): number => (values.length === 0 ? 0 : Math.max(...values))

export const nextFrame = (): Promise<number> => new Promise(resolve => requestAnimationFrame(resolve))

export const pause = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms))

export type DrawTally = { calls: number; triangles: number; instances: number }

/**
 * Ce que le contexte a dessiné depuis le début de la page. Les INSTANCES en plus des appels : un
 * rejet de région se lit là avant de se lire ailleurs.
 *
 * Le module s'évalue une fois, donc le prototype n'est patché qu'une fois quels que soient ses
 * importeurs. Les QUATRE entrées de dessin sont comptées : `drawArrays` autant que les trois
 * autres, sans quoi une forme sans index ni instance — ce qu'un `loadModel` peut rendre — pèse
 * zéro et le banc lit un monde plus léger qu'il n'est.
 */
export const drawn: DrawTally = { calls: 0, triangles: 0, instances: 0 }

export const tally = (): DrawTally => ({ ...drawn })

export const since = (before: DrawTally): DrawTally => ({
  calls: drawn.calls - before.calls,
  triangles: Math.round(drawn.triangles - before.triangles),
  instances: drawn.instances - before.instances,
})

{
  const proto = WebGL2RenderingContext.prototype
  const TRIANGLES = WebGL2RenderingContext.TRIANGLES
  const drawElements = proto.drawElements
  proto.drawElements = function (mode, count, type, offset) {
    drawn.calls += 1
    if (mode === TRIANGLES) {
      drawn.triangles += count / 3
      drawn.instances += 1
    }
    return drawElements.call(this, mode, count, type, offset)
  }
  const drawElementsInstanced = proto.drawElementsInstanced
  proto.drawElementsInstanced = function (mode, count, type, offset, instances) {
    drawn.calls += 1
    if (mode === TRIANGLES) {
      drawn.triangles += (count / 3) * instances
      drawn.instances += instances
    }
    return drawElementsInstanced.call(this, mode, count, type, offset, instances)
  }
  const drawArrays = proto.drawArrays
  proto.drawArrays = function (mode, first, count) {
    drawn.calls += 1
    if (mode === TRIANGLES) {
      drawn.triangles += count / 3
      drawn.instances += 1
    }
    return drawArrays.call(this, mode, first, count)
  }
  const drawArraysInstanced = proto.drawArraysInstanced
  proto.drawArraysInstanced = function (mode, first, count, instances) {
    drawn.calls += 1
    if (mode === TRIANGLES) {
      drawn.triangles += (count / 3) * instances
      drawn.instances += instances
    }
    return drawArraysInstanced.call(this, mode, first, count, instances)
  }

  // 🛑 `BatchedMesh` ne passe par AUCUNE des quatre entrées ci-dessus : il dessine par
  // `WEBGL_multi_draw`. Sans ce patch le banc lisait « 0 instance, 0 appel » sur une scène qui
  // dessinait 27 lots — un résultat qui se lisait comme une victoire écrasante.
  type Counts = Int32Array | number[]
  type MultiDraw = {
    multiDrawElementsWEBGL: (mode: number, counts: Counts, countsOffset: number, type: number, offsets: Counts, offsetsOffset: number, drawcount: number) => void
    multiDrawArraysWEBGL: (mode: number, firsts: Counts, firstsOffset: number, counts: Counts, countsOffset: number, drawcount: number) => void
  }
  // `as` : les surcharges typées de `getExtension` refusent un nom quelconque.
  const getExtension = proto.getExtension as (this: WebGL2RenderingContext, name: string) => unknown
  const wrapped = new WeakSet<object>()
  const patched = function (this: WebGL2RenderingContext, name: string): unknown {
    const extension = getExtension.call(this, name)
    if (name === 'WEBGL_multi_draw' && extension && typeof extension === 'object' && !wrapped.has(extension)) {
      const multi = extension as MultiDraw
      const elements = multi.multiDrawElementsWEBGL
      multi.multiDrawElementsWEBGL = function (mode, counts, countsOffset, type, offsets, offsetsOffset, drawcount) {
        drawn.calls += 1
        drawn.instances += drawcount
        if (mode === TRIANGLES) {
          for (let at = 0; at < drawcount; at += 1) drawn.triangles += (counts[countsOffset + at] ?? 0) / 3
        }
        return elements.call(this, mode, counts, countsOffset, type, offsets, offsetsOffset, drawcount)
      }
      const arrays = multi.multiDrawArraysWEBGL
      multi.multiDrawArraysWEBGL = function (mode, firsts, firstsOffset, counts, countsOffset, drawcount) {
        drawn.calls += 1
        drawn.instances += drawcount
        if (mode === TRIANGLES) {
          for (let at = 0; at < drawcount; at += 1) drawn.triangles += (counts[countsOffset + at] ?? 0) / 3
        }
        return arrays.call(this, mode, firsts, firstsOffset, counts, countsOffset, drawcount)
      }
      wrapped.add(extension)
    }
    return extension
  }
  proto.getExtension = patched as typeof proto.getExtension
}

/** Le soleil de la scène : c'est sa carte que les bancs redessinent, et lui seul en porte une. */
export function sunOf(root: { traverse: (visit: (object: unknown) => void) => void }): DirectionalLight | null {
  let found: DirectionalLight | null = null
  root.traverse(object => {
    if (object instanceof DirectionalLight && object.castShadow) found = object
  })
  return found
}

/**
 * 🛑 À lire DANS LA FOULÉE du dessin, sans un `requestAnimationFrame` entre les deux : le contexte
 * n'a pas `preserveDrawingBuffer`, donc le tampon est vidé à la frame suivante et l'image revient
 * VIDE — trois captures blanches lues comme « 0 pixel différent », ombres allumées comme éteintes.
 */
export function pixelsOf(canvas: HTMLCanvasElement): ImageData {
  const flat = document.createElement('canvas')
  flat.width = canvas.width
  flat.height = canvas.height
  const paper = flat.getContext('2d')
  if (!paper) throw new Error('no 2d context')
  paper.drawImage(canvas, 0, 0)
  return paper.getImageData(0, 0, flat.width, flat.height)
}

/** La part de pixels qui diffèrent et de combien en moyenne : le juge de C3, sur son seuil. */
export function comparePixels(
  one: ImageData,
  other: ImageData,
  threshold: number,
): { share: number; meanGap: number } {
  let differing = 0
  let gap = 0
  for (let at = 0; at < one.data.length; at += 4) {
    const delta =
      Math.abs((one.data[at] ?? 0) - (other.data[at] ?? 0)) +
      Math.abs((one.data[at + 1] ?? 0) - (other.data[at + 1] ?? 0)) +
      Math.abs((one.data[at + 2] ?? 0) - (other.data[at + 2] ?? 0))
    if (delta > threshold) {
      differing += 1
      gap += delta / 3
    }
  }
  return {
    share: Math.round((differing / (one.data.length / 4)) * 10000) / 10000,
    meanGap: differing > 0 ? Math.round((gap / differing) * 10) / 10 : 0,
  }
}
