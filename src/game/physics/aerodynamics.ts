// SPDX-License-Identifier: MIT

import type { Vector3 } from '@shared/domain/transform'
import { clamp, DEGREES } from '../numeric'
import { dot, type Axes } from './quaternion'

/** What an `Aircraft` component says of its airframe, in the units an author reads. */
export type Airframe = {
  /** Newtons at full throttle. */
  maxThrust: number
  /** Square metres of wing. */
  wingArea: number
  /** Degrees: past it the wing lets go, and lift falls away to nothing at twice the angle. */
  stallAngle: number
  /** How hard the control surfaces bite, one being a light plane. */
  agility: number
  /** The drag coefficient at zero lift. */
  drag: number
}

/** What the pilot holds, each between −1 and 1 — throttle between 0 and 1. */
export type Stick = { throttle: number; pitch: number; roll: number; yaw: number }

export type Aero = { force: Vector3; torque: Vector3 }

const AIR_DENSITY = 1.225

/** The lift a wing gives level, and how much more per radian of attack — a cambered wing. */
const LIFT_AT_LEVEL = 0.3
const LIFT_PER_RADIAN = 5

/** How much of the lift comes back as drag: what a wing pays for lifting. */
const INDUCED_DRAG = 0.05

/** Torque per unit of dynamic pressure, wing and lever, for a full stick — and for a radian off. */
const CONTROL = 0.12
const STABILITY = 0.4
const DAMPING = 0.35

/**
 * The forces on an airframe moving through still air, written into `into`. 🛑 The torques only
 * bite with air over the surfaces: a plane standing still answers no stick, which is what a
 * runway is for.
 */
export function aeroForces(
  frame: Airframe,
  stick: Stick,
  axes: Axes,
  linear: Vector3,
  angular: Vector3,
  into: Aero,
): Aero {
  const { forward, right, up } = axes
  const speed = Math.hypot(linear.x, linear.y, linear.z)
  const thrust = frame.maxThrust * clamp(stick.throttle, 0, 1)
  into.force.x = forward.x * thrust
  into.force.y = forward.y * thrust
  into.force.z = forward.z * thrust
  into.torque.x = 0
  into.torque.y = 0
  into.torque.z = 0
  if (speed === 0) return into

  const ahead = dot(linear, forward)
  const above = dot(linear, up)
  const aside = dot(linear, right)
  // The wing's angle to the air: positive with the nose above where the plane is going.
  const attack = Math.atan2(-above, ahead)
  const slip = Math.atan2(aside, ahead)
  const pressure = 0.5 * AIR_DENSITY * speed * speed * frame.wingArea
  const lift = liftCoefficient(attack, frame.stallAngle * DEGREES)

  // Lift stands across the airflow, in the plane of the wing's up: the up with its along-flow
  // part taken out.
  const alongX = linear.x / speed
  const alongY = linear.y / speed
  const alongZ = linear.z / speed
  const upAlong = up.x * alongX + up.y * alongY + up.z * alongZ
  const acrossX = up.x - upAlong * alongX
  const acrossY = up.y - upAlong * alongY
  const acrossZ = up.z - upAlong * alongZ
  const across = Math.hypot(acrossX, acrossY, acrossZ)
  const lifting = across === 0 ? 0 : (pressure * lift) / across
  const dragging = pressure * (frame.drag + INDUCED_DRAG * lift * lift)
  into.force.x += acrossX * lifting - alongX * dragging
  into.force.y += acrossY * lifting - alongY * dragging
  into.force.z += acrossZ * lifting - alongZ * dragging

  // A lever the size of the wing, so a torque scales with the airframe like the forces do.
  const lever = pressure * Math.sqrt(frame.wingArea)
  const pitch = CONTROL * frame.agility * clamp(stick.pitch, -1, 1) - STABILITY * attack
  const roll = CONTROL * frame.agility * clamp(stick.roll, -1, 1)
  // A turn to the right is a turn about −up: rotating about +Y carries the nose to −X.
  const yaw = -(CONTROL * frame.agility * clamp(stick.yaw, -1, 1)) - STABILITY * slip
  into.torque.x = lever * (pitch * right.x + roll * forward.x + yaw * up.x - DAMPING * angular.x)
  into.torque.y = lever * (pitch * right.y + roll * forward.y + yaw * up.y - DAMPING * angular.y)
  into.torque.z = lever * (pitch * right.z + roll * forward.z + yaw * up.z - DAMPING * angular.z)
  return into
}

/**
 * The lift a wing gives at that angle: linear up to the stall, then falling away to nothing at
 * twice the stall angle, the sign kept — a wing flying upside down lifts the wrong way.
 */
export function liftCoefficient(attack: number, stall: number): number {
  const most = LIFT_AT_LEVEL + LIFT_PER_RADIAN * stall
  const linear = clamp(LIFT_AT_LEVEL + LIFT_PER_RADIAN * attack, -most, most)
  const past = Math.abs(attack) - stall
  if (past <= 0) return linear
  return linear * clamp(1 - past / stall, 0, 1)
}
