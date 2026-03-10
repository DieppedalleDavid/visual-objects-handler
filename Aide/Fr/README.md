# Documentation VOH v2 — Guide de maintenance

## Comment ouvrir la documentation

Ouvrir le fichier `Aide/Fr/index.html` dans un navigateur.
C'est le seul point d'entrée — tout le reste est chargé automatiquement dedans.


## Comment ça fonctionne

La documentation utilise un système **sidebar + iframe** :

- **`index.html`** : Cadre principal. Contient la sidebar de navigation à gauche et un iframe à droite.
  La sidebar ne se recharge jamais, seul le contenu de l'iframe change quand on clique sur un lien.

- **`accueil.html`** : Page d'accueil affichée par défaut dans l'iframe avec des cartes cliquables.

- **`styles/doc-style.css`** : CSS partagé par toutes les pages de contenu. Chaque page HTML
  dans l'iframe inclut ce fichier avec un `<link rel="stylesheet">`. Modifier ce fichier
  change l'apparence de TOUTES les pages d'un coup.


## Arborescence

```
Aide/Fr/
├── index.html                      ← Point d'entrée (ne PAS renommer)
├── accueil.html                    ← Page d'accueil
├── README.md                       ← Ce fichier
│
├── styles/
│   └── doc-style.css               ← CSS partagé par toutes les pages
│
├── scripts/
│   └── doc-nav.js                  ← Navigation inter-pages (postMessage)
│
├── demarrage/                      ← Section Démarrage
│   ├── demarrage-rapide.html
│   ├── architecture.html
│   ├── structure-projet.html
│   ├── editeur-execution.html
│   └── utilisation-standalone.html
│
├── editeur/                        ← Section Éditeur
│   ├── fonctionnalites.html
│   └── raccourcis.html
│
├── api-zone/                       ← voh.zone (10 pages)
│   ├── creation.html
│   ├── zone-active.html
│   ├── informations.html
│   ├── dimensions.html
│   ├── nom.html
│   ├── fond.html
│   ├── grille.html
│   ├── viewport.html
│   ├── zoom.html
│   └── bordure.html
│
├── api-canvas/                     ← voh.canvas + voh.canvas.pages (23 pages)
│   ├── creation.html
│   ├── canvas-actif.html
│   ├── informations.html
│   ├── nom.html
│   ├── position.html
│   ├── dimensions.html
│   ├── z-order.html
│   ├── verrouillage.html
│   ├── visibilite.html
│   ├── opacite.html
│   ├── evenements.html
│   ├── selection.html              ← voh.canvas.selection
│   ├── historique.html             ← voh.canvas.history (raccourci page active)
│   ├── pages.html                  ← voh.canvas.pages (navigation)
│   ├── pages-dimensions.html
│   ├── pages-fond.html
│   ├── pages-bordure.html
│   ├── pages-grille.html
│   ├── pages-selection.html
│   ├── pages-curseur.html
│   └── pages-historique.html       ← voh.canvas.pages.history (avec pageId)
│
├── api-objects/                    ← voh.objects (12 pages)
│   ├── creation.html
│   ├── informations.html
│   ├── nom.html
│   ├── position.html
│   ├── dimensions.html
│   ├── z-order.html
│   ├── verrouillage.html
│   ├── visibilite.html
│   ├── opacite.html
│   ├── couleur-fond.html
│   ├── drawing-callback.html
│   └── evenements.html
│
├── api-events/                     ← Événements (abonnements + détails)
│   ├── abonnements.html
│   └── evenements-zone.html
│
├── api-diagnostics/                ← voh.diagnostics
│   └── diagnostics.html
│
├── api-history/                    ← voh.history global (à venir)
│   └── a-venir.html
├── api-grid/                       ← voh.grid global (à venir)
│   └── a-venir.html
├── api-connections/                ← voh.connections (à venir)
│   └── a-venir.html
│
└── reference/                      ← Section Référence
    └── constantes.html
```


## Comment ajouter une nouvelle page de contenu

### 1. Créer le fichier HTML

Créer un fichier `.html` dans le bon dossier (par exemple `api-canvas/creation.html`).
Le fichier doit commencer par ce squelette :

```html
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <link rel="stylesheet" href="../styles/doc-style.css">
    <title>Titre — VOH Documentation</title>
</head>
<body>

<h1>Titre de la page</h1>
<p class="intro">Description courte.</p>

<!-- Contenu ici -->

</body>
</html>
```

**Important** : Le chemin vers le CSS dépend de la profondeur du fichier :
- Fichier dans un sous-dossier (ex: `api-zone/fond.html`) → `href="../styles/doc-style.css"`
- Fichier à la racine (ex: `accueil.html`) → `href="styles/doc-style.css"`

### 2. Ajouter le lien dans la sidebar

Ouvrir `index.html` et ajouter une ligne dans la section `<div class="tree-children">` du dossier concerné :

```html
<a class="tree-page" data-page="api-canvas/creation.html" onclick="_navigateTo(this)">
    <span class="tree-page-icon">📄</span> Création / Suppression
</a>
```

Le `data-page` est le chemin relatif depuis le dossier `Aide/Fr/`.


## Comment ajouter une nouvelle section (dossier)

### 1. Créer le dossier et au moins une page dedans

### 2. Ajouter dans la sidebar de `index.html` :

```html
<!-- ── voh.nouveau ── -->
<div class="tree-folder" onclick="_toggleFolder(this)">
    <span class="tree-folder-icon">📂</span> voh.nouveau
</div>
<div class="tree-children">
    <a class="tree-page" data-page="api-nouveau/page.html" onclick="_navigateTo(this)">
        <span class="tree-page-icon">📄</span> Nom de la page
    </a>
</div>
```


## Classes CSS disponibles pour le contenu

| Classe | Usage |
|--------|-------|
| `.intro` | Paragraphe d'introduction gris sous le h1 |
| `.method` | Bloc encadré pour documenter une méthode |
| `.method-name` | Nom de la méthode (police monospace bleue) |
| `.method-description` | Description de la méthode |
| `.method-return` | Ligne "Retourne : ..." |
| `.return-type` | Type de retour (vert monospace) |
| `.param-table` | Tableau de paramètres (dans un `.method`) |
| `.note` | Bloc de note bleu avec bordure gauche |
| `.kw` | Mot-clé (bleu) |
| `.fn` | Fonction (bleu) |
| `.str` | Chaîne de caractères (orange) |
| `.num` | Nombre (violet) |
| `.cmt` | Commentaire (gris) |
| `.var` | Variable (vert) |
| `.tag` | Balise HTML (rouge) |


## Icônes utilisées dans la sidebar

| Icône | Signification |
|-------|---------------|
| 🏠 | Page d'accueil |
| 📂 | Dossier ouvert |
| 📁 | Dossier fermé |
| 📄 | Page de contenu |


## Règle de découpage

Chaque fichier de contenu devrait contenir **15-20 méthodes maximum**.
Si une sous-catégorie dépasse cette limite, la découper en plusieurs fichiers.
