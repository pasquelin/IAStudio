# Espace Textures — ce qui reste

État au 2026-08-07, après le merge de l'étape 3. Les notes de préparation (audit, conflits,
réutilisation) ont été retirées : elles sont consommées, et leurs décisions vivent maintenant
dans le code et ses commentaires.

## Livré

Le document `.tex`, les huit canaux comme domaine, le viewport partagé, l'espace lui-même :
une image glissée devient la couleur de base, la forme se choisit, l'environnement studio
éclaire, et tout s'enregistre dans le dossier du projet.

## Les étapes suivantes

**4 — panneau matériau.** Tous les réglages du § 4 du brief, câblés en direct : rugosité,
métal, relief, tiling, émission. Réutiliser `SliderField`, `NumberField`, `PropertySection`,
`ColorField` — ils existent. Le seul contrôle neuf est le **double curseur de remap**
(`design/RangeField.tsx`), deux poignées sur un rail, plage surlignée.
Le remap rugosité/métal passe par `onBeforeCompile` — vérifier les noms de chunks sur
three 0.185 avant d'écrire, ils bougent entre versions. « Brillance » est l'**inverse** de la
rugosité : inverser à l'affichage, stocker la rugosité.
Une face de plus dans `panels/inspector/`, pas un panneau à part : `main` a posé la règle d'un
inspecteur unique pour tout le studio.

**5 — bande de canaux.** Huit vignettes 96 px (`Thumbnail`, `MediaTile`, `Flyout`/`MenuRow`),
badge généré / dérivé / importé, import de fichier, vue 2D par canal. Un canal dérivé se
recalcule quand sa source change ; un généré est figé — la distinction doit se voir.

**6 — dérivations en shader.** `engines/texture/derive/` : quad plein écran,
`WebGLRenderTarget`, port injectable (jsdom n'a pas de WebGL). Sobel height→normal d'abord.
Aucune boucle JS sur des pixels. Puis « améliorer ce canal » : `model_sc-texture-converter` via
le `JobManager`, jamais un appel direct au SDK. Un job rend six canaux ; `collector.ts` sait
déjà les répartir par `metadata.type`.

**7 — tiling.** Aperçu 1×/2×/4× (multiplicateur local, jamais écrit dans `material.tiling`),
détection de coutures par gradient aux bords, seamless par décalage d'une demi-largeur.
`overlap` et `featherRadius` sont les paramètres de `model_scenario-texture`. Appliqué à tous
les canaux avec les mêmes valeurs, sinon ils se désalignent.

**8 — export.** glTF/GLB, Unity, Unreal, Roblox, canaux bruts. Empaquetage ORM (AO=R,
Roughness=G, Metallic=B) en une passe shader. L'écriture disque passe par le main.
`GLTFExporter` vient de `three/addons`. C'est ici que « aperçu en 1024, export en pleine
résolution » s'applique.

## Dettes ouvertes

**D6 — un document ne se supprime pas depuis l'interface.** Fermer un onglet retire le
descripteur, le fichier reste — ce qui est correct, mais rien n'offre de le supprimer. À faire
avec le menu contextuel d'onglet.

**D7 — rien ne rouvre un document que le layout ne montre pas.** Le listage existe
(`documents.list()`), c'est l'écran qui manque : un explorateur de documents du projet.

## Vérifié à l'écran, et ce qui ne l'est pas

L'espace s'ouvre, le document se crée, la barre d'outils répond, l'état vide s'affiche.
**Non vérifié :** la sphère éclairée et une image posée en couleur de base — le viewport noir
constaté venait de l'environnement studio manquant, corrigé depuis, mais la confirmation
visuelle attend un projet ouvert.
