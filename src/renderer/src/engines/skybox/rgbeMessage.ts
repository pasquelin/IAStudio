/**
 * What crosses to the RGBE worker and back. Its own module, as `skinMessage` is: the worker and
 * the window both read it, and a shape spelt on one side alone drifts on the first change.
 */

export type RgbeRequest = {
  /** The half-float readback, RGBA. TRANSFERRED — the window holds no copy after posting. */
  half: Uint16Array
  width: number
  height: number
}

export type RgbeResponse = { file: Uint8Array } | { failure: string }

export const isRgbeFailure = (answer: RgbeResponse): answer is { failure: string } =>
  'failure' in answer
