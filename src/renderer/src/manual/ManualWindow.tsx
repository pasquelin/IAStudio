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
import { TooltipHost } from '@/design/TooltipHost'
import { DRAGGABLE } from '@/helpers/app-region'
import { useAppliedSettings } from '@/hooks/useAppliedSettings'
import { cn } from '@/helpers/cn'

/**
 * The user manual, offline and in the reader's language — the same nineteen chapters as
 * `docs/`, compiled into `shared/manual.json` by `pnpm manual:collect`.
 *
 * Outside the docks, so this is the application being an application rather than a studio.
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

  // Over the markdown itself rather than a prepared index: four hundred kilobytes of one
  // language answers a keystroke in under a millisecond, and an index is one more thing that can
  // disagree with what it indexes. Folded whole rather than searched raw — `etape` has to find
  // "Étape", the settings search having settled that question already.
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
    if (needle === '') return null
    return folded.filter(entry => entry.text.includes(needle)).map(entry => entry.chapter)
  }, [folded, query])

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

  const components = useMemo<Components>(
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
              className="text-accent-ink underline"
            >
              {children}
            </a>
          )
        }
        return (
          <button
            type="button"
            onClick={() => go(target)}
            className="text-accent-ink cursor-pointer underline"
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
      // The manual has 1367 table rows and a window narrower than GitHub: the table scrolls
      // inside itself rather than pushing the prose sideways.
      table: ({ children }) => (
        <div className="border-border my-3 overflow-x-auto rounded border">
          <table className="w-full border-collapse text-left">{children}</table>
        </div>
      ),
      th: ({ children }) => (
        <th className="border-border text-muted border-b px-2 py-1 font-semibold">{children}</th>
      ),
      td: ({ children }) => (
        <td className="border-border border-b px-2 py-1 align-top">{children}</td>
      ),
      blockquote: ({ children }) => (
        <blockquote className="border-accent-soft bg-surface my-3 border-l-2 py-2 pr-3 pl-3">
          {children}
        </blockquote>
      ),
      code: ({ children }) => (
        <code className="bg-surface text-tiny rounded px-1 py-0.5">{children}</code>
      ),
      pre: ({ children }) => (
        <pre className="bg-surface text-tiny my-3 overflow-x-auto rounded p-3">{children}</pre>
      ),
      ul: ({ children }) => <ul className="my-2 list-disc pl-5">{children}</ul>,
      ol: ({ children }) => <ol className="my-2 list-decimal pl-5">{children}</ol>,
      p: ({ children }) => <p className="my-2">{children}</p>,
      hr: () => <hr className="border-border my-4" />,
    }),
    [go],
  )

  return (
    <div className="bg-chassis text-text flex h-screen flex-col">
      <header style={DRAGGABLE} className="flex shrink-0 items-center gap-3 px-4 pt-6 pb-3 pl-24">
        <h1 className="text-body font-semibold">{t('manual.title')}</h1>
        <input
          type="search"
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder={t('manual.search')}
          aria-label={t('manual.search')}
          className="bg-surface border-border ml-auto w-56 rounded border px-2 py-1 text-xs"
        />
      </header>

      <div className="flex min-h-0 flex-1">
        <nav className="border-border w-56 shrink-0 overflow-auto border-r px-2 pb-4">
          {(found ?? chapters).map(entry => (
            <button
              key={entry.slug}
              type="button"
              onClick={() => {
                setSlug(entry.slug)
                setQuery('')
              }}
              className={cn(
                'hover:bg-surface flex w-full cursor-pointer gap-2 rounded px-2 py-1 text-left',
                entry.slug === chapter?.slug && found === null && 'bg-surface',
              )}
            >
              <span className="text-muted text-tiny w-5 shrink-0 text-right">{entry.number}</span>
              <span className="text-xs">{entry.title}</span>
            </button>
          ))}
          {found?.length === 0 && (
            <p className="text-muted text-tiny px-2 py-2">{t('manual.noResult')}</p>
          )}
        </nav>

        <article className="min-h-0 flex-1 overflow-auto px-6 pb-10 text-xs">
          {chapter && (
            <>
              <h2 className="pt-4 pb-2 text-lg font-semibold">
                <span className="text-muted pr-2">{chapter.number}</span>
                {chapter.title}
              </h2>
              <ChapterBody markdown={chapter.markdown} components={components} />
            </>
          )}
        </article>
      </div>

      <TooltipHost />
    </div>
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
      return childrenText((props as { children: React.ReactNode }).children)
    }
  }
  return ''
}
