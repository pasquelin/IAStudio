import { timingSafeEqual } from 'node:crypto'

/**
 * Who is allowed to reach the server at all.
 *
 * A local HTTP port is reachable by every page the machine's browser happens to have open, and
 * the two things that stand between the studio and one of them are here: a token nothing else
 * knows, and a refusal to serve a request that came from a web origin. Written as a function of
 * headers alone so both can be shown to be refused without a socket.
 */

export type AccessVerdict = 'granted' | 'badOrigin' | 'badToken'

/** Just enough of a request to decide. Lower-cased keys, as Node hands them over. */
export type RequestHeaders = Record<string, string | string[] | undefined>

/**
 * One header value, or nothing.
 *
 * The array arm is not for repeated `Authorization` or `Origin` — measured: Node DROPS repeats of
 * `authorization` and keeps the first, and JOINS repeats of `origin` with `', '`, so both reach
 * here as a string either way. It is there because the type says so, and because a joined origin
 * (`"https://evil.example, http://localhost"`) then fails `LOOPBACK` on its own, which is the
 * answer we want.
 */
function headerOf(headers: RequestHeaders, name: string): string | null {
  const value = headers[name]
  return typeof value === 'string' ? value : null
}

/**
 * The origins a page may legitimately carry here, which is the loopback interface under either
 * of its two spellings.
 *
 * Any port, because the studio does not choose the client's: what matters is that the request
 * came from this machine's own loopback rather than from a site that resolved its own name to
 * 127.0.0.1 in order to reach it — the DNS rebinding the transport spec asks to be refused.
 */
const LOOPBACK = /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/

function bearerOf(headers: RequestHeaders): string | null {
  const authorisation = headerOf(headers, 'authorization')
  const bearer = authorisation?.match(/^Bearer (.+)$/)
  return bearer?.[1] ?? null
}

/**
 * Whether this request is served.
 *
 * The origin is checked BEFORE the token, and the order is the point: a page that guessed the
 * token still fails on where it came from, and one that has neither learns nothing from which
 * of the two was wrong — both answers are the same status.
 *
 * An ABSENT origin is allowed. That is not a hole: a browser always sends one, so absence means
 * the caller is not a page — a command-line client, an editor — and refusing it would refuse
 * every legitimate use this server has.
 */
export function admits(headers: RequestHeaders, token: string): AccessVerdict {
  const origin = headerOf(headers, 'origin')
  if (origin !== null && !LOOPBACK.test(origin)) return 'badOrigin'

  const offered = bearerOf(headers)
  return offered !== null && safeEqual(offered, token) ? 'granted' : 'badToken'
}

/**
 * Compared in constant time, so the number of leading characters that matched cannot be read off
 * how long the answer took.
 *
 * Node's own rather than a loop of our making: it compares BYTES, which a loop over
 * `charCodeAt` does not — the two agree while the token is hex and would part company the day it
 * is not. `timingSafeEqual` throws on a length mismatch, so the length is checked first; that
 * check is on public information, since whether a guess is 8 or 64 characters long is something
 * the guesser already knows.
 */
function safeEqual(offered: string, token: string): boolean {
  const guess = Buffer.from(offered, 'utf8')
  const secret = Buffer.from(token, 'utf8')

  return guess.length === secret.length && timingSafeEqual(guess, secret)
}
