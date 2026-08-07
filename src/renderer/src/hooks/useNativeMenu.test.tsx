import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import type { SceneAddRequest, Unsubscribe } from '@shared/ipc'
import { installScene } from '@/stores/scene-fixtures'
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
  installScene('doc-1')
})

describe('useNativeMenu', () => {
  it('adds the node the native menu asked for', () => {
    const menu = captureSceneAdd()
    renderHook(() => useNativeMenu())

    menu.emit({ kind: 'box' })

    expect(meshes()).toHaveLength(1)
    expect(meshes()[0]?.name).toBe('Cube')
  })

  // A kind that is announced but not buildable yet reaches the same guard as an unknown one,
  // which `node-factory.test.ts` pins; here it must simply leave the scene alone.
  it('adds nothing for a primitive that is not buildable yet', () => {
    const menu = captureSceneAdd()
    renderHook(() => useNativeMenu())

    menu.emit({ kind: 'text' })

    expect(meshes()).toEqual([])
  })

  // The menu is app-wide: a node written under an image document would give it a scene and a
  // history it has no editor for.
  it('adds nothing when the document in front is not a scene', () => {
    useDocuments.setState({
      documents: {
        'doc-1': { id: 'doc-1', kind: 'image', workspace: 'image', title: 'Sans titre' },
      },
      activeId: 'doc-1',
    })
    const menu = captureSceneAdd()
    renderHook(() => useNativeMenu())

    menu.emit({ kind: 'box' })

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
