import type { ReactNode } from 'react'
import { manualAnchorOf } from '@shared/domain/manual'

/** Headings hold `**bold**` and `` `code` ``, so the text has to be gathered from the nodes. */
function childrenText(children: ReactNode): string {
  if (typeof children === 'string') return children
  if (typeof children === 'number') return String(children)
  if (Array.isArray(children)) return children.map(childrenText).join('')
  if (children && typeof children === 'object' && 'props' in children) {
    const props: unknown = children.props
    if (props && typeof props === 'object' && 'children' in props) {
      // `in` narrows the key to `unknown`, and every branch above takes one — so the recursion
      // decides what it is rather than this line asserting it.
      return childrenText(props.children as ReactNode)
    }
  }
  return ''
}

/**
 * A heading carrying the `id` its own anchor names, computed by the shared rule rather than by
 * this component: an anchor the collector validated and the window computes differently is a
 * link that passes the build and lands nowhere.
 */
export function ManualWindowHeading({
  tag: Tag,
  className,
  children,
}: {
  tag: 'h1' | 'h2' | 'h3' | 'h4'
  className: string
  children: ReactNode
}) {
  return (
    <Tag id={manualAnchorOf(childrenText(children))} className={className}>
      {children}
    </Tag>
  )
}
