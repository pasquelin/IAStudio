import {
  mdiCircleHalfFull,
  mdiLightbulbGroupOutline,
  mdiLightbulbOn,
  mdiSpotlightBeam,
  mdiWeatherSunny,
} from '@mdi/js'
import type { LightDescriptor } from './scene-state'

export type LightType = {
  kind: LightDescriptor['kind']
  labelKey: string
  icon: string
  create: () => LightDescriptor
}

/** Defaults taken from `three.js/editor/js/Menubar.Add.js`. */
export const LIGHT_TYPES: readonly LightType[] = [
  {
    kind: 'ambient',
    labelKey: 'lights.ambient',
    icon: mdiLightbulbGroupOutline,
    create: () => ({ kind: 'ambient', color: '#222222', intensity: 1 }),
  },
  {
    kind: 'directional',
    labelKey: 'lights.directional',
    icon: mdiWeatherSunny,
    create: () => ({
      kind: 'directional',
      color: '#ffffff',
      intensity: 1,
      target: { x: 0, y: 0, z: 0 },
    }),
  },
  {
    kind: 'hemisphere',
    labelKey: 'lights.hemisphere',
    icon: mdiCircleHalfFull,
    create: () => ({
      kind: 'hemisphere',
      skyColor: '#00aaff',
      groundColor: '#ffaa00',
      intensity: 1,
    }),
  },
  {
    kind: 'point',
    labelKey: 'lights.point',
    icon: mdiLightbulbOn,
    create: () => ({ kind: 'point', color: '#ffffff', intensity: 1, distance: 0, decay: 2 }),
  },
  {
    kind: 'spot',
    labelKey: 'lights.spot',
    icon: mdiSpotlightBeam,
    create: () => ({
      kind: 'spot',
      color: '#ffffff',
      intensity: 1,
      distance: 0,
      angle: Math.PI * 0.1,
      penumbra: 0,
      decay: 2,
      target: { x: 0, y: 0, z: 0 },
    }),
  },
]

export function lightByKind(kind: string): LightType | null {
  return LIGHT_TYPES.find(light => light.kind === kind) ?? null
}
