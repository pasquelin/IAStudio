import { beforeEach, describe, expect, it } from 'vitest'
import { useCode } from '@/stores/code'
import { installDocument } from '@/stores/document-fixtures'
import { useDocuments } from '@/stores/documents'
import { useLayouts } from '@/stores/layouts'
import { openScriptAt } from './openScript'

const WALK = 'script:scripts/Walk.ts'

describe('clicking into a script', () => {
  beforeEach(() => {
    useCode.setState({ files: {}, problems: [], goto: null })
    useDocuments.setState({ documents: {}, activeId: null })
    useLayouts.setState({ activeWorkspace: '3d' })
  })

  /** The two halves of the gesture: the tab comes forward, and the cursor goes to the line. */
  it('brings the script’s own tab up and puts the cursor on the line', () => {
    installDocument('Walk', 'code')

    openScriptAt(WALK, 7, 3)

    expect(useLayouts.getState().activeWorkspace).toBe('code')
    expect(useCode.getState().goto).toEqual({ script: WALK, line: 7, column: 3 })
  })

  /** 🛑 Nothing at all, cursor included: only a mounted editor clears `goto`, so a line posted
   * for a script no tab will ever show stays armed and jumps the caret at the next open. */
  it('does nothing when the project holds no document at that path', () => {
    openScriptAt(WALK, 2, 1)

    expect(useLayouts.getState().activeWorkspace).toBe('3d')
    expect(useCode.getState().goto).toBeNull()
  })

  it('does nothing at all for a reference that names something other than a script', () => {
    openScriptAt('prefab:Hero', 1, 1)

    expect(useCode.getState().goto).toBeNull()
  })
})
