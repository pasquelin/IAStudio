// SPDX-License-Identifier: MIT

/**
 * Every hook a script may write, in the order a step drives them.
 *
 * 🛑 The one list. `studio.d.ts` is what an editor proposes, `kernel.ts` is what dispatches, and
 * `ScriptHook` is what a fixed step names — `studioApi.test.ts` holds the three together.
 */
export const STUDIO_HOOKS: readonly string[] = [
  'onCreate',
  'onStart',
  'onUpdate',
  'onLateUpdate',
  'onDestroy',
  'onMessage',
  'onCollision',
  'onTriggerEnter',
  'onTriggerExit',
]
