import {
  mdiCircleHalfFull,
  mdiLightbulbGroupOutline,
  mdiLightbulbOn,
  mdiSpotlightBeam,
  mdiWeatherSunny,
} from '@mdi/js'
import { LIGHT_ENTRIES, type LightDescriptor, type LightKind } from '@shared/domain/scene'

export type LightType = {
  kind: LightKind
  icon: string
  create: () => LightDescriptor
}

/**
 * What the shared table cannot carry. Defaults taken from
 * `three.js/editor/js/Menubar.Add.js`; `create` is narrowed per kind, so a builder handed the
 * wrong descriptor fails to compile.
 */
type LightBuilders = {
  [K in LightKind]: {
    icon: string
    create: () => Extract<LightDescriptor, { kind: K }>
  }
}

const LIGHT_BUILDERS: LightBuilders = {
  ambient: {
    icon: mdiLightbulbGroupOutline,
    create: () => ({ kind: 'ambient', color: '#222222', intensity: 1 }),
  },
  directional: {
    icon: mdiWeatherSunny,
    create: () => ({
      kind: 'directional',
      color: '#ffffff',
      intensity: 1,
      target: { x: 0, y: 0, z: 0 },
    }),
  },
  hemisphere: {
    icon: mdiCircleHalfFull,
    create: () => ({
      kind: 'hemisphere',
      skyColor: '#00aaff',
      groundColor: '#ffaa00',
      intensity: 1,
    }),
  },
  point: {
    icon: mdiLightbulbOn,
    create: () => ({ kind: 'point', color: '#ffffff', intensity: 1, distance: 0, decay: 2 }),
  },
  spot: {
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
}

export const LIGHT_TYPES: readonly LightType[] = LIGHT_ENTRIES.map(entry => ({
  kind: entry.kind,
  ...LIGHT_BUILDERS[entry.kind],
}))

const BY_KIND: ReadonlyMap<string, LightType> = new Map(
  LIGHT_TYPES.map(light => [light.kind, light]),
)

export function lightByKind(kind: string): LightType | null {
  return BY_KIND.get(kind) ?? null
}
