import type { FakeStudio } from './fakeStudio'
import { assetOf, SECOND } from './oracle'

/**
 * The decors a section names in prose — « Dans la scène Test MCP », « Sur une copie de l'image du
 * bateau ». Laid out by the BENCH, never by the model: a scenario scores ONE request, and making
 * the model rebuild the whole section first would score the same step forty times.
 */

export const scene =
  (title = 'Test MCP') =>
  (studio: FakeStudio): void => {
    studio.run('workspace.open', { workspace: '3d', createDocument: true, title })
  }

/** A scene with a plain block in it, which the six material scenarios of section 12 act on. */
export const blockScene = (studio: FakeStudio): void => {
  scene()(studio)
  studio.run('node.add', { kind: 'box', name: 'Bloc' })
}

/** A scene holding the cube every section from 6 onwards talks about. */
export const cubeScene = (studio: FakeStudio): void => {
  scene()(studio)
  studio.run('node.add', { kind: 'box', name: 'Cube Test' })
}

export const withSphere = (studio: FakeStudio): void => {
  cubeScene(studio)
  studio.run('node.add', { kind: 'sphere', name: 'Sphere Droite' })
}

export const twoSpheres = (studio: FakeStudio): void => {
  withSphere(studio)
  studio.run('node.add', { kind: 'sphere', name: 'Sphere Gauche' })
}

export const litScene = (studio: FakeStudio): void => {
  cubeScene(studio)
  studio.run('node.add', { kind: 'directional', name: 'Soleil Test' })
}

export const cameraScene = (studio: FakeStudio): void => {
  cubeScene(studio)
  studio.run('node.add', { kind: 'camera', name: 'Camera Test' })
}

/** A scene with the project's knight in it — sections 11 and 12 act on an imported model. */
export const modelScene = (studio: FakeStudio): void => {
  scene()(studio)
  studio.run('node.addModel', {
    assetId: assetOf(studio, 'knight in plate armour, character.glb'),
    name: 'Knight',
  })
}

/** A video montage carries a video row and a sound row; an audio one carries sound rows alone. */
export const montage =
  (title = 'Test Video', workspace: 'video' | 'audio' = 'video') =>
  (studio: FakeStudio): void => {
    studio.run('workspace.open', { workspace, createDocument: true, title })
    if (workspace === 'video') studio.run('track.add', { kind: 'video' })
    studio.run('track.add', { kind: 'audio' })
    if (workspace === 'audio') studio.run('track.add', { kind: 'audio' })
  }

/** One clip of the project laid on a row — `start` in the MICROSECONDS the montage counts in. */
export const laid = (studio: FakeStudio, track: string, ending: string, start: number): void => {
  studio.run('clip.add', { trackId: track, assetId: assetOf(studio, ending), start })
}

/** The nth node, layer, row or clip of the document in front — what a decor names one by. */
export const nodeAt = (studio: FakeStudio, at: number): string =>
  studio.front()?.nodes[at]?.id ?? ''

export const layerAt = (studio: FakeStudio, at: number): string =>
  studio.front()?.layers[at]?.id ?? ''

export const trackAt = (studio: FakeStudio, at: number): string =>
  studio.front()?.tracks[at]?.id ?? ''

export const clipAt = (studio: FakeStudio, at: number): string =>
  studio.front()?.clips[at]?.id ?? ''

/** A montage carrying the project's two videos back to back on V1 — each six seconds long. */
export const cutMontage = (studio: FakeStudio): void => {
  montage()(studio)
  const track = studio.front()?.tracks[0]?.id ?? ''
  laid(studio, track, 'a drone shot over the sea.mp4', 0)
  laid(studio, track, 'a slow pan across the harbour.mp4', 6 * SECOND)
}

/** That montage with a sound bed under it, which five scenarios of section 16 and 24 want. */
export const soundBed = (studio: FakeStudio): void => {
  cutMontage(studio)
  laid(studio, studio.front()?.tracks[1]?.id ?? '', 'a calm ambient pad, loopable.wav', 0)
}

/** Two sounds on two rows of an audio montage — the decor of section 17. */
export const twoSounds = (studio: FakeStudio): void => {
  montage('Test Audio', 'audio')(studio)
  const rows = studio.front()?.tracks ?? []
  laid(studio, rows[0]?.id ?? '', 'a calm ambient pad, loopable.wav', 0)
  laid(studio, rows[1]?.id ?? '', 'waves on a wooden hull.wav', 0)
}

/** The boat picture open as a document, which sections 18 and 19 edit. */
export const boatImage = (studio: FakeStudio): void => {
  studio.run('file.open', { path: 'Images/fais moi un bateau.png' })
  studio.run('layer.add', { name: 'Bateau', kind: 'pixel' })
}

/** That picture with a second layer over it, which five scenarios of section 19 act on. */
export const overlay = (studio: FakeStudio): void => {
  boatImage(studio)
  studio.run('layer.add', { name: 'Overlay Test', kind: 'pixel' })
}

const COPY = 'Images/copie de fais moi un bateau.png'

/** The folders section 4 builds, and the copy it renames — laid out step by step. */
export const testFolders = (studio: FakeStudio): void => {
  studio.run('folder.new', { folder: '', name: 'Tests Assistant' })
  studio.run('folder.new', { folder: 'Tests Assistant', name: 'Images' })
}

/** Those folders plus a copy already named `bateau-test.png`, which 4.5 to 4.7 act on. */
export const namedCopy = (studio: FakeStudio): void => {
  testFolders(studio)
  studio.run('files.duplicate', { paths: ['Images/fais moi un bateau.png'] })
  studio.run('file.rename', { path: COPY, name: 'bateau-test.png' })
}

/** A generation already run — what sections 20 to 22 build the NEXT request on. */
export const generated =
  (family: string, modelId: string, prompt: string) =>
  (studio: FakeStudio): void => {
    studio.run('generator.prepare', { family, modelId, parameters: { prompt } })
    studio.run('generator.submit', {})
  }

export const madeCar = generated('image', 'flux.1-dev', 'a red sports car')
export const madeBoat = generated('image', 'flux.1-dev', 'the boat at night')
export const madeChest = generated('3d', 'mesh-gen-1', 'a wooden chest')

/** That montage carrying BOTH of the project's sounds, one after the other on the sound row. */
export const twoBeds = (studio: FakeStudio): void => {
  soundBed(studio)
  laid(studio, trackAt(studio, 1), 'waves on a wooden hull.wav', 6 * SECOND)
}

/** A model in a scene with a camera by it — what four « imprecise sentence » scenarios act on. */
export const framedModel = (studio: FakeStudio): void => {
  modelScene(studio)
  studio.run('node.add', { kind: 'camera', name: 'Camera' })
}

/** The cube standing three metres up, which the read-then-write scenarios of 26 start from. */
export const raisedCube = (studio: FakeStudio): void => {
  cubeScene(studio)
  studio.run('node.transform', { nodeId: nodeAt(studio, 0), positionY: 3 })
}

/** Soleil Test at an intensity worth doubling — the other half of section 26. */
export const namedSun = (studio: FakeStudio): void => {
  litScene(studio)
  studio.run('node.light', { nodeId: nodeAt(studio, 1), intensity: 3 })
}
