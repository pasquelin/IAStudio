import type { Component } from '@shared/domain/component'
import type { SceneNode, SceneState } from './sceneState'
import type { SafeRuntimeSnapshot } from './safeRuntimeValidation'

const componentsOf = (state: SceneState, types: readonly Component['type'][]): unknown =>
  state.nodes.flatMap(node =>
    (node.components ?? [])
      .filter(component => types.includes(component.type))
      .map(component => ({ nodeId: node.id, component })),
  )

const pickingOf = (nodes: readonly SceneNode[]): unknown =>
  nodes.flatMap(node => [
    { sourceId: node.id, runtimeId: node.id },
    ...(node.type === 'mesh' && node.instances
      ? node.instances.map(instance => ({ sourceId: instance.sourceId, runtimeId: node.id }))
      : []),
  ])

export function sceneRuntimeSnapshot(state: SceneState): SafeRuntimeSnapshot {
  return {
    picking: pickingOf(state.nodes),
    animation: state.animation.tracks,
    timeline: {
      shots: state.animation.shots,
      events: state.animation.events ?? [],
      audio: state.animation.audio ?? [],
      video: state.animation.video ?? [],
      transitions: state.animation.transitions ?? [],
    },
    scripts: componentsOf(state, ['Script']),
    physics: componentsOf(state, [
      'Collider',
      'RigidBody',
      'CharacterController',
      'Vehicle',
      'Aircraft',
    ]),
    shadows: state.nodes.map(node => ({
      id: node.id,
      cast: node.castShadow,
      receive: node.receiveShadow,
    })),
    cameras: state.nodes.flatMap(node =>
      node.type === 'camera' ? [{ id: node.id, camera: node.camera }] : [],
    ),
    visibility: state.nodes.map(node => ({ id: node.id, visible: node.visible })),
    postProcessing: {
      world: state.world.post,
      cameras: state.nodes.flatMap(node =>
        node.type === 'camera' ? [{ id: node.id, post: node.camera.post ?? null }] : [],
      ),
    },
    transforms: state.nodes.map(node => ({
      id: node.id,
      transform: node.transform,
      instances: node.type === 'mesh' ? (node.instances ?? []) : [],
    })),
    duplication: state.nodes.flatMap(node => [
      node.id,
      ...(node.type === 'mesh' && node.instances
        ? node.instances.map(instance => instance.sourceId)
        : []),
    ]),
    undoRedo: state.nodes,
  }
}
