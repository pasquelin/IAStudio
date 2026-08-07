import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import type { SceneAddRequest, Unsubscribe } from '@shared/ipc'
import { createDefaultScene } from '@/engines/scene/default-scene'
import { installFakeBridge } from '@/services/fake-bridge'
import { useDocuments } from '@/stores/documents'
import { sceneOf, useScenes } from '@/stores/scenes'
import { useNativeMenu } from './useNativeMenu'

/** Holds the listener the hook registers, so the test can play the native menu. */
function captureSceneAdd(): { emit: (request: SceneAddRequest) => void } {
  let listener: ((request: SceneAddRequest) => void) | null = null
  installFakeBridge({
    menu: {
      onSceneAdd: (callback: (request: SceneAddRequest) => void): Unsubscribe => {
        listener = callback
        return () => {
          listener = null
        }
      },
    },
  })
  return { emit: request => listener?.(request) }
}

function meshes() {
  return sceneOf(useScenes.getState(), 'doc-1').nodes.filter(node => node.type === 'mesh')
}

beforeEach(() => {
  useScenes.setState({ states: { 'doc-1': createDefaultScene() }, histories: {} })
  useDocuments.setState({ activeId: 'doc-1' })
})

describe('useNativeMenu', () => {
  it('adds the node the native menu asked for', () => {
    const menu = captureSceneAdd()
    renderHook(() => useNativeMenu())

    menu.emit({ kind: 'box' })

    expect(meshes()).toHaveLength(1)
    expect(meshes()[0]?.name).toBe('Cube')
  })

  it('adds nothing for a kind no registry knows', () => {
    const menu = captureSceneAdd()
    renderHook(() => useNativeMenu())

    menu.emit({ kind: 'teapot' })

    expect(meshes()).toEqual([])
  })

  it('adds nothing when no document is in front', () => {
    useDocuments.setState({ activeId: null })
    const menu = captureSceneAdd()
    renderHook(() => useNativeMenu())

    menu.emit({ kind: 'box' })

    expect(meshes()).toEqual([])
  })
})
