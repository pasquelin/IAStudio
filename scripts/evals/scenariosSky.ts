import type { FakeStudio } from './fakeStudio'
import type { Run, Scenario } from './run'
import * as read from './oracle'

/**
 * Sections 37 and 38: the two surfaces the studio edits a LOOK on rather than a scene.
 *
 * 🛑 Both decors open by their SPACE, never by a file: `spaceOfFile` reads a `.png` as an image
 * whatever folder it sits in, so opening `Skyboxes/…png` puts an image document in front and
 * every `skybox.*` call is refused `wrongSurface` before a handler sees it.
 */

const sky =
  (title = 'Ciel Test') =>
  (studio: FakeStudio): void => {
    studio.run('workspace.open', { workspace: 'skyboxes', createDocument: true, title })
  }

const material =
  (title = 'Matière Test') =>
  (studio: FakeStudio): void => {
    studio.run('workspace.open', { workspace: 'textures', createDocument: true, title })
  }

const skyOf = (run: Run) => read.inSpace(run, 'skyboxes')[0]?.skybox

const surfaceOf = (run: Run) => read.inSpace(run, 'textures')[0]

export const SKY_SCENARIOS: readonly Scenario[] = [
  {
    name: '37.1 says which picture the sky uses and how bright it is',
    said: ['Quelle image sert de ciel en ce moment, et à quelle intensité ?'],
    setup: sky(),
    passed: run => read.spoke(run) && read.answeredWith(run, 'skybox.state'),
  },
  {
    name: '37.2 uses the first skybox of the project as the sky picture',
    said: ['Utilise ma première skybox comme image de ce ciel.'],
    setup: sky(),
    passed: run => (skyOf(run)?.source ?? null) !== null,
  },
  {
    name: '37.3 raises the sun to an intensity of 3',
    said: ["Monte l'intensité du soleil à 3."],
    setup: sky(),
    passed: run => read.near(skyOf(run)?.sunIntensity ?? 0, 3, 0.01),
  },
  {
    name: '37.4 lowers the environment intensity to 0.4',
    said: ["Réduis l'intensité de l'environnement du ciel à 0,4."],
    setup: sky(),
    passed: run => read.near(skyOf(run)?.environmentIntensity ?? 0, 0.4, 0.01),
  },
  {
    name: '37.5 warms the sky up on contrast and saturation',
    said: ['Augmente le contraste et la saturation de ce ciel.'],
    setup: sky(),
    passed: run => skyOf(run)?.adjusted === true,
  },
  {
    name: '37.6 puts the colour adjustments back to neutral',
    said: ['Remets les réglages colorimétriques du ciel à zéro.'],
    // Adjusted before the person speaks, or « remets à zéro » sorts nothing and a model doing
    // nothing at all would pass.
    setup: studio => {
      sky()(studio)
      studio.run('skybox.adjust', { contrast: 1.4, saturation: 1.2 })
    },
    passed: run => skyOf(run)?.adjusted === false,
  },
  {
    name: '37.7 shows the light probes of the sky',
    said: ['Affiche les sondes de lumière de ce ciel.'],
    setup: sky(),
    passed: run => read.answeredWith(run, 'skybox.view'),
  },

  {
    name: '38.1 says what the material is made of and which pictures it carries',
    said: ['De quoi est faite cette matière et quelles images porte-t-elle ?'],
    setup: material(),
    passed: run => read.spoke(run) && read.answeredWith(run, 'texture.state'),
  },
  {
    name: '38.2 turns its base colour blue',
    said: ['Mets sa couleur de base en bleu.'],
    setup: material(),
    passed: run => (surfaceOf(run)?.material ?? null) !== null,
  },
  {
    name: '38.3 assigns the project planks to its base colour channel',
    said: ['Assigne ma texture de planches à son canal de couleur de base.'],
    setup: material(),
    passed: run => Object.keys(surfaceOf(run)?.channels ?? {}).length > 0,
  },
  {
    name: '38.4 adds the matching normal map on its own channel',
    said: ['Ajoute la normal map correspondante sur son canal de relief.'],
    // One channel already filled, so « la normal map » is a SECOND one and not the first.
    setup: studio => {
      material()(studio)
      studio.run('texture.channel', {
        channel: 'baseColor',
        assetId: read.assetOf(studio, 'weathered oak planks, seamless.png'),
      })
    },
    passed: run => Object.keys(surfaceOf(run)?.channels ?? {}).length >= 2,
  },
  {
    name: '38.5 brightens the preview environment and sets it spinning',
    said: ["Fais tourner l'aperçu de la matière et monte l'intensité de son environnement."],
    setup: material(),
    passed: run => read.answeredWith(run, 'texture.preview'),
  },
]
