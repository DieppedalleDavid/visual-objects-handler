# Visual Objects Handler (VOH)

Framework/moteur JavaScript pour créer des éditeurs visuels interactifs.

## Présentation

VOH est un moteur graphique JavaScript qui permet de créer des éditeurs visuels personnalisés avec manipulation d'objets, sélection multiple, déplacement drag & drop, undo/redo par page, multi-canvas, multi-pages, et rendu GPU via Pixi.js.

Le projet est en développement actif (pre-release).

## Installation

1. Téléchargez le **ZIP complet** depuis les [Releases](https://github.com/DieppedalleDavid/visual-objects-handler/releases) (inclut les librairies)
2. Dézippez et ouvrez `Index.html` dans Chrome ou Edge

## Librairies requises

Le dossier `Libraries/` n'est pas inclus dans le dépôt (trop volumineux).
Il est inclus dans le **ZIP des Releases**.

Si vous clonez le dépôt, vous devez télécharger les librairies suivantes et les placer dans le dossier `Libraries/` :

- **Pixi.js** v8 — [pixijs.com](https://pixijs.com/) — Moteur de rendu WebGL (dossier `Libraries/Pixi/`)
- **CodeMirror** v5 — [codemirror.net](https://codemirror.net/5/) — Éditeur de code (dossier `Libraries/CodeMirror/`)
- **TypeScript** — [typescriptlang.org](https://www.typescriptlang.org/) — Compilateur TS (dossier `Libraries/TypeScript/`)

## Structure du projet

- `Core/` — Moteur graphique (13 fichiers JavaScript)
- `Exemples/` — Scripts d'exemples commentés (Zone, Canevas, Objets, Demo)
- `Aide/` — Documentation HTML avec navigation
- `Tests/` — Benchmarks et tests
- `Index.html` — Éditeur de code intégré (CodeMirror)
- `Runner.html` — Exécution des scripts
- `default-script.js` — Script par défaut de l'éditeur (personnalisable)

## Licence

LGPL v3 — Voir [LICENSE](LICENSE)

## Auteur

David Dieppedalle (ShadowStorm)
