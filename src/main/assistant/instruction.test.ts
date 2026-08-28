import { describe, expect, it } from 'vitest'
import { ACTION_FAMILIES, ACTION_REGISTRY } from '@shared/domain/assistant'
import { GENERATIVE_WORKSPACE_IDS } from '@shared/domain/workspace'
import { CONTEXT_COMPOSED_MAX } from '@shared/domain/projectContext'
import { TARGET_ID_MAX, TARGET_NAME_MAX, TARGETS_MAX, type Target } from '@shared/domain/target'
import { studioBriefing } from './instruction'
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

/** What Scenario's door leaves the briefing — narrow enough that the short list is what fits. */
const NARROW = 8_000

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
   * grouping nothing. `model.schema` and `model.textures` are two families under one prefix.
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
    // The RULES alone: the catalogue below them lists `command.run`'s own options, and a studio
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
    expect(wide.text).toContain('read model.schema first')
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
   * 🛑 The two are NOT one sentence. Every Ollama model declares a 4 096-token window, which
   * leaves 7 116 characters against a short briefing of 7 343 with a full project context — so
   * on the default local door nothing ever fits, and "nothing matches" would be said to the
   * person about nineteen actions that do.
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

describe('what the assistant is reminded of', () => {
  const RECALLED = '  Cameras follow the rail, never the target.'

  it('carries it, after what the project is and before what it is doing', () => {
    const text = studioBriefing({
      context: 'A short film.',
      recalled: RECALLED,
      state: 'Studio now:\n  Space: image.',
      room: NARROW,
    }).text

    expect(text).toContain(RECALLED)
    expect(text.indexOf('A short film.')).toBeLessThan(text.indexOf(RECALLED))
    expect(text.indexOf(RECALLED)).toBeLessThan(text.indexOf('Space: image.'))
  })

  it('says nothing at all when nothing was learned', () => {
    expect(studioBriefing({ room: NARROW }).text).not.toContain('learned about this project')
  })

  /**
   * 🛑 The order the whole budget rests on. The memory is the one block the studio can recompute
   * at will; the state is what the person is looking at, and a model without it loses its bearings.
   */
  it('gives ground before the state does, which comes through whole', () => {
    const state = 'Studio now:\n  Space: image.\n  In front: "A picture" (image).'
    const recalled = ['  one', '  two', '  three', '  four'].join('\n')
    const full = studioBriefing({ recalled, state, targets: SATURATED, room: WIDE }).text

    const squeezed = studioBriefing({
      recalled,
      state,
      targets: SATURATED,
      room: full.length - 20,
    }).text

    // The state INTACT is the claim. That the memory shrank is not: every later step recomposes
    // with the shortened memory, so it shrinks whichever block gave ground first.
    expect(squeezed).toContain('In front: "A picture"')
    expect(squeezed).not.toContain('  four')
  })

  /** Cut by whole lines, so half a decision never reads as a different decision. */
  it('never cuts a summary in half', () => {
    const recalled = ['  a decision about the rail', '  another about the palette'].join('\n')
    const full = studioBriefing({ recalled, room: WIDE }).text
    const squeezed = studioBriefing({ recalled, room: full.length - 10 }).text

    expect(squeezed).toContain('  a decision about the rail')
    expect(squeezed).not.toContain('another about')
  })
})
