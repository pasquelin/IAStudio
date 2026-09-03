import { addNode } from '@/engines/scene/commands'
import { meshNode } from '@/engines/scene/scene-fixtures'
import { installFakeBridge } from '@/services/fakeBridge'
import { scriptRefOf, useCode } from '@/stores/code'
import { useDocuments } from '@/stores/documents'
import { inspectedChannel, useMaterialViews } from '@/stores/materialViews'
import { isSceneDirty, sceneOf, useScenes } from '@/stores/scenes'
import type { CloseChoice } from '@shared/domain/document'
import { type DocumentWrite } from '@shared/domain/document'
import { describe, expect, it, vi } from 'vitest'

// The real one needs a live Dockview; what this file checks is that closing and opening reach it.
import {
  box,
  closeDocument,
  closePanel,
  refreshDocuments,
  restoreDocument,
  saveDocument,
  savedFile,
  scene,
} from './documentIoTest-fixtures'

describe('closing a document', () => {
  const openDirtyScene = async (): Promise<string> => {
    installFakeBridge({ documents: { write: () => Promise.resolve<DocumentWrite>('written') } })
    const created = await useDocuments.getState().create('3d')
    if (!created) throw new Error('expected a document')
    useScenes.getState().runCommand(created.id, addNode(box))
    return created.id
  }

  it('forgets the text of a script a project change dropped', async () => {
    installFakeBridge({})
    const left = await useDocuments.getState().create('code')
    if (!left) throw new Error('expected a document')
    const script = scriptRefOf(left.id)
    if (script === null) throw new Error('expected a script reference')
    useCode.getState().installed(script, 'export default 1\n')

    installFakeBridge({ documents: { list: () => Promise.resolve([]) } })

    await expect(refreshDocuments()).resolves.toBe(true)

    expect(useCode.getState().files[script]).toBeUndefined()
  })

  it('leaves the flat view of a document it did not close alone', async () => {
    installFakeBridge({})
    const closing = await useDocuments.getState().create('materials')
    if (!closing) throw new Error('expected a document')
    useMaterialViews.getState().inspect('elsewhere', 'roughness')

    await expect(closeDocument(closing.id)).resolves.toBe(true)

    expect(inspectedChannel(useMaterialViews.getState(), 'elsewhere')).toBe('roughness')
  })

  it('leaves the document open and intact when the answer is cancel', async () => {
    const documentId = await openDirtyScene()
    installFakeBridge({ documents: { confirmClose: () => Promise.resolve<CloseChoice>('cancel') } })

    await expect(closeDocument(documentId)).resolves.toBe(false)
    expect(useDocuments.getState().documents[documentId]).toBeDefined()
    expect(sceneOf(useScenes.getState(), documentId).nodes).toEqual([box])
  })

  it('keeps the document open when the write it was asked for fails', async () => {
    const documentId = await openDirtyScene()
    installFakeBridge({
      documents: {
        write: () => Promise.reject(new Error('no project')),
        confirmClose: () => Promise.resolve<CloseChoice>('save'),
      },
    })

    await expect(closeDocument(documentId)).rejects.toThrow()
    expect(useDocuments.getState().documents[documentId]).toBeDefined()
    expect(isSceneDirty(useScenes.getState(), documentId)).toBe(true)
  })

  it('takes the tab away with the document', async () => {
    const documentId = await openDirtyScene()
    installFakeBridge({
      documents: { confirmClose: () => Promise.resolve<CloseChoice>('discard') },
    })

    await closeDocument(documentId)
    expect(closePanel).toHaveBeenCalledWith(documentId)
  })

  it('forgets that a closed document would not read', async () => {
    installFakeBridge({
      documents: {
        read: () => Promise.reject(new Error('gone')),
        confirmClose: () => Promise.resolve<CloseChoice>('discard'),
        write: () => Promise.resolve<DocumentWrite>('written'),
      },
    })
    useDocuments.setState({ documents: { 'doc-1': scene('doc-1') } })
    await restoreDocument('doc-1')
    await closeDocument('doc-1')

    // Reopened under the same id, now readable: the verdict must not have followed it.
    const write = vi.fn(() => Promise.resolve<DocumentWrite>('written'))
    installFakeBridge({ documents: { write, read: () => Promise.resolve(savedFile()) } })
    useDocuments.setState({ documents: { 'doc-1': scene('doc-1') } })
    await restoreDocument('doc-1')
    useScenes.getState().runCommand('doc-1', addNode(meshNode('box-2')))

    await saveDocument('doc-1')
    expect(write).toHaveBeenCalled()
  })
})
