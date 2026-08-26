import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { readStack, type PostStack } from '@shared/domain/postProcessing'
import type { UserPostPreset } from '@shared/domain/postPresets'
import { isRecord } from '@shared/guards'
import { newId } from '@/helpers/ids'

export type PostPresetsState = {
  /** In the order they were saved. What the picker lists under the ones the studio ships. */
  saved: readonly UserPostPreset[]
  savePostPreset: (name: string, stack: PostStack) => string
  forgetPostPreset: (id: string) => void
}

/**
 * On this MACHINE rather than in the project folder — a look is a way of working, the same
 * reason `useSkeletonProfiles` lives here. The ones the studio ships are code (`POST_PRESETS`),
 * so they cannot be edited, lost, or drift between two installations.
 */
export const usePostPresets = create<PostPresetsState>()(
  persist(
    set => ({
      saved: [],

      savePostPreset: (name, stack) => {
        const id = newId()
        set(state => ({ saved: [...state.saved, { id, name, stack }] }))
        return id
      },

      forgetPostPreset: id =>
        set(state => ({ saved: state.saved.filter(preset => preset.id !== id) })),
    }),
    {
      name: 'ia-studio:post-presets',
      // Read back through the reader rather than trusted: this is a file on disk, and a stack
      // whose effects are not effects would be handed straight to the composer.
      merge: (persisted, current) => ({ ...current, saved: readPresets(persisted) }),
    },
  ),
)

function readPresets(persisted: unknown): UserPostPreset[] {
  if (!isRecord(persisted) || !Array.isArray(persisted.saved)) return []

  return persisted.saved.flatMap((one: unknown): UserPostPreset[] => {
    if (!isRecord(one) || typeof one.id !== 'string' || typeof one.name !== 'string') return []
    return [{ id: one.id, name: one.name, stack: readStack(one.stack, newId) }]
  })
}
