// SPDX-License-Identifier: MIT

/**
 * 🛑 The registry's `defaults`, copied because this tree may take no VALUE from `@shared/`, and
 * held to them by `componentDefaults.test.ts`, which may. Written at each reading site instead,
 * four of thirteen had already drifted to zero.
 */
export const COMPONENT_DEFAULTS = {
  Path: { waypoints: '', speed: 2, mode: 'loop', orientToTangent: false },
  Follow: { target: '', speed: 3, stopDistance: 1.5, acceleration: 8 },
  Orbit: { target: '', radius: 5, speed: 45, height: 0 },
  LookAt: { target: '', turnSpeed: 0 },
  Patrol: { waypoints: '', speed: 2, waitSeconds: 1, mode: 'pingPong' },
  Spin: { axis: 'y', speed: 90 },
  SpringArm: {
    subject: '',
    camera: '',
    orientation: 'pointer',
    length: 4,
    height: 1.6,
    shoulder: 0,
    collision: true,
    probeRadius: 0.2,
    positionLag: 0.08,
    rotationLag: 0.05,
  },
  Collider: { fidelity: 'auto', friction: 0.6, restitution: 0 },
  RigidBody: { kind: 'dynamic', mass: 0, gravityScale: 1, lockRotation: false },
  CharacterController: {
    height: 1.8,
    radius: 0.3,
    jumpSpeed: 2.8,
    stepHeight: 0.5,
    slopeLimit: 45,
    snapDistance: 0.5,
  },
  Vehicle: {
    wheels: '',
    wheelRadius: 0.35,
    wheelWidth: 0.25,
    suspensionLength: 0.4,
    maxSteerAngle: 30,
    maxTorque: 500,
    drive: 'all',
  },
  Aircraft: { maxThrust: 12_000, wingArea: 16, stallAngle: 15, agility: 1, drag: 0.04 },
}
