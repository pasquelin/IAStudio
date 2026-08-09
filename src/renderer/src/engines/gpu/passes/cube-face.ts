import { ShaderMaterial, Vector3, type Texture } from 'three'
import { FACE_BASES, type CubeFace } from '@shared/domain/skybox'
import { QUAD_VERTEX_SHADER } from './quad'

/**
 * One face of a cube, sampled out of an equirectangular picture. The flat views draw six of
 * these into the frame; an export draws the same six into full-size targets. A face is a face —
 * only where it lands and how big it is ever change.
 *
 * The basis arrives as three vectors rather than as a face name, so the shader holds no table
 * and branches on nothing. Which axes a face has is a fact of `shared/domain/skybox`, asserted
 * there against the cross product; a copy of it in GLSL would be a second truth nothing checks.
 */

const FRAGMENT_SHADER = /* glsl */ `
precision highp float;

uniform sampler2D uSource;
uniform vec3 uForward;
uniform vec3 uRight;
uniform vec3 uUp;

varying vec2 vUv;

const float RECIPROCAL_PI = 0.3183098861837907;
const float RECIPROCAL_PI2 = 0.15915494309189535;

void main() {
  // A cube face spans 90°, so its half-extent equals the distance to it: the centre direction
  // doubles as the plane, and no field of view has to be spelled out.
  vec2 offset = vUv * 2.0 - 1.0;
  vec3 direction = normalize(uForward + offset.x * uRight + offset.y * uUp);

  // three's own equirectUv, spelled out. Sampling the picture by any other convention would
  // put the horizon of a flat view a quarter turn away from the one the 360 view shows.
  vec2 uv = vec2(
    atan(direction.z, direction.x) * RECIPROCAL_PI2 + 0.5,
    asin(clamp(direction.y, -1.0, 1.0)) * RECIPROCAL_PI + 0.5
  );

  gl_FragColor = vec4(texture2D(uSource, uv).rgb, 1.0);
}
`

/** Held by name rather than reached through `material.uniforms`, where a typo is a silent no-op. */
type CubeFaceUniforms = {
  uSource: { value: Texture | null }
  uForward: { value: Vector3 }
  uRight: { value: Vector3 }
  uUp: { value: Vector3 }
}

export type CubeFacePass = {
  readonly material: ShaderMaterial
  readonly uniforms: CubeFaceUniforms
  setSource: (texture: Texture | null) => void
  /** Aims the pass at one face. Six calls and six draws make a cube map. */
  setFace: (face: CubeFace) => void
  dispose: () => void
}

export function createCubeFacePass(): CubeFacePass {
  const uniforms: CubeFaceUniforms = {
    uSource: { value: null },
    uForward: { value: new Vector3() },
    uRight: { value: new Vector3() },
    uUp: { value: new Vector3() },
  }

  const material = new ShaderMaterial({
    vertexShader: QUAD_VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    uniforms,
  })

  return {
    material,
    uniforms,

    setSource: texture => {
      uniforms.uSource.value = texture
    },

    // Written into the vectors already there rather than replaced: six faces a frame, and a new
    // `Vector3` per face is six allocations on a path that runs on every resize.
    setFace: face => {
      const basis = FACE_BASES[face]
      uniforms.uForward.value.fromArray(basis.forward)
      uniforms.uRight.value.fromArray(basis.right)
      uniforms.uUp.value.fromArray(basis.up)
    },

    dispose: () => material.dispose(),
  }
}
