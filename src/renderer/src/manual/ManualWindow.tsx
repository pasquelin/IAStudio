import { memo, useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Markdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  manualAnchorOf,
  manualTargetOf,
  type ManualChapter,
  type ManualTarget,
} from '@shared/domain/manual'
import { isSupportedLanguage, UNKNOWN_SYSTEM_LANGUAGE } from '@shared/i18n'
import manual from '@shared/manual.json'
import { foldForSearch } from '@shared/text'
import { WindowShell } from '@/design/WindowShell'
import { WINDOW_CAPTION } from '@/design/window-styles'
import { WindowNav } from '@/design/WindowNav/WindowNav'
import { WindowNavItem } from '@/design/WindowNav/WindowNavItem'
import { HINT_RIGHT } from '@/helpers/tooltip'
import { useAppliedSettings } from '@/hooks/useAppliedSettings'

/**
 * The user manual, offline and in the reader's language — the same twenty chapters as
 * `docs/`, compiled into `shared/manual.json` by `pnpm manual:collect`.
 *
 * Built on the settings window's shape, as the usage window is: chapters on the left, the open
 * one on the right, the search over the list and the results in the pane. The first version of
 * this file wore the STUDIO's tokens instead of DaisyUI's, which made a window that passed every
 * test and still did not look like the application it opens from.
 *
 * Its links are the whole reason the manual is compiled rather than fetched: every one of them
 * was resolved at build time, so a chapter reference here cannot be a click that does nothing.
 * External ones go out through `setWindowOpenHandler`, which already refuses anything but HTTPS
 * — the manual needs no bridge of its own.
 */
export function ManualWindow() {
  const { t, i18n } = useTranslation()
  useAppliedSettings()

  const language = isSupportedLanguage(i18n.language) ? i18n.language : UNKNOWN_SYSTEM_LANGUAGE
  const chapters: ManualChapter[] = manual[language]

  const [slug, setSlug] = useState(chapters[0]?.slug ?? '')
  const [query, setQuery] = useState('')

  const chapter = chapters.find(entry => entry.slug === slug) ?? chapters[0]
  const searching = query.trim() !== ''

  // Folded once per language rather than per keystroke: `foldForSearch` decomposes and strips
  // accents over the whole manual, which is four hundred thousand characters of one language.
  const folded = useMemo(
    () =>
      chapters.map(entry => ({
        chapter: entry,
        text: foldForSearch(`${entry.title}\n${entry.markdown}`),
      })),
    [chapters],
  )

  const found = useMemo(() => {
    const needle = foldForSearch(query.trim())
    if (needle === '') return []
    return folded.filter(entry => entry.text.includes(needle)).map(entry => entry.chapter)
  }, [folded, query])

  const open = useCallback((next: string) => {
    setQuery('')
    setSlug(next)
  }, [])

  const go = useCallback((target: ManualTarget) => {
    if (target.kind === 'external') return
    if (target.kind === 'chapter') setSlug(target.slug)

    const anchor = target.anchor
    if (anchor === undefined) return
    // After the chapter has painted: a heading in a chapter just switched to does not exist yet.
    requestAnimationFrame(() => {
      document.getElementById(anchor)?.scrollIntoView({ block: 'start' })
    })
  }, [])

  const components = useMarkdownComponents(go)

  return (
    <WindowShell
      title={t('manual.title')}
      navLabel={t('manual.chapters')}
      nav={
        <>
          {/* Outside the scrolling list, as the settings search is: a field that scrolls away
              with what it filters is a field one has to go looking for. */}
          <input
            type="search"
            className="input input-xs w-full shrink-0"
            aria-label={t('manual.search')}
            placeholder={t('manual.search')}
            value={query}
            onChange={event => setQuery(event.target.value)}
          />

          <WindowNav>
            {chapters.map(entry => (
              <WindowNavItem
                key={entry.slug}
                active={!searching && entry.slug === chapter?.slug}
                hint={t('manual.chapterHint')}
                onSelect={() => open(entry.slug)}
                className="gap-2 px-3"
              >
                {/* The token, not an opacity: a number dimmed by `opacity-N` is a word the
                    contrast guard cannot reason about, and this window has a caption ink. */}
                <span className={WINDOW_CAPTION}>{entry.number}</span>
                <span className="truncate">{entry.title}</span>
              </WindowNavItem>
            ))}
          </WindowNav>
        </>
      }
    >
      {searching ? (
        <>
          <h2 className="mb-4 text-base font-semibold">{t('manual.results')}</h2>
          <SearchResults found={found} onOpen={open} />
        </>
      ) : (
        chapter && (
          <>
            <h2 className="mb-4 text-base font-semibold">
              <span className={WINDOW_CAPTION}>{chapter.number}</span> {chapter.title}
            </h2>
            <ChapterBody markdown={chapter.markdown} components={components} />
          </>
        )
      )}
    </WindowShell>
  )
}

/** The chapters the words appear in, as the settings window lists what it found. */
function SearchResults({
  found,
  onOpen,
}: {
  found: readonly ManualChapter[]
  onOpen: (slug: string) => void
}) {
  const { t } = useTranslation()

  if (found.length === 0) return <p className={WINDOW_CAPTION}>{t('manual.noResult')}</p>

  return (
    <ul className="m-0 flex list-none flex-col p-0">
      {found.map(entry => (
        <li key={entry.slug}>
          <button
            type="button"
            {...HINT_RIGHT(t('manual.searchResultHint'))}
            onClick={() => onOpen(entry.slug)}
            className="border-base-300 hover:bg-base-300 flex w-full items-baseline gap-2 border-b py-3 text-left last:border-b-0"
          >
            <span className={WINDOW_CAPTION}>{entry.number}</span>
            <span className="text-xs font-medium">{entry.title}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}

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
const ChapterBody = memo(function ChapterBody({
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

/**
 * How the manual's markdown is dressed, in the vocabulary of an application window.
 *
 * A table scrolls inside itself: the manual holds 1367 table rows and this window is narrower
 * than a browser, so the alternative is prose pushed sideways by one wide table.
 */
function useMarkdownComponents(go: (target: ManualTarget) => void): Components {
  return useMemo<Components>(
    () => ({
      a: ({ href, children, ...rest }) => {
        const target = href === undefined ? null : manualTargetOf(href)
        // `null` cannot happen — `collect-manual.ts` refuses to write one — and is rendered as
        // plain text rather than a dead anchor if the day ever comes.
        if (!target) return <span {...rest}>{children}</span>
        if (target.kind === 'external') {
          return (
            <a
              {...rest}
              href={target.url}
              target="_blank"
              rel="noreferrer"
              className="link link-primary"
            >
              {children}
            </a>
          )
        }
        return (
          <button
            type="button"
            onClick={() => go(target)}
            className="link link-primary cursor-pointer"
          >
            {children}
          </button>
        )
      },
      h1: ({ children }) => (
        <Heading tag="h1" className="pt-5 pb-1 text-base font-semibold">
          {children}
        </Heading>
      ),
      h2: ({ children }) => (
        <Heading tag="h2" className="pt-4 pb-1 text-sm font-semibold">
          {children}
        </Heading>
      ),
      h3: ({ children }) => (
        <Heading tag="h3" className="text-body pt-3 pb-1 font-semibold">
          {children}
        </Heading>
      ),
      h4: ({ children }) => (
        <Heading tag="h4" className="pt-2 pb-1 text-xs font-semibold">
          {children}
        </Heading>
      ),
      table: ({ children }) => (
        <div className="border-base-300 my-3 overflow-x-auto rounded border">
          <table className="table-xs table">{children}</table>
        </div>
      ),
      blockquote: ({ children }) => (
        <blockquote className="border-primary bg-base-100 my-3 border-l-2 py-2 pr-3 pl-3">
          {children}
        </blockquote>
      ),
      code: ({ children }) => (
        <code className="bg-base-300 text-tiny rounded px-1 py-0.5">{children}</code>
      ),
      pre: ({ children }) => (
        <pre className="bg-base-100 text-tiny my-3 overflow-x-auto rounded p-3">{children}</pre>
      ),
      ul: ({ children }) => <ul className="my-2 list-disc pl-5">{children}</ul>,
      ol: ({ children }) => <ol className="my-2 list-decimal pl-5">{children}</ol>,
      p: ({ children }) => <p className="my-2 text-xs">{children}</p>,
      hr: () => <hr className="border-base-300 my-4" />,
    }),
    [go],
  )
}

/**
 * A heading carrying the `id` its own anchor names, computed by the shared rule rather than by
 * this component: an anchor the collector validated and the window computes differently is a
 * link that passes the build and lands nowhere.
 */
function Heading({
  tag: Tag,
  className,
  children,
}: {
  tag: 'h1' | 'h2' | 'h3' | 'h4'
  className: string
  children: React.ReactNode
}) {
  return (
    <Tag id={manualAnchorOf(childrenText(children))} className={className}>
      {children}
    </Tag>
  )
}

/** Headings hold `**bold**` and `` `code` ``, so the text has to be gathered from the nodes. */
function childrenText(children: React.ReactNode): string {
  if (typeof children === 'string') return children
  if (typeof children === 'number') return String(children)
  if (Array.isArray(children)) return children.map(childrenText).join('')
  if (children && typeof children === 'object' && 'props' in children) {
    const props: unknown = children.props
    if (props && typeof props === 'object' && 'children' in props) {
      // `in` narrows the key to `unknown`, and every branch above takes one — so the recursion
      // decides what it is rather than this line asserting it.
      return childrenText(props.children as React.ReactNode)
    }
  }
  return ''
}
