import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SceneAddRequest, Unsubscribe } from '@shared/ipc'
import { installScene } from '@/stores/scene-fixtures'
import type { CommandId } from '@shared/domain/command'
import type { ToolId } from '@shared/domain/tool'
import { bridgeWatchingLogs, installFakeBridge } from '@/services/fake-bridge'
import { useDocuments } from '@/stores/documents'
import { useLayouts } from '@/stores/layouts'
import { useModels } from '@/stores/models'
import { sceneOf, useScenes } from '@/stores/scenes'

const saveDocument = vi.fn((_documentId: string) => Promise.resolve())

// What saving does is `document-io`'s own suite; what this one is about is the menu reaching it.
vi.mock('@/app/document-io', () => ({
  saveDocument: (documentId: string) => saveDocument(documentId),
}))

const { useNativeMenu } = await import('./useNativeMenu')

/** Holds the listener the hook registers on a menu channel, so the test can play the menu. */
function captureMenu<T>(channel: 'onSceneAdd' | 'onCommand') {
  let listener: ((payload: T) => void) | null = null
  const watched = bridgeWatchingLogs({
    menu: {
      [channel]: (callback: (payload: T) => void): Unsubscribe => {
        listener = callback
        return () => {
          listener = null
        }
      },
    },
  })
  return { ...watched, emit: (payload: T) => listener?.(payload) }
}

const captureSceneAdd = () => captureMenu<SceneAddRequest>('onSceneAdd')
const captureCommand = () => captureMenu<CommandId>('onCommand')

function meshes() {
  return sceneOf(useScenes.getState(), 'doc-1').nodes.filter(node => node.type === 'mesh')
}

beforeEach(() => {
  vi.clearAllMocks()
  installScene('doc-1')
})

describe('useNativeMenu', () => {
  it('adds the node the native menu asked for', () => {
    const menu = captureSceneAdd()
    renderHook(() => useNativeMenu())

    menu.emit({ kind: 'box' })

    expect(meshes()).toHaveLength(1)
    expect(meshes()[0]?.name).toBe('Box')
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

  it('saves the document in front when the menu asks, and only that one', () => {
    const menu = captureCommand()
    renderHook(() => useNativeMenu())

    menu.emit('document.save')

    expect(saveDocument).toHaveBeenCalledWith('doc-1')
  })

  // The menu is application-wide and knows nothing of tabs; saving with none in front would
  // have to guess which document was meant.
  it('saves nothing when no document is in front', () => {
    useDocuments.setState({ activeId: null })
    const menu = captureCommand()
    renderHook(() => useNativeMenu())

    menu.emit('document.save')

    expect(saveDocument).not.toHaveBeenCalled()
  })

  /**
   * A menu command runs outside React, so a failed one has nowhere to surface: the tab simply
   * keeps its modified marker. The log is what says why it kept it.
   */
  it('records a save the project refused, rather than swallowing it', async () => {
    saveDocument.mockReturnValueOnce(Promise.reject(new Error('no project')))
    const menu = captureCommand()
    renderHook(() => useNativeMenu())

    expect(() => menu.emit('document.save')).not.toThrow()
    await vi.waitFor(() =>
      expect(menu.report).toHaveBeenCalledWith(
        expect.objectContaining({ scope: 'document.save', message: expect.any(String) }),
      ),
    )
  })
})

describe('what the native menu is told', () => {
  const setWorkspace = vi.fn(() => Promise.resolve())

  function lastPublished(): { workspace: string; tools: readonly ToolId[] } {
    // Typed by the stub rather than by the bridge; the call is what the hook actually sent.
    const [workspace, tools] = (setWorkspace.mock.lastCall ?? []) as unknown as [
      string,
      readonly ToolId[],
    ]
    return { workspace, tools }
  }

  beforeEach(() => {
    installFakeBridge({ window: { setWorkspace } })
    useLayouts.setState({ activeWorkspace: 'image' })
    useModels.setState({ selected: {} })
  })

  // Published on mount rather than on the first switch: the workspace is restored from the
  // persisted state without ever going through `setActiveWorkspace`.
  it('announces the restored section without waiting for a switch', () => {
    renderHook(() => useNativeMenu())
    expect(lastPublished().workspace).toBe('image')
  })

  it('follows a change of section', () => {
    renderHook(() => useNativeMenu())
    useLayouts.getState().setActiveWorkspace('3d')
    expect(lastPublished().workspace).toBe('3d')
  })

  it('leaves the generator out while the section has no model', () => {
    renderHook(() => useNativeMenu())
    expect(lastPublished().tools).toContain('models')
    expect(lastPublished().tools).not.toContain('generator')
  })

  // The section did not change, but what it can do did — and the menu is built app-wide, so
  // nothing else would tell it.
  it('announces the generator as soon as a model is chosen', () => {
    renderHook(() => useNativeMenu())
    useModels.getState().select('image', 'flux-dev', 'image')
    expect(lastPublished().tools).toContain('generator')
  })
})
