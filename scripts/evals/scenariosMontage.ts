import type { Scenario } from './run'
import * as read from './oracle'
import { cutMontage, montage, soundBed, twoSounds } from './setups'

/** Sections 15 to 17: a video montage, its sound, and a montage of sound alone. */

export const MONTAGE_SCENARIOS: readonly Scenario[] = [
  // ——— 15. Montage vidéo ———
  {
    name: '15.1 adds the first video on V1 at the start',
    said: ['Ajoute ma première vidéo sur la piste V1 au début de la timeline.'],
    setup: montage(),
    passed: run => read.clips(run).length === 1 && read.near(read.clips(run)[0]?.start ?? -1, 0),
  },
  {
    name: '15.2 adds a second video right after the first',
    said: ['Ajoute une deuxième vidéo juste après la première.'],
    setup: studio => {
      montage()(studio)
      studio.run('clip.add', {
        trackId: studio.front()?.tracks[0]?.id ?? '',
        assetId: read.assetOf(studio, 'a drone shot over the sea.mp4'),
        start: 0 * read.SECOND,
      })
    },
    passed: run => {
      const after = read.clips(run).find(one => one.start > 0)
      return read.clips(run).length === 2 && read.lasts(after?.start ?? -1, 6)
    },
  },
  {
    name: '15.3 cuts the first two seconds off the first clip',
    said: ['Coupe les deux premières secondes du premier clip.'],
    setup: cutMontage,
    passed: run => {
      const first = read.clips(run).find(one => one.start === 0 || one.offset > 0)
      return (
        first !== undefined &&
        read.near(first.offset, 2, 0.01) &&
        read.near(first.duration, 4, 0.01)
      )
    },
  },
  {
    name: '15.4 moves the second clip to start right after the first',
    said: ['Déplace le deuxième clip pour qu’il commence immédiatement après le premier.'],
    setup: studio => {
      cutMontage(studio)
      const montage = studio.front()
      studio.run('clip.move', {
        clipId: montage?.clips[1]?.id ?? '',
        trackId: montage?.tracks[0]?.id ?? '',
        start: 9 * read.SECOND,
      })
    },
    passed: run => {
      const [first, second] = [...read.clips(run)].sort((a, b) => a.start - b.start)
      return (
        first !== undefined &&
        second !== undefined &&
        read.near(second.start, first.start + first.duration, read.SECOND / 100)
      )
    },
  },
  {
    name: '15.5 adds the boat picture for 3 seconds after the videos',
    said: ['Ajoute mon image du bateau pendant 3 secondes après les vidéos.'],
    setup: cutMontage,
    passed: run => {
      const added = read.clips(run).find(one => one.start >= 10 * read.SECOND)
      return read.clips(run).length === 3 && read.lasts(added?.duration ?? 0, 3)
    },
  },
  {
    name: '15.6 scales the boat picture to fill the frame without distorting it',
    said: ["Mets l'image du bateau à l'échelle pour remplir le cadre sans la déformer."],
    setup: studio => {
      cutMontage(studio)
      studio.run('clip.add', {
        trackId: studio.front()?.tracks[0]?.id ?? '',
        assetId: read.assetOf(studio, 'fais moi un bateau.png'),
        start: 10 * read.SECOND,
      })
    },
    // Read on the CLIP: nothing else in the studio says a picture was fitted to the frame.
    passed: run => read.clips(run).some(one => one.speed !== 1 || one.duration !== 6 * read.SECOND),
  },

  // ——— 16. Audio dans le montage vidéo ———
  {
    name: '16.1 adds the first audio file on A1 at the start',
    said: ['Ajoute mon premier fichier audio sur A1 au début du montage.'],
    setup: cutMontage,
    passed: run => {
      return read.clips(run).some(one => one.trackId === read.audioTrack(run) && one.start === 0)
    },
  },
  {
    name: '16.2 halves its volume',
    said: ['Réduis son volume à 50 %.'],
    setup: soundBed,
    passed: run => read.clips(run).some(one => read.quietedTo(one.gain, 50)),
  },
  {
    name: '16.3 fades it in over a second',
    said: ["Fais un fondu d'entrée d'une seconde."],
    setup: soundBed,
    passed: run => read.clips(run).some(one => read.lasts(one.fadeIn, 1)),
  },
  {
    name: '16.4 fades it out over two seconds',
    said: ['Fais un fondu de sortie de deux secondes.'],
    setup: soundBed,
    passed: run => read.clips(run).some(one => read.lasts(one.fadeOut, 2)),
  },
  {
    name: '16.5 cuts the audio exactly at the montage duration',
    said: ['Coupe l’audio exactement à la durée du montage vidéo.'],
    setup: soundBed,
    // The videos run to 10 s, so the sound has to end there and nowhere else.
    passed: run => {
      const sound = read.clips(run).find(one => one.trackId === read.audioTrack(run))
      const end = read
        .clips(run)
        .filter(one => one.trackId !== read.audioTrack(run))
        .reduce((last, one) => Math.max(last, one.start + one.duration), 0)
      return sound !== undefined && read.near(sound.start + sound.duration, end, read.SECOND / 100)
    },
  },

  // ——— 17. Montage audio ———
  {
    name: '17.1 puts the two audio files on two different tracks',
    said: ['Ajoute mes deux fichiers audio sur deux pistes différentes.'],
    setup: montage('Test Audio', 'audio'),
    passed: run =>
      read.clips(run).length === 2 && new Set(read.clips(run).map(one => one.trackId)).size === 2,
  },
  {
    name: '17.2 starts the second at 3 seconds',
    said: ['Fais commencer le deuxième à 3 secondes.'],
    setup: twoSounds,
    passed: run => read.clips(run).some(one => read.lasts(one.start, 3)),
  },
  {
    name: '17.3 puts the first at 70 percent',
    said: ['Mets le premier à 70 % de volume.'],
    setup: twoSounds,
    passed: run => read.clips(run).some(one => read.quietedTo(one.gain, 70)),
  },
  {
    name: '17.4 puts the second at 40 percent',
    said: ['Mets le deuxième à 40 %.'],
    setup: twoSounds,
    passed: run => read.clips(run).some(one => read.quietedTo(one.gain, 40)),
  },
  {
    name: '17.5 crossfades between the two',
    said: ['Fais un fondu entre les deux morceaux.'],
    setup: studio => {
      montage('Test Audio', 'audio')(studio)
      const tracks = studio.front()?.tracks ?? []
      studio.run('clip.add', {
        trackId: tracks[0]?.id ?? '',
        assetId: read.assetOf(studio, 'a calm ambient pad, loopable.wav'),
        start: 0 * read.SECOND,
      })
      studio.run('clip.add', {
        trackId: tracks[1]?.id ?? '',
        assetId: read.assetOf(studio, 'waves on a wooden hull.wav'),
        start: 6 * read.SECOND,
      })
    },
    // A crossfade is both halves: one going out while the other comes in.
    passed: run =>
      read.clips(run).some(one => one.fadeOut > 0) && read.clips(run).some(one => one.fadeIn > 0),
  },
]
