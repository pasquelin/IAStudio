import { useMemo } from 'react'
import { type Components } from 'react-markdown'
import { manualTargetOf, type ManualTarget } from '@shared/domain/manual'
import { ManualWindowHeading } from '@/features/manual/components/ManualWindow/ManualWindowHeading'

/**
 * How the manual's markdown is dressed, in the vocabulary of an application window.
 *
 * A table scrolls inside itself: the manual holds 1367 table rows and this window is narrower
 * than a browser, so the alternative is prose pushed sideways by one wide table.
 */
export function useMarkdownComponents(go: (target: ManualTarget) => void): Components {
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
        <ManualWindowHeading tag="h1" className="pt-5 pb-1 text-base font-semibold">
          {children}
        </ManualWindowHeading>
      ),
      h2: ({ children }) => (
        <ManualWindowHeading tag="h2" className="pt-4 pb-1 text-sm font-semibold">
          {children}
        </ManualWindowHeading>
      ),
      h3: ({ children }) => (
        <ManualWindowHeading tag="h3" className="text-body pt-3 pb-1 font-semibold">
          {children}
        </ManualWindowHeading>
      ),
      h4: ({ children }) => (
        <ManualWindowHeading tag="h4" className="pt-2 pb-1 text-xs font-semibold">
          {children}
        </ManualWindowHeading>
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
