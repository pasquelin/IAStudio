# Captures d'écran

Les images référencées par le README et par les deux guides. Tant qu'un fichier manque, son
emplacement reste visible dans le markdown sous forme de commentaire HTML — rien ne casse.

## Ce qui est attendu

| Fichier | Sujet | Où il est utilisé |
|---|---|---|
| `studio-3d.png` | Le studio dans l'espace 3D : rails aux deux bords, vue de scène au centre, arbre de scène et maillages à gauche, modèles à droite, étagère à assets en bas | `README.md` (bandeau) |
| `studio-image.png` | L'espace Image : pile de calques, volet d'un groupe d'outils ouvert | `README.md` |
| `settings-account.png` | La fenêtre de Réglages, section Compte, état authentifié visible | les deux guides utilisateur |
| `models-grid.png` | Le panneau Modèles en grille, facettes ouvertes | les deux guides utilisateur |
| `generate.png` | Le panneau Génération avec le formulaire d'un modèle, et la bande Jobs avec un job en cours | les deux guides utilisateur |
| `image-tools.png` | Un document image, volet du groupe Forme ouvert, pile de calques visible | les deux guides utilisateur |
| `scene-3d.png` | La vue 3D avec un maillage sélectionné, l'arbre de scène et le panneau Maillages | les deux guides utilisateur |
| `timeline.png` | L'espace Vidéo : timeline avec plusieurs clips, moniteur au-dessus | les deux guides utilisateur |

## Conventions

- **PNG**, thème sombre, densité confort.
- **2560 × 1600** pour les vues plein écran, recadrées au panneau pour les vues de détail.
- Fenêtre sans ombre portée du système : l'ombre se voit mal sur le fond clair de GitHub.
- Un projet réel ouvert, avec de vrais assets — une fenêtre vide ne montre rien de ce que le
  logiciel sait faire.
- Aucun identifiant, aucun jeton, aucun chemin personnel lisible à l'écran. La section Compte se
  capture avec des champs remplis mais masqués.

## Comment les prendre

`pnpm start:debug` lance l'application avec le port de debug 9222 ouvert, ce qui permet de
piloter la fenêtre et de déclencher les captures depuis l'extérieur plutôt qu'à la main.
