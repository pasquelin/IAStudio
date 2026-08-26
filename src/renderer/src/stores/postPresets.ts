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
  renamePostPreset: (id: string, name: string) => void
  replacePostPreset: (id: string, stack: PostStack) => void
  forgetPostPreset: (id: string) => void
}

/**
 * The compositions this person has saved, kept between sessions and between projects.
 *
 * On this MACHINE rather than in the project folder: a look is a way of working, like a keyboard
 * shortcut — the same reason `useSkeletonProfiles` lives here. A look that belongs to one film
 * belongs to its document, and that is what the scene's own stack is for.
 *
 * The ones the studio ships are NOT here: they are code (`POST_PRESETS`), so they cannot be
 * edited, cannot be lost, and cannot drift between two installations.
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

      renamePostPreset: (id, name) =>
        set(state => ({
          saved: state.saved.map(preset => (preset.id === id ? { ...preset, name } : preset)),
        })),

      replacePostPreset: (id, stack) =>
        set(state => ({
          saved: state.saved.map(preset => (preset.id === id ? { ...preset, stack } : preset)),
        })),

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
