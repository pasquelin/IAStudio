import { memo } from 'react'
import Markdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'

/** Hoisted: a fresh array on every render would defeat the memo below by prop identity. */
const REMARK_PLUGINS = [remarkGfm]

/**
 * The rendered chapter, held apart from the window that frames it.
 *
 * `memo` for a measured reason: `remark-parse` alone takes 12 to 15 ms on the longest chapter,
 * before gfm, rehype and the JSX runtime — and `react-markdown` memoises nothing of its own. Left
 * inline, every keystroke in the search box reparsed a chapter that had not changed, over the
 * frame budget for a screen that was only meant to filter a list.
 */
export const ManualWindowBody = memo(function ManualWindowBody({
  markdown,
  components,
}: {
  markdown: string
  components: Components
}) {
  return (
    <Markdown remarkPlugins={REMARK_PLUGINS} components={components}>
      {markdown}
    </Markdown>
  )
})
