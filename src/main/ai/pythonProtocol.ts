import { z } from 'zod'

/**
 * What the main process and the local AI engine say to each other: one JSON object per line, over
 * a unix socket — a named pipe on Windows. Paths, never bytes: a control frame that grows is one
 * nothing can journal or replay, and `sttProtocol.ts` settled the rule for 640 MB of weights.
 */

/**
 * The vocabulary both sides agree on, carried by every frame. `__init__.py` holds the same number
 * and `pythonProtocol.test.ts` reads it: no compiler sits between the two languages.
 */
export const PROTOCOL_VERSION = 1

/** What the engine answers today. Nothing else: no model, no worker, no tensor library. */
export type EngineOp = 'hardware.info'

/** Drops a request the engine still holds. Posted by `processClient` when a caller aborts. */
export const CANCEL_OP = 'engine.cancel'

export type EngineRequest = {
  readonly v: number
  readonly id: number
  readonly op: EngineOp | typeof CANCEL_OP
  readonly params: Readonly<Record<string, unknown>>
}

export function engineRequest(id: number, op: EngineOp | typeof CANCEL_OP): EngineRequest {
  return { v: PROTOCOL_VERSION, id, op, params: {} }
}

/**
 * The greeting, and always the first frame: reading a Python stack can fail, and it has to fail at
 * the opening rather than at the first generation — the same handshake `SttReady` answers.
 */
const hello = z.object({
  v: z.number(),
  evt: z.literal('engine.hello'),
  engine: z.string(),
  protocol: z.number(),
  python: z.string(),
  platform: z.string(),
})

/** What the engine says about a frame it could not read: there is no run id to answer under. */
const noticed = z.object({ v: z.number(), evt: z.string(), message: z.string() })

const refused = z.object({
  v: z.number(),
  id: z.number(),
  err: z.object({ code: z.string(), message: z.string(), detail: z.unknown().optional() }),
})

/** `ok` is REQUIRED, which is what keeps a refusal from reading as an answer settled with nothing. */
const settled = z.object({ v: z.number(), id: z.number(), ok: z.unknown() })

const frame = z.union([hello, noticed, refused, settled])

export type EngineHello = z.infer<typeof hello>
export type EngineFrame = z.infer<typeof frame>

/** `null` for a line this protocol cannot read — the caller logs it rather than guessing at it. */
export function readFrame(line: string): EngineFrame | null {
  try {
    const parsed = frame.safeParse(JSON.parse(line) as unknown)
    return parsed.success ? parsed.data : null
  } catch {
    // A Python library writing to the socket rather than to stderr would land here. It is not a
    // reason to take the engine down: the frame is dropped, and the log says which line it was.
    return null
  }
}

export function isHello(value: EngineFrame): value is EngineHello {
  return 'evt' in value && value.evt === 'engine.hello'
}

/**
 * The machine as a core WITHOUT a tensor library sees it. No video memory, and that is honest
 * rather than a gap: ADR-19 takes that reading from an inference runtime, and there is none yet.
 */
const hardware = z.object({
  platform: z.string(),
  machine: z.string(),
  pythonVersion: z.string(),
  cpuCount: z.number(),
  /** `null` where the system declines to answer: an unread context is never given a default. */
  totalBytes: z.number().nullable(),
})

export type EngineHardware = z.infer<typeof hardware>

/** Throws on a shape the engine should never send: it is our own code, one version out of step. */
export function readHardware(value: unknown): EngineHardware {
  return hardware.parse(value)
}
