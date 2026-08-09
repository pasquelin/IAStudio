import { fireEvent } from '@testing-library/react'

/**
 * A node as React Flow renders it, found the one way it can be. Written once because two suites
 * reach for it: a change to React Flow's markup then breaks in one place rather than four.
 */
export const canvasNode = (container: HTMLElement, id: string): Element | null =>
  container.querySelector(`.react-flow__node[data-id="${id}"]`)

export function clickNode(container: HTMLElement, id: string): void {
  const node = canvasNode(container, id)
  if (!node) throw new Error(`no node ${id} to click`)
  fireEvent.click(node)
}
