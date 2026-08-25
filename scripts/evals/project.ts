import type { StudioFile } from './fakeStudio'

/**
 * The project the bench runs against — a real one, names included.
 *
 * Names in English under folders named in French, because that is the studio's own shape: a
 * picture is named after the prompt that made it, and the person asks for it in their language.
 * A bench built on tidy names would pass on the very thing the studio gets wrong.
 */
export const PROJECT: readonly StudioFile[] = [
  { path: 'Images', kind: 'folder' },
  { path: '3D', kind: 'folder' },
  { path: 'documents', kind: 'folder' },
  { path: 'Textures', kind: 'folder' },
  { path: 'Videos', kind: 'folder' },
  { path: 'Audio', kind: 'folder' },
  { path: 'Skyboxes', kind: 'folder' },
  { path: 'Images/a beautiful sailing ship, sailboat, on the open sea, green.png', kind: 'file' },
  { path: 'Images/a beautiful sailing ship, sailboat, on the open sea.png', kind: 'file' },
  { path: 'Images/fais moi un chateau.png', kind: 'file' },
  { path: 'Images/fais moi un bateau.png', kind: 'file' },
  { path: 'Images/a bicycle.png', kind: 'file' },
  { path: 'Images/a red sports car in a paris street.png', kind: 'file' },
  { path: '3D/a medieval stone castle with towers.glb', kind: 'file' },
  { path: '3D/a knight in plate armour, character.glb', kind: 'file' },
  { path: 'Videos/a drone shot over the sea.mp4', kind: 'file' },
  { path: 'Videos/a slow pan across the harbour.mp4', kind: 'file' },
  { path: 'Audio/a calm ambient pad, loopable.wav', kind: 'file' },
  { path: 'Audio/waves on a wooden hull.wav', kind: 'file' },
  { path: 'Skyboxes/a clear blue sky at noon.png', kind: 'file' },
  { path: 'Skyboxes/an overcast sky at dusk.png', kind: 'file' },
  { path: 'Textures/weathered oak planks, seamless.png', kind: 'file' },
  { path: 'Textures/weathered oak planks, seamless, normal.png', kind: 'file' },
  { path: 'documents/Charge 2000 blocs.gltf', kind: 'file' },
  { path: 'documents/Scène 1.gltf', kind: 'file' },
  { path: 'documents/demo image.ora', kind: 'file' },
]
