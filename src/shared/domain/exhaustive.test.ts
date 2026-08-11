import { describe, expect, it } from 'vitest'
import { LOG_SCOPES, type LogScope } from '../ipc'
import {
  ACTIVITY_LEVELS,
  ACTIVITY_TOPICS,
  type ActivityLevel,
  type ActivityTopic,
} from './activity'
import { ASSET_BADGES, ASSET_TYPES, type AssetBadge, type AssetType } from './asset'
import {
  GRAPH_COMPILE_PROBLEMS,
  GRAPH_RUN_FAILURES,
  GRAPH_RUN_STATUSES,
  type GraphCompileProblem,
  type GraphRunFailure,
  type GraphRunStatus,
} from './graph'
import {
  MODEL_FAMILIES,
  MODEL_PERIODS,
  MODEL_SORTS,
  type ModelFamily,
  type ModelPeriod,
  type ModelSort,
} from './model'
import { TEXTURE_SLOTS, type TextureSlot } from './scene'
import { NAMED_KEYS, type NamedKey } from './shortcut'

/**
 * Each of these lists is walked to check something else — the i18n bundles above all, which are
 * verified key by key against them. A value missing from a list is therefore not caught by the
 * check that reads it: the walk simply never reaches it, and the gap reads as coverage.
 *
 * TypeScript cannot say on its own that an array covers its union. A `Record<Union, true>` can:
 * adding a member without listing it here stops compiling. The comparison then ties the list to
 * that record, so neither can drift alone.
 *
 * `job.ts` and `media.ts` keep theirs in their own test files, beside the behaviour they also
 * check. These have no such file to live in.
 */
const sorted = (values: readonly string[]): readonly string[] => [...values].sort()

describe('the lists that stand for a union', () => {
  it('names every asset type', () => {
    const all: Record<AssetType, true> = {
      image: true,
      video: true,
      audio: true,
      mesh: true,
      texture: true,
      skybox: true,
    }

    expect(sorted(ASSET_TYPES)).toEqual(sorted(Object.keys(all)))
  })

  it('names every badge an asset can wear', () => {
    const all: Record<AssetBadge, true> = {
      'local-only': true,
      synced: true,
      'to-push': true,
      'to-pull': true,
      conflict: true,
      error: true,
      'other-account': true,
    }

    expect(sorted(ASSET_BADGES)).toEqual(sorted(Object.keys(all)))
  })

  it('names every model family', () => {
    const all: Record<ModelFamily, true> = {
      image: true,
      video: true,
      '3d': true,
      audio: true,
      texture: true,
      skybox: true,
      upscale: true,
      'background-removal': true,
      vectorization: true,
      other: true,
    }

    expect(sorted(MODEL_FAMILIES)).toEqual(sorted(Object.keys(all)))
  })

  it('names every period and every order the model list offers', () => {
    const periods: Record<ModelPeriod, true> = { day: true, week: true, month: true, quarter: true }
    const sorts: Record<ModelSort, true> = { relevance: true, recent: true, oldest: true }

    expect(sorted(MODEL_PERIODS)).toEqual(sorted(Object.keys(periods)))
    expect(sorted(MODEL_SORTS)).toEqual(sorted(Object.keys(sorts)))
  })

  it('names every level and every topic the journal files a line under', () => {
    const levels: Record<ActivityLevel, true> = { info: true, warn: true, error: true }
    const topics: Record<ActivityTopic, true> = {
      generation: true,
      import: true,
      library: true,
      document: true,
      project: true,
      shell: true,
    }

    expect(sorted(ACTIVITY_LEVELS)).toEqual(sorted(Object.keys(levels)))
    expect(sorted(ACTIVITY_TOPICS)).toEqual(sorted(Object.keys(topics)))
  })

  // The one that already cost a bug: `font.face` shipped without its line and read as its key.
  it('names every scope the renderer can report a failure under', () => {
    const all: Record<LogScope, true> = {
      'scene.model': true,
      'scene.bvh': true,
      'scene.texture': true,
      'scene.export': true,
      'scene.render': true,
      'texture.map': true,
      'texture.channel': true,
      'texture.seam': true,
      'texture.shader': true,
      'texture.export': true,
      'skybox.source': true,
      'skybox.export': true,
      'canvas.layer': true,
      'image.export': true,
      'document.load': true,
      'document.save': true,
      'document.close': true,
      'document.delete': true,
      'assets.reveal': true,
      'assets.open': true,
      'font.face': true,
      'graph.node': true,
      'graph.run': true,
      'graph.compile': true,
      'graph.export': true,
      'graph.publish': true,
      'graph.import': true,
      'shell.render': true,
      'shell.layout': true,
    }

    expect(sorted(LOG_SCOPES)).toEqual(sorted(Object.keys(all)))
  })

  it('names every key that is a word rather than a glyph', () => {
    const all: Record<NamedKey, true> = {
      Space: true,
      Enter: true,
      Escape: true,
      Delete: true,
      Backspace: true,
      Tab: true,
      Home: true,
      End: true,
      PageUp: true,
      PageDown: true,
    }

    expect(sorted(NAMED_KEYS)).toEqual(sorted(Object.keys(all)))
  })

  it('names every texture slot a material carries', () => {
    const all: Record<TextureSlot, true> = {
      map: true,
      normalMap: true,
      roughnessMap: true,
      metalnessMap: true,
      aoMap: true,
    }

    expect(sorted(TEXTURE_SLOTS)).toEqual(sorted(Object.keys(all)))
  })
  /**
   * The one the bundles hang off: `bundles.test.ts` demands a sentence for every code the LIST
   * holds, so a code added to the union alone would reach the screen under its own key with every
   * suite green.
   */
  it('names every reason a graph would not compile', () => {
    const all: Record<GraphCompileProblem, true> = {
      'no-output': true,
      empty: true,
      invalid: true,
      'loop-end-outside': true,
      'loop-two-ends': true,
    }

    expect(sorted(GRAPH_COMPILE_PROBLEMS)).toEqual(sorted(Object.keys(all)))
  })

  /**
   * Same hazard one surface further in, and this one drops the state instead of misnaming it:
   * `asRun` in `GraphNodes.tsx` reads a failure back through this list, so a code dropped from it
   * paints a node that failed with no mention at all — while `bundles.test.ts`, which walks the
   * list to demand its sentences, stops demanding the one it can no longer see.
   */
  it('names every reason a node produced nothing', () => {
    const all: Record<GraphRunFailure, true> = {
      cycle: true,
      unsupported: true,
      unwired: true,
      'no-model': true,
      blocked: true,
      rejected: true,
      declined: true,
      'invalid-expression': true,
    }

    expect(sorted(GRAPH_RUN_FAILURES)).toEqual(sorted(Object.keys(all)))
  })

  /** `asRun` reads this one four lines above the other, and it had no guard of its own. */
  it('names every state a running node reports', () => {
    const all: Record<GraphRunStatus, true> = {
      idle: true,
      queued: true,
      running: true,
      awaiting: true,
      cached: true,
      done: true,
      skipped: true,
      failed: true,
    }

    expect(sorted(GRAPH_RUN_STATUSES)).toEqual(sorted(Object.keys(all)))
  })
})
