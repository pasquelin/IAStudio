import {
  mdiArrowExpandHorizontal,
  mdiChartBellCurveCumulative,
  mdiEqualizer,
  mdiPause,
  mdiPlay,
  mdiSkipPrevious,
} from '@mdi/js'
import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { clamp } from '@shared/numeric'
import { MonitorFrame } from '@/design/MonitorFrame'
import { TOOLBAR_LABEL } from '@/design/styles'
import { Timecode } from '@/design/Timecode'
import { Toolbar } from '@/design/Toolbar'
import { paintOn } from '@/engines/core/canvas-2d'
import type { Size } from '@/engines/core/geometry'
import { paintProgram, programViewport, readProgramPalette } from '@/engines/timeline/program-wave'
import { xToTime, type Viewport } from '@/engines/timeline/timeline-geometry'
import { clampViewport, revealTime } from '@/engines/timeline/viewport'
import { useTimelineWheel } from '@/hooks/useTimelineWheel'
import {
  sequenceDuration,
  type Clip,
  type SequenceState,
  type Us,
} from '@/engines/timeline/timeline-state'
import { useRepaintOnResize } from '@/hooks/useRepaintOnResize'
import { usePeaks } from '@/stores/peaks'
import { OutputMeter } from './OutputMeter'
import { SpectrumBand } from './SpectrumBand'
import type { SoundTransport } from './useSoundTransport'

export type ProgramMonitorProps = {
  sequence: SequenceState
  transport: SoundTransport
  /** Where a click on the wave puts the head. Scrubbing a montage is not an edit. */
  onSeek: (time: Us) => void
}

/**
 * The montage, end to end, and where the head stands in it.
 *
 * The programme half of the pair, and the answer to "what am I making": the strip below lays the
 * same clips out in time, this shows what they add up to. It draws from the same peaks the strip
 * draws from, so the two can never disagree about what is there.
 *
 * It OPENS on the whole montage and can be zoomed into from there — ten minutes of music fitted
 * to a panel is a green band with no shape in it, which answers "what am I making" with nothing.
 */
export function ProgramMonitor({ sequence, transport, onSeek }: ProgramMonitorProps) {
  const { t } = useTranslation()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  /**
   * The view, or null while it is still the whole montage — which is what makes the fit hold as
   * the montage grows, where a viewport computed once would freeze on the length it was built at.
   *
   * Its own rather than the strip's `timeline-view`: the two surfaces are not the same width, so
   * one viewport would put them at the same SCALE showing different spans, and a wheel over the
   * monitor would drag the strip under it.
   */
  const [zoom, setZoom] = useState<Viewport | null>(null)
  // Written on paint, which is the only place the box is known — and read by the wheel and the
  // playhead, neither of which is allowed to force a layout of its own.
  const box = useRef<Size>({ width: 0, height: 0 })
  /**
   * Folded away to start with. It is the third reading of one panel, and the two above it are
   * the ones a montage is judged on — an analyser opened by default would be the very crowding
   * this monitor was asked to avoid.
   */
  const [spectrum, setSpectrum] = useState(false)
  /**
   * The envelope, on unless it is taken away. Shown by default because it costs no room — it is
   * drawn inside the wave — but it answers a question about dynamics that not every pass is
   * asking, and it crosses the crests one may be reading instead.
   */
  const [curves, setCurves] = useState(true)
  // Read on paint rather than subscribed to: a waveform arriving is a repaint, never a render.
  const latest = useRef(sequence)

  const peaksOf = useCallback((clip: Clip): Float32Array | null => {
    const peaks = usePeaks.getState()
    peaks.request(clip.assetId)
    return peaks.byAsset[clip.assetId] ?? null
  }, [])

  // Read on paint like the montage beside it, and for the same reason: what a wheel changes is
  // the picture, never the markup.
  const view = useRef(zoom)

  /**
   * The view at a given width, the width being the caller's to supply: the fit depends on it, and
   * both callers already hold one — the painter its box, a click its bounding rect. Reading it
   * here instead would force a layout per frame.
   */
  const viewportFor = useCallback(
    (width: number): Viewport => view.current ?? programViewport(latest.current, width),
    [],
  )

  /**
   * The surface as it stands, for the gestures — a wheel notch, a click. It forces a layout, which
   * is why the frame loop reads `box` instead: the box is only true once something has been
   * painted, and a wheel can arrive before that (a panel just unfolded, a tab just shown).
   */
  const measure = useCallback(
    (): Size => canvasRef.current?.getBoundingClientRect() ?? { width: 0, height: 0 },
    [],
  )

  const paint = useCallback((): void => {
    paintOn(canvasRef.current, (context, size) => {
      box.current = size
      const palette = readProgramPalette()
      paintProgram(
        context,
        latest.current,
        peaksOf,
        size,
        // The one entry the theme does not decide: absent, the curves are not drawn.
        curves ? { ...palette, envelope: palette.background } : palette,
        viewportFor(size.width),
      )
    })
  }, [peaksOf, curves, viewportFor])

  /**
   * The view sits in this effect beside the montage, and that is load-bearing: it is read on
   * paint rather than rendered, so nothing else would repaint after a wheel — and a montage that
   * is not playing has no other reason to repaint at all.
   *
   * Re-bounded against the montage as it lands, because the montage is what the bound is made of:
   * zoomed into the fourth minute of a five-minute piece and then cut back to thirty seconds, the
   * view was left looking past the end — chassis, no playhead, and every click on it landing at
   * the last frame.
   */
  useEffect(() => {
    latest.current = sequence
    view.current = zoom && clampViewport(zoom, sequence, box.current)
    paint()
  }, [sequence, zoom, paint])

  // One waveform lands at a time, each after the frame that asked for it.
  useEffect(() => usePeaks.subscribe(paint), [paint])

  useRepaintOnResize(canvasRef, paint)

  /**
   * Native and non-passive, through the very hook the strip and the dope sheet wear: one wheel
   * vocabulary over every surface that lays time out sideways.
   *
   * A gesture that moves nothing leaves the view fitted, and that is not a nicety: `scrollBy`
   * hands back a fresh object whatever it did, so a wheel over a montage with nowhere to scroll
   * would have dropped the monitor out of its fit — and out of following the montage's length —
   * for a scroll of zero pixels.
   */
  useTimelineWheel(
    canvasRef,
    useCallback(() => viewportFor(measure().width), [viewportFor, measure]),
    useCallback(
      (next: Viewport) => {
        const box = measure()
        const current = viewportFor(box.width)
        const clamped = clampViewport(next, latest.current, box)
        // Only a ZOOM leaves the whole montage. The strip lets a fitted view scroll on — there is
        // room past the end to drop a clip into — but this monitor has nothing to drop and
        // nothing past the end to show, so a wheel there would slide the montage off its own
        // surface for no gain, and quietly stop the fit from following the montage's length.
        if (clamped.scale === current.scale && view.current === null) return
        if (clamped.scale !== current.scale || clamped.offset !== current.offset) setZoom(clamped)
      },
      [viewportFor, measure],
    ),
    // One lane, so a plain wheel scrolls sideways: this monitor sums every track into a single
    // wave, and a vertical delta swallowed here is a mouse that cannot scroll it at all.
    { rows: false },
  )

  /**
   * Playback drags the view along, but only once the head has left it — and only while zoomed in.
   * Fitted to the width there is nowhere to scroll to, and `revealTime` hands the same viewport
   * back rather than writing one.
   */
  useEffect(() => {
    if (!view.current || box.current.width === 0) return

    const revealed = revealTime(view.current, sequence.playhead, box.current.width)
    if (revealed !== view.current) setZoom(revealed)
  }, [sequence.playhead])

  const onTool = (id: string): void => {
    if (id === 'rewind') return transport.rewind()
    if (id === 'spectrum') return setSpectrum(open => !open)
    if (id === 'curves') return setCurves(shown => !shown)
    // Back to null rather than to a computed fit: null is what keeps the view whole as the
    // montage grows under it.
    if (id === 'fit') return setZoom(null)
    transport.toggle()
  }

  const seek = (event: PointerEvent<HTMLCanvasElement>): void => {
    const canvas = canvasRef.current
    if (!canvas) return

    const bounds = canvas.getBoundingClientRect()
    const at = xToTime(event.clientX - bounds.left, viewportFor(bounds.width))
    onSeek(clamp(at, 0, sequenceDuration(latest.current)))
  }

  return (
    <MonitorFrame
      role={t('transport.programRole')}
      toolbar={
        <Toolbar
          orientation="horizontal"
          tools={[
            { id: 'rewind', labelKey: 'transport.rewind', icon: mdiSkipPrevious },
            {
              id: 'play',
              labelKey: transport.playing ? 'transport.pause' : 'transport.play',
              icon: transport.playing ? mdiPause : mdiPlay,
              shortcut: t('keys.Space'),
            },
            {
              id: 'fit',
              labelKey: 'transport.fit',
              descriptionKey: 'transport.fitHint',
              icon: mdiArrowExpandHorizontal,
              // Armed while the view IS the whole montage, so the button says where one stands
              // rather than only what it would do.
              pressed: zoom === null,
              separatorBefore: true,
            },
            {
              id: 'curves',
              labelKey: 'transport.envelope',
              descriptionKey: 'transport.envelopeHint',
              icon: mdiChartBellCurveCumulative,
              pressed: curves,
              separatorBefore: true,
            },
            {
              id: 'spectrum',
              labelKey: 'transport.spectrum',
              descriptionKey: 'transport.spectrumHint',
              icon: mdiEqualizer,
              pressed: spectrum,
            },
          ]}
          activeTool={transport.playing ? 'play' : undefined}
          onTool={onTool}
          extras={
            <>
              <span className={TOOLBAR_LABEL}>{t('transport.program')}</span>
              <Timecode time={sequence.playhead} fps={sequence.settings.fps} />
            </>
          }
        />
      }
    >
      {/* No gutter between the wave and the spectrum under it: the spectrum wears the toolbar's
          own fill, so the change of ground is what separates them — a gap as well would read as
          two panels where there is one monitor. */}
      <div className="absolute inset-0 flex flex-col">
        {/* The meter beside the wave rather than over it: the wave is clicked to seek, and a
            surface one drags on has no room for a strip that is only ever read. */}
        <div className="flex min-h-0 flex-1 gap-(--sc-gutter)">
          <canvas ref={canvasRef} className="h-full min-w-0 flex-1" onPointerDown={seek} />
          <OutputMeter tap={transport.tap} playing={transport.playing} />
        </div>
        {spectrum && <SpectrumBand tap={transport.tap} playing={transport.playing} />}
      </div>
    </MonitorFrame>
  )
}
