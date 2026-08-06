import { z } from 'zod'
import type { AssetQuery } from '@shared/domain/asset'
import type { Manifest } from '@shared/domain/project'

const manifest = z.object({
  version: z.number().int().min(1),
  name: z.string().min(1),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
})

/** A project folder is user territory: its manifest can be edited, truncated or replaced. */
export function parseManifest(value: unknown): Manifest {
  return manifest.parse(value)
}

// Absolute paths only: a relative one would resolve against the main process's working
// directory, which is wherever Electron happened to be launched from.
const projectPath = z.string().trim().min(1)

// Anything that would create a nested folder, or escape into one, is not a project name.
const projectName = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .refine(value => !/[/\\]/.test(value) && value !== '.' && value !== '..')

export function parseProjectPath(value: unknown): string {
  return projectPath.parse(value)
}

export function parseProjectName(value: unknown): string {
  return projectName.parse(value)
}

const assetQuery = z.object({
  type: z.enum(['image', 'video', 'audio', 'mesh', 'texture', 'skybox']).optional(),
  tags: z.array(z.string().min(1)).max(32).optional(),
  text: z.string().max(200).optional(),
  // Bounded here rather than in SQL: the renderer chooses the page size, and an unbounded
  // one would pull an entire well-stocked project across the IPC boundary in one message.
  limit: z.number().int().min(1).max(500).optional(),
  offset: z.number().int().min(0).optional(),
})

export function parseAssetQuery(value: unknown): AssetQuery {
  return assetQuery.parse(value)
}

const assetId = z.string().trim().min(1)

export function parseAssetId(value: unknown): string {
  return assetId.parse(value)
}
