import type { AiOverview, RoleRow } from './aiOverview'
import { aiRoleId } from './aiRole'
import { GIBI } from './localModel-fixtures'

/** One employment of the manager, unserved and with nothing offered, for a suite to override. */
export function roleRow(over: Partial<RoleRow> = {}): RoleRow {
  return {
    role: aiRoleId('image', 'txt2img'),
    provider: null,
    chosen: { app: null, project: null },
    candidates: [],
    clouds: [],
    ...over,
  }
}

/** What the manager publishes, on a machine that can hold anything. New callers use this. */
export function aiOverview(over: Partial<AiOverview> = {}): AiOverview {
  return {
    roles: [],
    machine: {
      physicalBytes: 96 * GIBI,
      availableBytes: 34 * GIBI,
      diskFreeBytes: 500 * GIBI,
      gpu: null,
      vram: null,
    },
    projectPath: null,
    installing: null,
    loading: null,
    loadFailure: null,
    installFailure: null,
    ollama: { ready: false, installed: false, names: [], progress: null, failed: false },
    engine: { known: false, missing: [], progress: null, failed: false },
    ...over,
  }
}
