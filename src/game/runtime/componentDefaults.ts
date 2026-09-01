// SPDX-License-Identifier: MIT

/**
 * 🛑 The registry's `defaults`, copied because this tree may take no VALUE from `@shared/`, and
 * held to them by `componentDefaults.test.ts`, which may. Written at each reading site instead,
 * four of thirteen had already drifted to zero.
 */
export const COMPONENT_DEFAULTS = {
  Collider: { fidelity: 'auto', friction: 0.6, restitution: 0 },
  RigidBody: { kind: 'dynamic', mass: 0, gravityScale: 1, lockRotation: false },
  CharacterController: {
    height: 1.8,
    radius: 0.3,
    jumpSpeed: 5,
    stepHeight: 0.5,
    slopeLimit: 45,
    snapDistance: 0.5,
  },
}
