import { ShaderMaterial, type Texture } from 'three'
import {
  CROSS_CELLS,
  CROSS_COLUMNS,
  CROSS_ROWS,
  CUBE_FACES,
  FACE_BASES,
  type CubeFace,
  type FaceAxis,
  type SkyboxView,
} from '@shared/domain/skybox'
import { QUAD_VERTEX_SHADER } from '../gpu/passes/quad'

/**
 * The four ways of looking at one equirectangular picture, in one shader.
 *
 * Every mode but the immersive one answers the same question backwards: for this pixel of the
 * frame, which direction of the sphere is it, and where does that direction land in the source?
 * So the six faces are never rendered into a cube map at all — a face is a rectangle of screen
 * whose pixels each ask that question, and the export asks it too, one face at a time.
 *
 * The mapping is three's own, `equirectUv` in `common.glsl.js`, copied rather than approximated:
 * an `atan(z, x)` where three writes `atan(z, x)` is what keeps the unfolded cross showing the
 * same sky, at the same rotation, as the immersive view it sits beside.
 */

/** What the pass draws. `single` is the export's: one face, filling the frame. */
export type ProjectionLayout = Exclude<SkyboxView, 'immersive'> | 'single'

const LAYOUT_INDEX: Record<ProjectionLayout, number> = {
  equirect: 0,
  cross: 1,
  faces: 2,
  single: 3,
}

/** Columns and rows of the grid each layout lays its faces on. */
const FACES_COLUMNS = 3
const FACES_ROWS = 2

/** The shape each layout wants, so the frame letterboxes it rather than stretching it. */
export const LAYOUT_ASPECT: Record<ProjectionLayout, number> = {
  equirect: 2,
  cross: CROSS_COLUMNS / CROSS_ROWS,
  faces: FACES_COLUMNS / FACES_ROWS,
  single: 1,
}

/** The cross, written from the domain table so the two can never drift apart. */
const CROSS_BRANCHES = CUBE_FACES.map((face, index) => {
  const cell = CROSS_CELLS[face]
  return `if (column == ${cell.column} && row == ${cell.row}) return ${index}.0;`
}).join('\n    ')

const glslVec3 = (axis: FaceAxis): string =>
  `vec3(${axis.map(value => value.toFixed(1)).join(', ')})`

/**
 * The six directions, written from `FACE_BASES` for the same reason the cross is written from
 * `CROSS_CELLS`: which way a face points is the domain's to decide, and a second table spelled
 * in GLSL is one nothing checks. Reading it back is how the vertical came to be inverted here
 * for a whole afternoon — four of the six faces look plausible upside down.
 */
const FACE_BRANCHES = CUBE_FACES.map((face, index) => {
  const { forward, right, up } = FACE_BASES[face]
  const direction = `${glslVec3(forward)} + s * ${glslVec3(right)} + t * ${glslVec3(up)}`
  const last = index === CUBE_FACES.length - 1
  return last ? `return ${direction};` : `if (face < ${index}.5) return ${direction};`
}).join('\n  ')

const FRAGMENT_SHADER = /* glsl */ `
precision highp float;

uniform sampler2D uSource;
uniform float uLayout;
uniform float uFace;
/** How wide the frame is against how tall, so the picture is fitted rather than stretched. */
uniform float uFrameAspect;
uniform float uLayoutAspect;

varying vec2 vUv;

const float PI = 3.141592653589793;

/**
 * Which face sits in a cell of the cross, or −1 where the cross has a hole. Generated from
 * \`CROSS_CELLS\`: the layout is the domain's to decide, not this shader's.
 */
float crossFaceAt(int column, int row) {
  ${CROSS_BRANCHES}
  return -1.0;
}

/** The direction a point of a face looks at, in the axis order \`CUBE_FACES\` is written in. */
vec3 faceDirection(float face, vec2 uv) {
  // Both climb with the picture. \`PlaneGeometry\` writes \`v = 1 - iy / gridY\` against a vertex
  // at \`-y\`, so v is 1 at the TOP of the quad: a t that fell as v rose pointed the top of every
  // face at the ground, and left the four horizontal ones looking plausible upside down.
  float s = uv.x * 2.0 - 1.0;
  float t = uv.y * 2.0 - 1.0;

  ${FACE_BRANCHES}
}

/** three's own mapping, from \`common.glsl.js\`. Anything else turns the sky against itself. */
vec2 equirectUv(vec3 direction) {
  vec3 d = normalize(direction);
  float u = atan(d.z, d.x) / (2.0 * PI) + 0.5;
  float v = asin(clamp(d.y, -1.0, 1.0)) / PI + 0.5;
  return vec2(u, v);
}

/** The picture placed inside the frame, whole, on the axis the frame has to spare. */
vec2 fitted(vec2 uv) {
  float scale = uFrameAspect / uLayoutAspect;
  if (scale > 1.0) return vec2((uv.x - 0.5) * scale + 0.5, uv.y);
  return vec2(uv.x, (uv.y - 0.5) / scale + 0.5);
}

/** A cell of a grid: which one, and where inside it. */
vec2 cellUv(vec2 uv, float columns, float rows, out int column, out int row) {
  vec2 scaled = vec2(uv.x * columns, (1.0 - uv.y) * rows);
  column = int(floor(scaled.x));
  row = int(floor(scaled.y));
  return vec2(fract(scaled.x), 1.0 - fract(scaled.y));
}

void main() {
  vec2 uv = fitted(vUv);

  // Outside the fitted picture is the letterbox, and it is the viewport's own backdrop rather
  // than black: a frame painted black would read as part of the sky.
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) discard;

  if (uLayout < 0.5) {
    gl_FragColor = texture2D(uSource, uv);
  } else {
    float face = uFace;
    vec2 local = uv;

    if (uLayout < 1.5) {
      int column;
      int row;
      local = cellUv(uv, ${CROSS_COLUMNS}.0, ${CROSS_ROWS}.0, column, row);
      face = crossFaceAt(column, row);
      // The four holes of the cross: nothing to draw, and nothing to pretend either.
      if (face < 0.0) discard;
    } else if (uLayout < 2.5) {
      int column;
      int row;
      local = cellUv(uv, ${FACES_COLUMNS}.0, ${FACES_ROWS}.0, column, row);
      face = float(row * ${FACES_COLUMNS} + column);
    }

    gl_FragColor = texture2D(uSource, equirectUv(faceDirection(face, local)));
  }

  // The source is a half-float target holding linear light, and this pass ends on a screen or
  // in a PNG — neither of which reads linear. three writes these two conversions into every
  // material it compiles, but a ShaderMaterial only gets them where it asks: without them a
  // flat view is washed out beside the immersive one it is meant to be the same sky as.
  //
  // Reached on BOTH branches, which is why the equirect one no longer returns early.
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

type ProjectionUniforms = {
  uSource: { value: Texture | null }
  uLayout: { value: number }
  uFace: { value: number }
  uFrameAspect: { value: number }
  uLayoutAspect: { value: number }
}

export type ProjectionPass = {
  readonly material: ShaderMaterial
  readonly uniforms: ProjectionUniforms
  /** Which layout to draw, and — for `single` — which face of it. */
  setLayout: (layout: ProjectionLayout, face?: CubeFace) => void
  setSource: (texture: Texture | null) => void
  /** The frame it draws into, in pixels: what letterboxing needs to know. */
  setFrame: (width: number, height: number) => void
  dispose: () => void
}

export function createProjectionPass(): ProjectionPass {
  const uniforms: ProjectionUniforms = {
    uSource: { value: null },
    uLayout: { value: LAYOUT_INDEX.equirect },
    uFace: { value: 0 },
    uFrameAspect: { value: 1 },
    uLayoutAspect: { value: LAYOUT_ASPECT.equirect },
  }

  const material = new ShaderMaterial({
    vertexShader: QUAD_VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    uniforms,
    // Drawn over a scene that was already rendered — `onOverlay` runs with `autoClear` off, and
    // a quad that depth-tested against what is behind it would lose to the ground plane.
    depthTest: false,
    depthWrite: false,
  })

  return {
    material,
    uniforms,
    setLayout: (layout, face) => {
      uniforms.uLayout.value = LAYOUT_INDEX[layout]
      uniforms.uLayoutAspect.value = LAYOUT_ASPECT[layout]
      if (face) uniforms.uFace.value = CUBE_FACES.indexOf(face)
    },
    setSource: texture => {
      uniforms.uSource.value = texture
    },
    setFrame: (width, height) => {
      uniforms.uFrameAspect.value = height > 0 ? width / height : 1
    },
    dispose: () => material.dispose(),
  }
}
