import { describe, expect, it } from 'vitest'
import { ACTION_FAMILIES, ACTION_REGISTRY } from '@shared/domain/assistant'
import { GENERATIVE_WORKSPACE_IDS } from '@shared/domain/workspace'
import { CONTEXT_COMPOSED_MAX } from '@shared/domain/projectContext'
import { TARGET_ID_MAX, TARGET_NAME_MAX, TARGETS_MAX, type Target } from '@shared/domain/target'
import { CLOUD_CONTEXT_TOKENS } from './brainHttp'
import { BRIEFING_ROOM } from './brainProvider'
import { machineFolders } from './machineFolders'
import { studioBriefing } from './instruction'
import { ASSISTANT_WINDOW_MAX, roomFor } from './promptWindow'
import { STATE_MAX } from './studioState'

/**
 * EVERY bound at its widest, and each one matters: the list as long as it may be, each id and
 * each name as long as they may be, every line carrying the ` (selected)` suffix. Built from
 * plausible values instead, it measured 2 354 and stayed green while the reachable worst was
 * 1 552 — under the floor the case next to it claims to hold.
 */
const SATURATED: readonly Target[] = [...Array(TARGETS_MAX).keys()].map((at): Target => ({
  id: `${at}`.padEnd(TARGET_ID_MAX, 'i'),
  kind: 'layer',
  name: 'N'.repeat(TARGET_NAME_MAX),
  selected: true,
}))

/** Past the whole registry, which was 68 991 characters on 2026-08-25. */
const WIDE = 200_000

/**
 * What Scenario's door leaves the briefing — narrow enough that the short list is what fits, and
 * the tightest room any door composes against. Read off the door rather than copied: the number
 * moved once and three cases went on measuring the one before it.
 */
const NARROW = BRIEFING_ROOM

describe('what the model is told about the studio', () => {
  /**
   * The half of "say it before you promise" that lives in the prompt: a refusal after the fact
   * still follows a sentence announcing a picture.
   */
  it('names the spaces nothing can generate in, and says nothing when all are served', () => {
    expect(studioBriefing({ notReady: ['image', 'video'], room: NARROW }).text).toContain(
      'No model ready for: image, video.',
    )
    expect(studioBriefing({ room: NARROW }).text).not.toContain('No model ready')
  })

  /** Defect 2 in one line: before this the briefing never said what the studio WAS. */
  it('carries what the studio is right now', () => {
    const briefing = studioBriefing({ state: 'Studio now:\n  Space: image.', room: NARROW })

    expect(briefing.text).toContain('Space: image.')
  })
})

describe('how much of the catalogue the model is shown', () => {
  /**
   * 🛑 `[M]` The one a whole lot walked past: at 4 096 tokens — what `ollamaModel` gives a tag
   * declaring none — the room is 7 116 against a short briefing of 7 405, and nothing was left to
   * give. The catalogue gives ground now, and `actions.find` reaches what was cut.
   *
   * Every room rather than one: a case pinned to a figure goes green the day the briefing shrinks.
   */
  it.each([roomFor(4096), roomFor(8192), NARROW, WIDE])('fits the room it was given: %i', room => {
    expect(
      studioBriefing({
        room,
        folders: machineFolders(name => `/Users/someone/${name}`, undefined),
        context: 'x'.repeat(CONTEXT_COMPOSED_MAX),
        state: 'z'.repeat(STATE_MAX),
        targets: SATURATED,
      }).text.length,
    ).toBeLessThanOrEqual(room)
  })

  /**
   * 🛑 `[M]` The guard nothing held: at `roomFor(32 000)` = 90 828 the whole share costs 90 994,
   * so the state, the project context and the folders were cut AND `panel.close` fell off the
   * tail — 521 rounds and 227 refusals a run, every gate green.
   *
   * 🛑 `allowed` against the TEXT, never one action's name: the catalogue is cut from the END, so
   * naming any action but the last leaves a tail of them free to vanish. And a name in `allowed`
   * that the text does not carry is worse than a missing one — the wide share offers no
   * `actions.find`, so the model can neither see it nor ask for it, and `parseReply` accepts a
   * call it was never shown how to write.
   */
  it('shows every action it allows, and what is on screen beside them', () => {
    const briefing = studioBriefing({
      room: roomFor(CLOUD_CONTEXT_TOKENS),
      folders: machineFolders(name => `/Users/someone/${name}`, undefined),
      context: 'a project about sailing boats',
      state: 'The Image space is in front, on document "Voilier vert".',
      targets: [{ id: 'sky-2', kind: 'layer', name: 'Sky', selected: true }],
    })

    const unwritten = [...briefing.allowed].filter(
      name => !briefing.text.includes(`\n  ${name} — `),
    )
    expect(unwritten).toEqual([])
    expect(briefing.text).toContain('The Image space is in front')
    expect(briefing.text).toContain('a project about sailing boats')
    expect(briefing.text).toContain('/Users/someone/')
    expect(briefing.text).toContain('sky-2 — layer "Sky"')
  })

  /**
   * 🛑 They go before the catalogue does, and a runtime cuts from the HEAD (ADR-18) — so what a
   * silent overrun costs is the preamble rather than the block that caused it.
   *
   * The room is MEASURED here, never a door's: written as a figure this case would go green the
   * day the catalogue shrinks, testing a ladder nothing climbs.
   */
  it('drops the machine folders rather than overrun the room they do not fit in', () => {
    const folders = machineFolders(name => `/Users/someone/${name}`, undefined)
    const exact = studioBriefing({ room: NARROW }).text.length
    const briefing = studioBriefing({ room: exact, folders })

    expect(briefing.text).not.toContain('Folders on this machine:')
    expect(briefing.text.length).toBeLessThanOrEqual(exact)
  })

  it('carries the machine folders wherever they fit', () => {
    const folders = machineFolders(name => `/Users/someone/${name}`, undefined)
    const briefing = studioBriefing({ room: roomFor(ASSISTANT_WINDOW_MAX), folders })

    expect(briefing.text).toContain('downloads: /Users/someone/downloads')
  })

  /**
   * 🛑 The way to ask is in the FORMAT and never in the catalogue, and this is what that buys:
   * the block is composed on EVERY briefing, so the narrowest room the studio ships for still
   * carries it. Named as an action it was described by a rule that gave ground with the memory
   * line — a way of asking that disappeared exactly where a small model needed it most.
   */
  it('tells every door how to ask the person, whatever room it has', () => {
    for (const room of [NARROW, roomFor(ASSISTANT_WINDOW_MAX), WIDE]) {
      const briefing = studioBriefing({ room })

      expect(briefing.text, `room ${room}`).toContain('"ask": {"question"')
      expect(briefing.text, `room ${room}`).toContain('RUNS NOTHING')
    }
  })

  /**
   * 🛑 The switch is `room < wholeShare().text.length`, a figure that MOVES with the registry —
   * so a ceiling chosen against today's 90 298 characters stops holding the day the registry
   * shrinks, and every local turn pays for the whole catalogue again with nothing saying so.
   */
  it('keeps the assistant window under what would show it the whole registry', () => {
    const briefing = studioBriefing({ room: roomFor(ASSISTANT_WINDOW_MAX) })

    expect(briefing.text).not.toContain('  git.checkout —')
    expect(briefing.expand).not.toBeNull()
  })

  /**
   * A door with room is shown everything — two hundred and twenty-five actions — where before it
   * was shown eleven because ONE door could not hold more.
   */
  it('shows the whole registry to a brain with room for it', () => {
    const briefing = studioBriefing({ room: WIDE })

    expect(briefing.text).toContain('  git.checkout —')
    expect(briefing.allowed.has('git.checkout')).toBe(true)
    expect(briefing.expand).toBeNull()
  })

  /**
   * 🛑 Headed by the FAMILY the registry publishes, not by the first token of a name: read off
   * the name, 231 actions cut into 83 headings for 65 prefixes — a heading every 2.8 actions,
   * grouping nothing. `models.readGenerationModelFields` and `model.textures` are two families under one prefix.
   */
  it('heads the catalogue with the families the registry publishes', () => {
    const { text } = studioBriefing({ room: WIDE })
    const headings = text.split('\n').filter(one => /^ {2}\[[a-z]+\]$/.test(one))

    expect(headings).toHaveLength(ACTION_FAMILIES.length)
    expect(new Set(headings).size).toBe(headings.length)
    expect(headings).toContain('  [scene]')
    expect(headings).not.toContain('  [model]')
  })

  /** And nothing to find, since there is nothing left it has not been shown. */
  it('does not offer the way to ask for more when it has shown everything', () => {
    expect(studioBriefing({ room: WIDE }).text).not.toContain('actions.find')
  })

  it('shows the short list and the way to ask for the rest to a brain without', () => {
    const briefing = studioBriefing({ room: NARROW })

    expect(briefing.text).toContain('  workspace.open —')
    expect(briefing.text).not.toContain('  git.checkout —')
    expect(briefing.text).toContain('"actions.find"')
    expect(briefing.allowed.has('git.checkout')).toBe(false)
  })

  /**
   * 🛑 A briefing may not NAME an action it did not show. `parseReply` refuses a reply WHOLE the
   * moment one call names an unshown action, so a rule telling a narrow door to `files.list`
   * costs it the entire answer — twice, the retry only complaining about JSON — and the turn
   * dies as "I did not manage to answer that one" with two billed round trips spent.
   *
   * The whole registry's names, not a list written here: a rule added tomorrow naming a fifth
   * action is caught by the same case.
   */
  it('names no action the short list does not show', () => {
    const briefing = studioBriefing({ room: NARROW })
    // The RULES alone: the catalogue below them lists `command.runStudioCommand`'s own options, and a studio
    // command legitimately shares a name with an action — `document.save` is both.
    const rules = briefing.text.slice(0, briefing.text.indexOf('Catalogue:'))
    const unshown = ACTION_REGISTRY.filter(action => !briefing.allowed.has(action.name))

    expect(unshown.filter(action => rules.includes(action.name)).map(one => one.name)).toEqual([])
  })

  // The other half: a rule dropped from the wide door would be as silent as one wrongly kept.
  it('gives the door that holds them the rules that name them', () => {
    const wide = studioBriefing({ room: WIDE })

    expect(wide.text).toContain('  - A file the person names is in the project')
    expect(wide.text).toContain('List the folders YOURSELF')
    expect(wide.text).toContain('The remote library is not this project')
    expect(wide.text).toContain('work on the document IN FRONT')
    expect(wide.text).toContain('repair your OWN order')
    // The four the bench measured, and the reason they live on this door alone — see WIDE_RULES.
    expect(wide.text).toContain('Rule 3 is for what the person ALONE knows')
    expect(wide.text).toContain('are RELATIVE')
    expect(wide.text).toContain('Never say a thing is done')
    expect(wide.text).toContain('Reading is not doing')
    expect(wide.text).toContain('has HAPPENED')
    expect(wide.text).toContain('the WHOLE path inside the project')
    expect(wide.text).toContain('Never write <something> where an id goes')
    expect(wide.text).toContain('what a generation made is in the')
    expect(wide.text).toContain('read models.readGenerationModelFields first')
  })

  it('stays inside the room it was given', () => {
    expect(studioBriefing({ room: NARROW }).text.length).toBeLessThanOrEqual(NARROW)
  })

  /**
   * 🛑 Every bound at once, not today's machine: nothing generateable, a full project context, a
   * target list saturated on all three of its bounds, AND a full state block. The room is what
   * the narrowest door leaves the briefing, and the state is what gives ground inside it — never
   * the sentence, which `brain.test.ts` holds at two thousand characters.
   */
  it.each([false, true])(
    'holds its room with every part of the briefing at its widest, continuing %s',
    // 🛑 CONTINUING as well, which the case left out: it is added to BOTH doors and grew by two
    // lines the day the bench measured a model repeating a call it had already run.
    continuing => {
      const briefing = studioBriefing({
        continuing,
        // The widest this list can ever be: `spacesWithNoModel` names spaces whose PRIMARY
        // employment nothing serves, and every space has one since Code gained `code/txt2code`.
        notReady: GENERATIVE_WORKSPACE_IDS,
        context: 'x'.repeat(CONTEXT_COMPOSED_MAX),
        state: [...Array(20).keys()]
          .map(at => `  line ${at} `.padEnd(STATE_MAX / 20, 'z'))
          .join('\n'),
        targets: SATURATED,
        room: NARROW,
      })

      expect(briefing.text.length).toBeLessThanOrEqual(NARROW)
      // The catalogue never gives ground, whatever else had to.
      expect(briefing.text).toContain('  workspace.open —')
    },
  )

  /** The ids are what `target.select` takes back, so they have to be IN what the model reads. */
  it('lists what the open document can be aimed at, and says nothing when there is nothing', () => {
    const aimed = studioBriefing({
      targets: [{ id: 'sky-2', kind: 'layer', name: 'Sky', selected: true }],
      room: NARROW,
    })

    expect(aimed.text).toContain('sky-2 — layer "Sky" (selected)')
    expect(studioBriefing({ room: NARROW }).text).not.toContain('Targets in the open document')
  })
})

describe('asking for the rest of the catalogue', () => {
  const expanded = (query: string) => studioBriefing({ room: NARROW }).expand?.(query)

  /**
   * The two halves of one answer: the words the model reads, and the set a call is then held to.
   * Adding one without the other is either a model shown what it may not call, or a call refused
   * for naming what it was just shown.
   */
  it('adds what a query found, and lets the model call it', () => {
    const briefing = expanded('git branch')

    expect(briefing?.text).toContain('  git.checkout —')
    expect(briefing?.allowed.has('git.checkout')).toBe(true)
  })

  it('says so rather than inventing when a query found nothing', () => {
    const briefing = expanded('zzzznothing')

    expect(briefing?.text).toContain('Nothing in the catalogue matches')
  })

  /**
   * 🛑 The two are NOT one sentence. A door whose room barely covers the short briefing plus a
   * full project context has nothing left for one found action — and "nothing matches" would then
   * be said to the person about nineteen actions that do.
   */
  it('says there was no ROOM, which is not the same as nothing matching', () => {
    const briefing = studioBriefing({ room: 1 }).expand?.('layer')

    expect(briefing?.text).toContain('actions match "layer"')
    expect(briefing?.text).not.toContain('Nothing in the catalogue matches')
  })

  /**
   * 🛑 The reason the cut is by ACTIONS rather than by characters: half a field line is an action
   * the model cannot call and cannot see is truncated, on the one door too narrow to be shown
   * everything — which is the default one.
   */
  it('keeps whole actions inside the room, however many matched', () => {
    const briefing = expanded('the a of')

    expect(briefing?.text.length).toBeLessThanOrEqual(NARROW)
    for (const action of ACTION_REGISTRY) {
      const shown = briefing?.text.includes(`  ${action.name} —`) ?? false
      if (shown) expect(briefing?.allowed.has(action.name)).toBe(true)
    }
  })

  /** Once and no further: a second query would be a conversation the person is paying to wait on. */
  it('offers no second expansion', () => {
    expect(expanded('git')?.expand).toBeNull()
  })
})

describe('a door that refused the whole catalogue', () => {
  /**
   * The room a chat cloud holds is an assumption — its model is typed by hand — so the wide
   * briefing carries the way back to the short one. Without it, a small model named by hand
   * fails on every sentence with nothing to fall back on.
   */
  it('has the short share to fall back on', () => {
    const narrow = studioBriefing({ room: WIDE }).narrow?.()

    expect(narrow?.text).not.toContain('  git.checkout —')
    expect(narrow?.allowed.has('git.checkout')).toBe(false)
    expect(narrow?.expand).not.toBeNull()
  })

  it('does not offer to narrow what is already the short share', () => {
    expect(studioBriefing({ room: NARROW }).narrow).toBeNull()
  })
})

/**
 * The short briefing with nothing else in it — measured rather than written down, because it
 * moves whenever a `both` action's description does.
 */
const bareShort = (): number => studioBriefing({ room: NARROW, memories: 0 }).text.length

describe('what a briefing says about the memory', () => {
  /**
   * 🛑 A SIGNAL and not the memories. Injecting summaries paid an embedding and a scan of every
   * vector on every turn, for a block four doors of five had no room to carry — measured on the
   * running app: `room=7116 briefing=7094 recalledLen=49 inBriefing=false`.
   */
  it('names the action that reads it, and never what it holds', () => {
    const text = studioBriefing({ memories: 12, room: WIDE }).text

    expect(text).toContain('memory.recall answers it')
    expect(text).not.toContain('learned about this project:')
  })

  it('says nothing at all about a project that has learned nothing', () => {
    expect(studioBriefing({ memories: 0, room: WIDE }).text).not.toContain('has a memory')
    expect(studioBriefing({ room: WIDE }).text).not.toContain('has a memory')
  })

  /**
   * 🛑 Decided on `allowed` rather than on room: a briefing naming an action the model was
   * neither SHOWN nor told how to ask for costs the WHOLE turn. The margin covers BOTH signals,
   * which give ground together — a room holding only the memory line holds neither.
   */
  it('names the word to search for where the catalogue does not hold the action', () => {
    const room = bareShort() + 400
    const text = studioBriefing({ memories: 12, room }).text

    expect(studioBriefing({ room, memories: 0 }).allowed.has('memory.recall')).toBe(false)
    expect(text).toContain('search "memory"')
    expect(text).not.toContain('memory.recall answers it')
  })

  /** An expansion holds neither the action nor a second `actions.find`: it says nothing at all. */
  it('says nothing in a briefing that answers a find', () => {
    const expanded = studioBriefing({ memories: 12, room: bareShort() + 400 }).expand?.('layers')

    expect(expanded?.text).not.toContain('has a memory')
  })

  /**
   * 🛑 The signal is the LAST thing to give ground, and it does: the short share is 7 405
   * characters against the 8 000 Scenario's door leaves. Overrunning is not the milder failure —
   * a runtime truncates from the HEAD, where the preamble sits (ADR-18).
   */
  it('gives the signal up rather than overrun a door that has no room for it', () => {
    const room = bareShort() + 10
    const text = studioBriefing({ memories: 12, room }).text

    expect(text.length).toBeLessThanOrEqual(room)
    expect(text).not.toContain('has a memory')
  })

  /**
   * 🛑 What the wide door would otherwise pay for 78 characters: `studioBriefing` falls back to
   * the spoken vocabulary whole, so the signal would cost 267 actions to say one sentence.
   */
  it('never costs the wide door its catalogue', () => {
    const bare = studioBriefing({ memories: 0, room: WIDE })
    const signalled = studioBriefing({ memories: 12, room: bare.text.length + 10 })

    expect(signalled.allowed.size).toBe(bare.allowed.size)
  })
})
