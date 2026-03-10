# VOH v5 — Module Canvas : Document de Conception
# ═══════════════════════════════════════════════════
# Date : 1er mars 2026
# Auteur : David Dieppedalle (ShadowStorm)
# Version du document : 1.0


## 1. VUE D'ENSEMBLE

Le canvas est une surface de travail qui vit à l'intérieur d'une zone.
Une zone peut contenir 1 ou plusieurs canvas.
Chaque canvas est indépendant et se comporte comme une fenêtre MDI
(Multiple Document Interface) à l'intérieur de la zone.


## 2. HIÉRARCHIE

```
Zone (conteneur, viewport, scroll, zoom, grille zone décorative, fond, bordure)
│
└── Canvas (position x/y, taille, bordure, arrondis, clipping, z-order, nom, état)
    │
    │── Barre de titre (nom, icône, boutons fermer/minimiser/maximiser)
    │── Poignées de redimensionnement (bords et coins, visibles si canvas actif)
    │
    ├── Page 1 (fond couleur, fond image, grille/snap, objets, connexions, undo/redo)
    ├── Page 2 (fond couleur, fond image, grille/snap, objets, connexions, undo/redo)
    └── Page N (...)
```


## 3. PROPRIÉTÉS DU CANVAS

### 3.1 Identité
- Identifiant unique (généré automatiquement)
- Nom (personnalisable, optionnel)

### 3.2 Position et dimensions
- Position X, Y dans la zone
- Largeur, Hauteur
- Z-order : le dernier canvas créé est au-dessus des autres

### 3.3 Bordure
- Couleur de bordure
- Épaisseur de bordure
- Style de bordure (solide, pointillée, tiretée, etc.)
- Arrondis des coins (rayon)

### 3.4 Ombre portée du canvas
- Décalage X, Décalage Y
- Flou (blur)
- Couleur
- Opacité
- L'ombre suit les arrondis du canvas

### 3.5 Clipping
- Le contenu du canvas (objets, etc.) est clippé aux limites du canvas
- Les objets qui dépassent les bords sont coupés visuellement
- L'arrondi des coins affecte aussi le clipping

### 3.6 Rendu (5 layers Pixi.js)
Chaque canvas possède 1 seul élément WebGL avec 5 containers Pixi.js empilés.
Les layers affichent le contenu de la PAGE ACTIVE du canvas.
Quand on change de page, les layers se rechargent avec le contenu de la nouvelle page.

1. Fond couleur    — la couleur de fond de la page active
2. Fond image      — image optionnelle de la page active, par-dessus la couleur
3. Grille/Snap     — grille d'accrochage de la page active (pour aligner les objets)
4. Objets          — les objets graphiques de la page active
5. Overlay         — poignées des objets, ancres, rectangle de sélection souris

### 3.7 Rendu hybride
- Statique par défaut (pas de boucle de rendu permanente)
- Bascule automatiquement en dynamique quand il y a des GIF animés,
  vidéos ou animations en cours
- Revient en statique quand il n'y a plus d'éléments animés
- Évite de consommer du GPU inutilement

### 3.8 Verrouillage
- Un canvas peut être verrouillé (canvasIsLocked)
- Verrouillé = ne peut être ni déplacé, ni redimensionné par la souris
- Les objets à l'intérieur restent manipulables (le verrou concerne le canvas, pas son contenu)
- L'API peut toujours modifier la position/taille même si verrouillé

### 3.9 Visibilité
- Un canvas peut être masqué (canvasIsVisible)
- Masqué = n'est pas rendu, ne reçoit pas d'événements souris
- Les données (objets, pages, etc.) restent en mémoire

### 3.10 Opacité
- Opacité globale du canvas entier (0.0 à 1.0)
- Affecte tout le contenu (fond, objets, overlay)

### 3.11 Contraintes de taille
- Largeur minimale / Largeur maximale
- Hauteur minimale / Hauteur maximale
- Respectées lors du redimensionnement (souris et API)

### 3.12 Snap à la grille de la zone
- Quand on déplace un canvas dans la zone, il peut s'accrocher à la grille de la zone
- Quand on redimensionne un canvas, la taille peut s'accrocher à la grille de la zone
- Activable/désactivable par canvas (canvasSnapToZoneGrid)

### 3.13 Duplication
- Un canvas peut être dupliqué entièrement (toutes ses pages, objets, connexions, propriétés)
- Le canvas dupliqué reçoit un nouvel identifiant et un nom dérivé (ex: "Mon canvas (copie)")
- Le duplicata est placé avec un léger décalage par rapport à l'original

### 3.14 Export / Import
- Un canvas peut être exporté en JSON (sérialisation complète : propriétés, pages, objets, connexions)
- Un canvas exporté peut être importé dans n'importe quelle zone de n'importe quelle instance VOH
- Permet la sauvegarde/chargement individuel et le transfert entre zones

### 3.15 Curseur de souris
- Curseur personnalisable quand la souris est sur le canvas
- Peut être un curseur standard (pointer, crosshair, etc.) ou une image personnalisée
- Peut varier selon l'état (normal, survol d'un objet, drag, etc.)


## 4. PAGES (par canvas)

### 4.1 Comportement général
- Chaque canvas a ses propres pages
- Une Page 1 est créée automatiquement à la création du canvas
- Une seule page est visible/active à la fois dans un canvas donné
- Chaque page a ses propres dimensions, apparence et contenu (voir 4.2)

### 4.2 Propriétés de chaque page
- Identifiant unique
- Nom
- Dimensions (largeur, hauteur) — chaque page peut avoir sa propre taille
- Couleur de fond
- Image de fond (+ opacité, mode, échelle, rotation, flip, flou)
- Bordure (couleur, épaisseur, style)
- Arrondi des coins (rayon)
- Grille/Snap (taille largeur/hauteur, couleur, opacité, style ligne, visible, snap activable)
- Style du rectangle de sélection souris (couleur fond, couleur bordure, épaisseur bordure, style bordure)
- Activation de la sélection souris (enabled/disabled)
- Bouton souris pour la sélection ('left', 'middle', 'right')
- Curseur (curseur standard ou image personnalisée)
- Objets (liste des objets graphiques)
- Connexions/Liaisons entre objets
- Undo/Redo propre (historique indépendant par page, niveau limitable)

### 4.3 Sélection d'objets
- La sélection d'objets est par canvas (pas par page) → voh.objects.selection.*
- La sélection est VIDÉE automatiquement quand on change de page
- Un seul canvas est éditable à la fois dans toute l'instance VOH
- Le style visuel du rectangle de sélection souris est par page (voir 4.2)
- L'activation de la sélection souris et le bouton souris sont aussi par page
- Le curseur du canvas est par page

### 4.3b Ce qui reste global au canvas (pas par page)
- Position X, Y du canvas dans la zone
- Barre de titre (nom, boutons, apparence)
- Poignées de redimensionnement du canvas
- Icône de déplacement
- Docking
- Interaction (tolérance de déplacement)

### 4.4 Clipboard
- Partagé entre TOUS les canvas de l'instance VOH
- Permet de couper/copier des objets dans un canvas et les coller dans un autre


## 5. BARRE DE TITRE DU CANVAS

### 5.1 Structure
- Positionnée AU-DESSUS du canvas (n'empiète pas sur la zone de travail)
- Contient : icône optionnelle (gauche) + nom du canvas (centre/gauche) + boutons (droite)

### 5.2 Personnalisation complète
- Couleur de fond (normal, survol, actif)
- Bordure (couleur, épaisseur)
- Hauteur
- Arrondi haut (coins supérieurs)
- Opacité
- Police du texte (famille, taille, couleur, gras, italique)
- Icône optionnelle à gauche (image personnalisable)
- Ombre portée (décalage X, décalage Y, flou, couleur, opacité)
- Curseur de souris
- Visibilité (peut être masquée)

### 5.3 Comportement
- Drag de la barre de titre → déplace le canvas dans la zone (comme une fenêtre)
- Double-clic → maximiser/restaurer (optionnel, configurable)

### 5.4 Boutons de la barre de titre

Trois boutons positionnés à droite de la barre, chacun entièrement personnalisable :

#### 5.4.1 Bouton Fermer (✕)
- Supprime ou masque le canvas (comportement configurable par le développeur via l'API)
- Personnalisation : couleur de fond (normal, survol, clic), couleur icône, forme, taille, bordure, arrondis, ombre, opacité, curseur, visible, activé

#### 5.4.2 Bouton Minimiser (─)
- Réduit le canvas dans une petite barre en bas de la zone (style barre des tâches Windows)
- Le canvas minimisé affiche son nom dans la barre en bas
- Cliquer sur la barre minimisée restaure le canvas
- Personnalisation : idem fermer

#### 5.4.3 Bouton Maximiser/Restaurer (□)
- Maximiser : le canvas prend toute la taille disponible de la zone
- Restaurer : revient à sa position et taille d'avant le maximiser
- L'icône change selon l'état (□ pour maximiser, ❐ pour restaurer)
- Personnalisation : idem fermer

### 5.5 États du canvas
- Normal     — position et taille libres, flottant dans la zone
- Minimisé   — réduit dans la barre en bas de la zone
- Maximisé   — prend toute la zone
- Ancré      — attaché via le système de docking (voir section 8)

### 5.6 Données sauvegardées pour restauration
- Position X, Y avant maximiser
- Largeur, Hauteur avant maximiser
- État précédent (pour enchaîner minimize → restore correctement)


## 6. POIGNÉES DE REDIMENSIONNEMENT DU CANVAS

### 6.1 Les 8 positions
Chaque canvas dispose de 8 poignées possibles, activables/désactivables individuellement :

- topLeft      — coin haut-gauche (↘)
- top          — bord haut centre (↕)
- topRight     — coin haut-droite (↙)
- right        — bord droite centre (↔)
- bottomRight  — coin bas-droite (↗)
- bottom       — bord bas centre (↕)
- bottomLeft   — coin bas-gauche (↗)
- left         — bord gauche centre (↔)

Le développeur choisit lesquelles sont visibles. Exemples :
- Toutes les 8 (par défaut)
- Seulement bottom + right + bottomRight (redimensionnement vers le bas-droite uniquement)
- Seulement les 4 coins
- Seulement les 4 bords
- Une seule poignée
- Aucune (pas de redimensionnement à la souris)

### 6.2 Comportement
- Visibles uniquement quand le canvas est actif/sélectionné (configurable)
- Drag d'une poignée → redimensionne le canvas dans la direction correspondante
- Respectent les contraintes de taille min/max (section 3.10)
- Respectent le snap à la grille de la zone si activé (section 3.11)
- Ne fonctionnent pas si le canvas est verrouillé (section 3.7)

### 6.3 Personnalisation globale (toutes les poignées à la fois)
- Couleur de fond (normal, survol, clic)
- Taille (largeur, hauteur)
- Forme (carré, cercle, losange, triangle, ou personnalisée)
- Bordure (couleur, épaisseur, arrondis)
- Opacité
- Ombre portée (décalage X, décalage Y, flou, couleur, opacité)
- Curseur de souris au survol (adapté automatiquement à la direction par défaut, personnalisable)

### 6.4 Personnalisation individuelle (par poignée)
Chaque poignée peut surcharger les réglages globaux :
- Couleur de fond propre (normal, survol, clic)
- Taille propre
- Forme propre
- Bordure propre (couleur, épaisseur, arrondis)
- Opacité propre
- Ombre portée propre (décalage X, décalage Y, flou, couleur, opacité)
- Curseur propre
- Visible / Cachée
- Activée / Désactivée (visible mais ne réagit pas)
- Décalage de position (offset X, Y pour ajuster le placement)

Si une propriété individuelle n'est pas définie, elle hérite de la valeur globale.


## 7. ICÔNE DE DÉPLACEMENT (alternative à la barre de titre)

### 7.1 Description
- Petite zone cliquable avec une icône de déplacement
- Positionnée par défaut en haut à gauche du canvas (configurable)
- Visible quand le canvas est actif
- Drag de l'icône → déplace le canvas dans la zone

### 7.2 Personnalisation
- Position (haut-gauche, haut-droite, ou position custom)
- Icône personnalisable (image ou symbole)
- Couleur de fond (normal, survol, clic)
- Bordure (couleur, épaisseur)
- Arrondis
- Taille
- Opacité
- Ombre portée (décalage X, décalage Y, flou, couleur, opacité)
- Curseur de souris
- Visible / Caché

### 7.3 Note
- L'icône de déplacement ET la barre de titre permettent de déplacer le canvas
- Les deux peuvent coexister ou être utilisés séparément


## 8. SYSTÈME DE DOCKING DES CANVAS

### 8.1 Concept
Les canvas peuvent être ancrés (dockés) les uns par rapport aux autres
à l'intérieur d'une zone, comme le docking de l'éditeur VS2010.

### 8.2 Comportement
- Quand on drague un canvas par sa barre de titre, les flèches de docking
  apparaissent (haut, bas, gauche, droite, centre)
- Lâcher sur une flèche → le canvas s'ancre et partage l'espace avec les autres
- Les canvas ancrés se redimensionnent automatiquement ensemble
- On peut détacher un canvas ancré pour le remettre en mode flottant

### 8.3 Flèches de docking — Personnalisation complète
- Couleur de fond (normal, survol)
- Couleur de bordure, épaisseur de bordure
- Forme (triangle, rectangle, ou custom)
- Taille
- Opacité
- Ombre portée (décalage X, décalage Y, flou, couleur, opacité)
- Icône/symbole à l'intérieur
- Curseur de souris
- Zone de prévisualisation (couleur, opacité de la zone bleue qui montre
  où le canvas sera ancré)

### 8.4 Positions de docking
- Haut    — le canvas s'ancre en haut, partage horizontalement
- Bas     — le canvas s'ancre en bas, partage horizontalement
- Gauche  — le canvas s'ancre à gauche, partage verticalement
- Droite  — le canvas s'ancre à droite, partage verticalement
- Centre  — le canvas s'intègre en onglets (tabs) avec le canvas cible

### 8.5 Séparateurs entre canvas ancrés
- Redimensionnables par drag
- Personnalisation : couleur, épaisseur, couleur au survol, opacité, curseur, ombre portée


## 9. API PUBLIQUE PRÉVUE — voh.canvas.*

### 9.1 Création / Suppression
```javascript
voh.canvas.create({ zone, name, x, y, width, height, ... })
voh.canvas.delete(canvasId)
```

### 9.2 Propriétés de base
```javascript
voh.canvas.setName(canvasId, name)
voh.canvas.getName(canvasId)
voh.canvas.setX(canvasId, x)
voh.canvas.getX(canvasId)
voh.canvas.setY(canvasId, y)
voh.canvas.getY(canvasId)
voh.canvas.setWidth(canvasId, width)
voh.canvas.getWidth(canvasId)
voh.canvas.setHeight(canvasId, height)
voh.canvas.getHeight(canvasId)
```

### 9.3 Bordure et arrondis
```javascript
voh.canvas.setBorderColor(canvasId, color)
voh.canvas.getBorderColor(canvasId)
voh.canvas.setBorderWidth(canvasId, width)
voh.canvas.getBorderWidth(canvasId)
voh.canvas.setBorderStyle(canvasId, style)     // 'solid', 'dashed', 'dotted', etc.
voh.canvas.getBorderStyle(canvasId)
voh.canvas.setBorderRadius(canvasId, radius)
voh.canvas.getBorderRadius(canvasId)
```

### 9.4 Ombre portée du canvas
```javascript
voh.canvas.setShadowOffsetX(canvasId, offset)
voh.canvas.getShadowOffsetX(canvasId)
voh.canvas.setShadowOffsetY(canvasId, offset)
voh.canvas.getShadowOffsetY(canvasId)
voh.canvas.setShadowBlur(canvasId, blur)
voh.canvas.getShadowBlur(canvasId)
voh.canvas.setShadowColor(canvasId, color)
voh.canvas.getShadowColor(canvasId)
voh.canvas.setShadowOpacity(canvasId, opacity)
voh.canvas.getShadowOpacity(canvasId)
```

### 9.5 Verrouillage, visibilité, opacité
```javascript
voh.canvas.setLocked(canvasId, locked)
voh.canvas.getLocked(canvasId)
voh.canvas.isLocked(canvasId)                  // alias de getLocked
voh.canvas.setVisible(canvasId, visible)
voh.canvas.getVisible(canvasId)
voh.canvas.isVisible(canvasId)                 // alias de getVisible
voh.canvas.setOpacity(canvasId, opacity)       // 0.0 à 1.0
voh.canvas.getOpacity(canvasId)
```

### 9.6 Contraintes de taille
```javascript
voh.canvas.setMinWidth(canvasId, width)
voh.canvas.getMinWidth(canvasId)
voh.canvas.setMaxWidth(canvasId, width)
voh.canvas.getMaxWidth(canvasId)
voh.canvas.setMinHeight(canvasId, height)
voh.canvas.getMinHeight(canvasId)
voh.canvas.setMaxHeight(canvasId, height)
voh.canvas.getMaxHeight(canvasId)
```

### 9.7 Snap à la grille de la zone
```javascript
voh.canvas.setSnapToZoneGrid(canvasId, enabled)
voh.canvas.getSnapToZoneGrid(canvasId)
```

### 9.8 Duplication
```javascript
voh.canvas.duplicate(canvasId)                 // retourne l'ID du nouveau canvas
```

### 9.9 Export / Import
```javascript
voh.canvas.export(canvasId)                    // retourne un objet JSON
voh.canvas.import(zoneId, data)                // importe un canvas depuis JSON, retourne l'ID
```

### 9.10 Curseur de souris
```javascript
voh.canvas.setCursor(canvasId, cursor)         // 'pointer', 'crosshair', 'default', ou URL image
voh.canvas.getCursor(canvasId)
```

### 9.11 États MDI
```javascript
voh.canvas.minimize(canvasId)
voh.canvas.maximize(canvasId)
voh.canvas.restore(canvasId)
voh.canvas.close(canvasId)                     // fermer/masquer selon config
voh.canvas.getState(canvasId)                  // 'normal', 'minimized', 'maximized', 'docked'
```

### 9.12 Z-order
```javascript
voh.canvas.bringToFront(canvasId)
voh.canvas.sendToBack(canvasId)
voh.canvas.moveUp(canvasId)
voh.canvas.moveDown(canvasId)
voh.canvas.getZOrder(canvasId)
```

### 9.13 Informations
```javascript
voh.canvas.getCount(zoneId)                    // nombre de canvas dans une zone
voh.canvas.getList(zoneId)                     // liste des canvas d'une zone
voh.canvas.exists(canvasId)
voh.canvas.getActiveId()                       // canvas actuellement en édition
voh.canvas.setActive(canvasId)
```

### 9.14 Barre de titre — voh.canvas.titleBar.*
```javascript
voh.canvas.titleBar.setVisible(canvasId, visible)
voh.canvas.titleBar.getVisible(canvasId)
voh.canvas.titleBar.setHeight(canvasId, height)
voh.canvas.titleBar.getHeight(canvasId)
voh.canvas.titleBar.setOpacity(canvasId, opacity)
voh.canvas.titleBar.getOpacity(canvasId)
voh.canvas.titleBar.setBackgroundColor(canvasId, color)
voh.canvas.titleBar.getBackgroundColor(canvasId)
voh.canvas.titleBar.setHoverBackgroundColor(canvasId, color)
voh.canvas.titleBar.getHoverBackgroundColor(canvasId)
voh.canvas.titleBar.setActiveBackgroundColor(canvasId, color)   // quand le canvas est actif
voh.canvas.titleBar.getActiveBackgroundColor(canvasId)
voh.canvas.titleBar.setTextColor(canvasId, color)
voh.canvas.titleBar.getTextColor(canvasId)
voh.canvas.titleBar.setTextFont(canvasId, font)
voh.canvas.titleBar.getTextFont(canvasId)
voh.canvas.titleBar.setTextSize(canvasId, size)
voh.canvas.titleBar.getTextSize(canvasId)
voh.canvas.titleBar.setTextBold(canvasId, bold)
voh.canvas.titleBar.getTextBold(canvasId)
voh.canvas.titleBar.setTextItalic(canvasId, italic)
voh.canvas.titleBar.getTextItalic(canvasId)
voh.canvas.titleBar.setIcon(canvasId, image)
voh.canvas.titleBar.getIcon(canvasId)
voh.canvas.titleBar.setBorderColor(canvasId, color)
voh.canvas.titleBar.getBorderColor(canvasId)
voh.canvas.titleBar.setBorderWidth(canvasId, width)
voh.canvas.titleBar.getBorderWidth(canvasId)
voh.canvas.titleBar.setBorderRadius(canvasId, radius)   // arrondis haut
voh.canvas.titleBar.getBorderRadius(canvasId)
voh.canvas.titleBar.setShadowOffsetX(canvasId, offset)
voh.canvas.titleBar.getShadowOffsetX(canvasId)
voh.canvas.titleBar.setShadowOffsetY(canvasId, offset)
voh.canvas.titleBar.getShadowOffsetY(canvasId)
voh.canvas.titleBar.setShadowBlur(canvasId, blur)
voh.canvas.titleBar.getShadowBlur(canvasId)
voh.canvas.titleBar.setShadowColor(canvasId, color)
voh.canvas.titleBar.getShadowColor(canvasId)
voh.canvas.titleBar.setShadowOpacity(canvasId, opacity)
voh.canvas.titleBar.getShadowOpacity(canvasId)
voh.canvas.titleBar.setDoubleClickAction(canvasId, action) // 'maximize', 'none'
voh.canvas.titleBar.setCursor(canvasId, cursor)
voh.canvas.titleBar.getCursor(canvasId)
```

### 9.15 Boutons de la barre de titre — voh.canvas.titleBar.buttons.*
```javascript
// Pour chaque bouton : 'close', 'minimize', 'maximize'
voh.canvas.titleBar.buttons.setVisible(canvasId, button, visible)
voh.canvas.titleBar.buttons.getVisible(canvasId, button)
voh.canvas.titleBar.buttons.setEnabled(canvasId, button, enabled)
voh.canvas.titleBar.buttons.getEnabled(canvasId, button)
voh.canvas.titleBar.buttons.setBackgroundColor(canvasId, button, color)
voh.canvas.titleBar.buttons.getBackgroundColor(canvasId, button)
voh.canvas.titleBar.buttons.setHoverBackgroundColor(canvasId, button, color)
voh.canvas.titleBar.buttons.getHoverBackgroundColor(canvasId, button)
voh.canvas.titleBar.buttons.setClickBackgroundColor(canvasId, button, color)
voh.canvas.titleBar.buttons.getClickBackgroundColor(canvasId, button)
voh.canvas.titleBar.buttons.setIconColor(canvasId, button, color)
voh.canvas.titleBar.buttons.getIconColor(canvasId, button)
voh.canvas.titleBar.buttons.setHoverIconColor(canvasId, button, color)
voh.canvas.titleBar.buttons.getHoverIconColor(canvasId, button)
voh.canvas.titleBar.buttons.setClickIconColor(canvasId, button, color)
voh.canvas.titleBar.buttons.getClickIconColor(canvasId, button)
voh.canvas.titleBar.buttons.setSize(canvasId, button, size)
voh.canvas.titleBar.buttons.getSize(canvasId, button)
voh.canvas.titleBar.buttons.setShape(canvasId, button, shape)    // 'square', 'circle', 'rounded'
voh.canvas.titleBar.buttons.getShape(canvasId, button)
voh.canvas.titleBar.buttons.setOpacity(canvasId, button, opacity)
voh.canvas.titleBar.buttons.getOpacity(canvasId, button)
voh.canvas.titleBar.buttons.setBorderColor(canvasId, button, color)
voh.canvas.titleBar.buttons.getBorderColor(canvasId, button)
voh.canvas.titleBar.buttons.setBorderWidth(canvasId, button, width)
voh.canvas.titleBar.buttons.getBorderWidth(canvasId, button)
voh.canvas.titleBar.buttons.setBorderRadius(canvasId, button, radius)
voh.canvas.titleBar.buttons.getBorderRadius(canvasId, button)
voh.canvas.titleBar.buttons.setShadowOffsetX(canvasId, button, offset)
voh.canvas.titleBar.buttons.getShadowOffsetX(canvasId, button)
voh.canvas.titleBar.buttons.setShadowOffsetY(canvasId, button, offset)
voh.canvas.titleBar.buttons.getShadowOffsetY(canvasId, button)
voh.canvas.titleBar.buttons.setShadowBlur(canvasId, button, blur)
voh.canvas.titleBar.buttons.getShadowBlur(canvasId, button)
voh.canvas.titleBar.buttons.setShadowColor(canvasId, button, color)
voh.canvas.titleBar.buttons.getShadowColor(canvasId, button)
voh.canvas.titleBar.buttons.setShadowOpacity(canvasId, button, opacity)
voh.canvas.titleBar.buttons.getShadowOpacity(canvasId, button)
voh.canvas.titleBar.buttons.setCursor(canvasId, button, cursor)
voh.canvas.titleBar.buttons.getCursor(canvasId, button)
```

### 9.16 Poignées de redimensionnement — voh.canvas.handles.*

Positions : 'topLeft', 'top', 'topRight', 'right', 'bottomRight', 'bottom', 'bottomLeft', 'left'

```javascript
// ── Activation/désactivation par position ──
voh.canvas.handles.setEnabled(canvasId, position, enabled)   // activer/désactiver une poignée
voh.canvas.handles.getEnabled(canvasId, position)
voh.canvas.handles.enableAll(canvasId)                       // activer les 8
voh.canvas.handles.disableAll(canvasId)                      // désactiver les 8
voh.canvas.handles.enableOnly(canvasId, [...positions])      // activer uniquement celles listées
voh.canvas.handles.getEnabledList(canvasId)                  // retourne la liste des positions actives

// ── Réglages globaux (appliqués à toutes les poignées) ──
voh.canvas.handles.setColor(canvasId, color)
voh.canvas.handles.getColor(canvasId)
voh.canvas.handles.setHoverColor(canvasId, color)
voh.canvas.handles.getHoverColor(canvasId)
voh.canvas.handles.setClickColor(canvasId, color)
voh.canvas.handles.getClickColor(canvasId)
voh.canvas.handles.setSize(canvasId, width, height)
voh.canvas.handles.getSize(canvasId)
voh.canvas.handles.setShape(canvasId, shape)                 // 'square', 'circle', 'diamond', 'triangle'
voh.canvas.handles.getShape(canvasId)
voh.canvas.handles.setBorderColor(canvasId, color)
voh.canvas.handles.getBorderColor(canvasId)
voh.canvas.handles.setBorderWidth(canvasId, width)
voh.canvas.handles.getBorderWidth(canvasId)
voh.canvas.handles.setBorderRadius(canvasId, radius)
voh.canvas.handles.getBorderRadius(canvasId)
voh.canvas.handles.setOpacity(canvasId, opacity)
voh.canvas.handles.getOpacity(canvasId)
voh.canvas.handles.setShadowOffsetX(canvasId, offset)
voh.canvas.handles.getShadowOffsetX(canvasId)
voh.canvas.handles.setShadowOffsetY(canvasId, offset)
voh.canvas.handles.getShadowOffsetY(canvasId)
voh.canvas.handles.setShadowBlur(canvasId, blur)
voh.canvas.handles.getShadowBlur(canvasId)
voh.canvas.handles.setShadowColor(canvasId, color)
voh.canvas.handles.getShadowColor(canvasId)
voh.canvas.handles.setShadowOpacity(canvasId, opacity)
voh.canvas.handles.getShadowOpacity(canvasId)
voh.canvas.handles.setCursor(canvasId, cursor)               // surcharge le curseur auto
voh.canvas.handles.getCursor(canvasId)
voh.canvas.handles.setVisible(canvasId, visible)             // visibilité globale
voh.canvas.handles.getVisible(canvasId)

// ── Réglages individuels par position (surcharge le global) ──
voh.canvas.handles.setHandleColor(canvasId, position, color)
voh.canvas.handles.getHandleColor(canvasId, position)
voh.canvas.handles.setHandleHoverColor(canvasId, position, color)
voh.canvas.handles.getHandleHoverColor(canvasId, position)
voh.canvas.handles.setHandleClickColor(canvasId, position, color)
voh.canvas.handles.getHandleClickColor(canvasId, position)
voh.canvas.handles.setHandleSize(canvasId, position, width, height)
voh.canvas.handles.getHandleSize(canvasId, position)
voh.canvas.handles.setHandleShape(canvasId, position, shape)
voh.canvas.handles.getHandleShape(canvasId, position)
voh.canvas.handles.setHandleBorderColor(canvasId, position, color)
voh.canvas.handles.getHandleBorderColor(canvasId, position)
voh.canvas.handles.setHandleBorderWidth(canvasId, position, width)
voh.canvas.handles.getHandleBorderWidth(canvasId, position)
voh.canvas.handles.setHandleBorderRadius(canvasId, position, radius)
voh.canvas.handles.getHandleBorderRadius(canvasId, position)
voh.canvas.handles.setHandleOpacity(canvasId, position, opacity)
voh.canvas.handles.getHandleOpacity(canvasId, position)
voh.canvas.handles.setHandleShadowOffsetX(canvasId, position, offset)
voh.canvas.handles.getHandleShadowOffsetX(canvasId, position)
voh.canvas.handles.setHandleShadowOffsetY(canvasId, position, offset)
voh.canvas.handles.getHandleShadowOffsetY(canvasId, position)
voh.canvas.handles.setHandleShadowBlur(canvasId, position, blur)
voh.canvas.handles.getHandleShadowBlur(canvasId, position)
voh.canvas.handles.setHandleShadowColor(canvasId, position, color)
voh.canvas.handles.getHandleShadowColor(canvasId, position)
voh.canvas.handles.setHandleShadowOpacity(canvasId, position, opacity)
voh.canvas.handles.getHandleShadowOpacity(canvasId, position)
voh.canvas.handles.setHandleCursor(canvasId, position, cursor)
voh.canvas.handles.getHandleCursor(canvasId, position)
voh.canvas.handles.setHandleVisible(canvasId, position, visible)
voh.canvas.handles.getHandleVisible(canvasId, position)
voh.canvas.handles.setHandleOffset(canvasId, position, offsetX, offsetY)
voh.canvas.handles.getHandleOffset(canvasId, position)
voh.canvas.handles.resetHandle(canvasId, position)           // supprime les surcharges, retour au global
```

### 9.17 Icône de déplacement — voh.canvas.moveIcon.*
```javascript
voh.canvas.moveIcon.setVisible(canvasId, visible)
voh.canvas.moveIcon.getVisible(canvasId)
voh.canvas.moveIcon.setPosition(canvasId, position)    // 'top-left', 'top-right', ou {x, y}
voh.canvas.moveIcon.getPosition(canvasId)
voh.canvas.moveIcon.setIcon(canvasId, image)
voh.canvas.moveIcon.getIcon(canvasId)
voh.canvas.moveIcon.setBackgroundColor(canvasId, color)
voh.canvas.moveIcon.getBackgroundColor(canvasId)
voh.canvas.moveIcon.setHoverBackgroundColor(canvasId, color)
voh.canvas.moveIcon.getHoverBackgroundColor(canvasId)
voh.canvas.moveIcon.setClickBackgroundColor(canvasId, color)
voh.canvas.moveIcon.getClickBackgroundColor(canvasId)
voh.canvas.moveIcon.setSize(canvasId, size)
voh.canvas.moveIcon.getSize(canvasId)
voh.canvas.moveIcon.setBorderColor(canvasId, color)
voh.canvas.moveIcon.getBorderColor(canvasId)
voh.canvas.moveIcon.setBorderWidth(canvasId, width)
voh.canvas.moveIcon.getBorderWidth(canvasId)
voh.canvas.moveIcon.setBorderRadius(canvasId, radius)
voh.canvas.moveIcon.getBorderRadius(canvasId)
voh.canvas.moveIcon.setOpacity(canvasId, opacity)
voh.canvas.moveIcon.getOpacity(canvasId)
voh.canvas.moveIcon.setCursor(canvasId, cursor)
voh.canvas.moveIcon.getCursor(canvasId)
voh.canvas.moveIcon.setShadowOffsetX(canvasId, offset)
voh.canvas.moveIcon.getShadowOffsetX(canvasId)
voh.canvas.moveIcon.setShadowOffsetY(canvasId, offset)
voh.canvas.moveIcon.getShadowOffsetY(canvasId)
voh.canvas.moveIcon.setShadowBlur(canvasId, blur)
voh.canvas.moveIcon.getShadowBlur(canvasId)
voh.canvas.moveIcon.setShadowColor(canvasId, color)
voh.canvas.moveIcon.getShadowColor(canvasId)
voh.canvas.moveIcon.setShadowOpacity(canvasId, opacity)
voh.canvas.moveIcon.getShadowOpacity(canvasId)
```

### 9.18 Docking — voh.canvas.docking.*
```javascript
// Actions
voh.canvas.docking.dock(canvasId, position)             // 'left', 'right', 'top', 'bottom', 'center'
voh.canvas.docking.dockTo(canvasId, targetCanvasId, position)
voh.canvas.docking.undock(canvasId)
voh.canvas.docking.isDocked(canvasId)

// Personnalisation des flèches
voh.canvas.docking.setArrowColor(color)
voh.canvas.docking.getArrowColor()
voh.canvas.docking.setArrowHoverColor(color)
voh.canvas.docking.getArrowHoverColor()
voh.canvas.docking.setArrowBorderColor(color)
voh.canvas.docking.getArrowBorderColor()
voh.canvas.docking.setArrowBorderWidth(width)
voh.canvas.docking.getArrowBorderWidth()
voh.canvas.docking.setArrowSize(size)
voh.canvas.docking.getArrowSize()
voh.canvas.docking.setArrowShape(shape)                  // 'triangle', 'rectangle', ou custom
voh.canvas.docking.getArrowShape()
voh.canvas.docking.setArrowIcon(icon)                    // icône/symbole à l'intérieur
voh.canvas.docking.getArrowIcon()
voh.canvas.docking.setArrowCursor(cursor)
voh.canvas.docking.getArrowCursor()
voh.canvas.docking.setArrowOpacity(opacity)
voh.canvas.docking.getArrowOpacity()
voh.canvas.docking.setArrowShadowOffsetX(offset)
voh.canvas.docking.getArrowShadowOffsetX()
voh.canvas.docking.setArrowShadowOffsetY(offset)
voh.canvas.docking.getArrowShadowOffsetY()
voh.canvas.docking.setArrowShadowBlur(blur)
voh.canvas.docking.getArrowShadowBlur()
voh.canvas.docking.setArrowShadowColor(color)
voh.canvas.docking.getArrowShadowColor()
voh.canvas.docking.setArrowShadowOpacity(opacity)
voh.canvas.docking.getArrowShadowOpacity()
voh.canvas.docking.setPreviewColor(color)               // couleur zone de prévisualisation
voh.canvas.docking.getPreviewColor()
voh.canvas.docking.setPreviewOpacity(opacity)
voh.canvas.docking.getPreviewOpacity()

// Séparateurs entre canvas ancrés
voh.canvas.docking.setSeparatorColor(color)
voh.canvas.docking.getSeparatorColor()
voh.canvas.docking.setSeparatorHoverColor(color)
voh.canvas.docking.getSeparatorHoverColor()
voh.canvas.docking.setSeparatorWidth(width)
voh.canvas.docking.getSeparatorWidth()
voh.canvas.docking.setSeparatorOpacity(opacity)
voh.canvas.docking.getSeparatorOpacity()
voh.canvas.docking.setSeparatorCursor(cursor)
voh.canvas.docking.getSeparatorCursor()
voh.canvas.docking.setSeparatorShadowOffsetX(offset)
voh.canvas.docking.getSeparatorShadowOffsetX()
voh.canvas.docking.setSeparatorShadowOffsetY(offset)
voh.canvas.docking.getSeparatorShadowOffsetY()
voh.canvas.docking.setSeparatorShadowBlur(blur)
voh.canvas.docking.getSeparatorShadowBlur()
voh.canvas.docking.setSeparatorShadowColor(color)
voh.canvas.docking.getSeparatorShadowColor()
voh.canvas.docking.setSeparatorShadowOpacity(opacity)
voh.canvas.docking.getSeparatorShadowOpacity()
```


## 10. API PAGES — voh.canvas.pages.*

```javascript
// Création / Suppression
voh.canvas.pages.add(canvasId, { name, backgroundColor, ... })
voh.canvas.pages.remove(canvasId, pageId)

// Navigation
voh.canvas.pages.setActive(canvasId, pageId)
voh.canvas.pages.getActiveId(canvasId)
voh.canvas.pages.next(canvasId)
voh.canvas.pages.previous(canvasId)
voh.canvas.pages.goTo(canvasId, index)

// Informations
voh.canvas.pages.getCount(canvasId)
voh.canvas.pages.getList(canvasId)
voh.canvas.pages.exists(canvasId, pageId)
voh.canvas.pages.getIndex(canvasId, pageId)

// Propriétés
voh.canvas.pages.setName(canvasId, pageId, name)
voh.canvas.pages.getName(canvasId, pageId)
voh.canvas.pages.setWidth(canvasId, pageId, width)
voh.canvas.pages.getWidth(canvasId, pageId)
voh.canvas.pages.setHeight(canvasId, pageId, height)
voh.canvas.pages.getHeight(canvasId, pageId)
voh.canvas.pages.setBackgroundColor(canvasId, pageId, color)
voh.canvas.pages.getBackgroundColor(canvasId, pageId)
voh.canvas.pages.setBackgroundImage(canvasId, pageId, image)
voh.canvas.pages.getBackgroundImage(canvasId, pageId)
voh.canvas.pages.setBackgroundImageOpacity(canvasId, pageId, opacity)
voh.canvas.pages.getBackgroundImageOpacity(canvasId, pageId)

// Bordure par page
voh.canvas.pages.setBorderColor(canvasId, pageId, color)
voh.canvas.pages.getBorderColor(canvasId, pageId)
voh.canvas.pages.setBorderThickness(canvasId, pageId, thickness)
voh.canvas.pages.getBorderThickness(canvasId, pageId)
voh.canvas.pages.setBorderStyle(canvasId, pageId, style)        // 'solid', 'dashed', 'dotted'
voh.canvas.pages.getBorderStyle(canvasId, pageId)
voh.canvas.pages.setCornerRadius(canvasId, pageId, radius)
voh.canvas.pages.getCornerRadius(canvasId, pageId)

// Style du rectangle de sélection souris par page
voh.canvas.pages.setSelectionBackgroundColor(canvasId, pageId, color)
voh.canvas.pages.getSelectionBackgroundColor(canvasId, pageId)
voh.canvas.pages.setSelectionBorderColor(canvasId, pageId, color)
voh.canvas.pages.getSelectionBorderColor(canvasId, pageId)
voh.canvas.pages.setSelectionBorderThickness(canvasId, pageId, thickness)
voh.canvas.pages.getSelectionBorderThickness(canvasId, pageId)
voh.canvas.pages.setSelectionBorderStyle(canvasId, pageId, style) // 'solid', 'dashed', 'dotted'
voh.canvas.pages.getSelectionBorderStyle(canvasId, pageId)
voh.canvas.pages.setSelectionEnabled(canvasId, pageId, enabled)
voh.canvas.pages.getSelectionEnabled(canvasId, pageId)
voh.canvas.pages.setSelectionMouseButton(canvasId, pageId, button) // 'left', 'middle', 'right'
voh.canvas.pages.getSelectionMouseButton(canvasId, pageId)

// Curseur par page
voh.canvas.pages.setCursor(canvasId, pageId, cursor)             // 'default', 'pointer', 'crosshair', etc. ou image
voh.canvas.pages.getCursor(canvasId, pageId)

// Grille/Snap par page
voh.canvas.pages.setGridWidth(canvasId, pageId, width)
voh.canvas.pages.getGridWidth(canvasId, pageId)
voh.canvas.pages.setGridHeight(canvasId, pageId, height)
voh.canvas.pages.getGridHeight(canvasId, pageId)
voh.canvas.pages.setGridColor(canvasId, pageId, color)
voh.canvas.pages.getGridColor(canvasId, pageId)
voh.canvas.pages.setGridOpacity(canvasId, pageId, opacity)
voh.canvas.pages.getGridOpacity(canvasId, pageId)
voh.canvas.pages.setGridVisible(canvasId, pageId, visible)
voh.canvas.pages.getGridVisible(canvasId, pageId)
voh.canvas.pages.setGridStyle(canvasId, pageId, style)          // 'solid', 'dashed', 'dotted', 'dots'
voh.canvas.pages.getGridStyle(canvasId, pageId)
voh.canvas.pages.setSnapEnabled(canvasId, pageId, enabled)
voh.canvas.pages.getSnapEnabled(canvasId, pageId)

// Undo / Redo par page
voh.canvas.pages.undo(canvasId, pageId)
voh.canvas.pages.redo(canvasId, pageId)
voh.canvas.pages.canUndo(canvasId, pageId)                      // retourne true/false
voh.canvas.pages.canRedo(canvasId, pageId)                      // retourne true/false
voh.canvas.pages.getUndoCount(canvasId, pageId)                 // nombre d'actions annulables
voh.canvas.pages.getRedoCount(canvasId, pageId)                 // nombre d'actions refaisables
voh.canvas.pages.clearHistory(canvasId, pageId)                 // vide l'historique
voh.canvas.pages.setMaxHistory(canvasId, pageId, maxLevel)      // limite de niveaux (ex: 50)
voh.canvas.pages.getMaxHistory(canvasId, pageId)

// Ordre
voh.canvas.pages.moveUp(canvasId, pageId)
voh.canvas.pages.moveDown(canvasId, pageId)
voh.canvas.pages.moveTo(canvasId, pageId, index)

// Duplication
voh.canvas.pages.duplicate(canvasId, pageId)

// Export / Import
voh.canvas.pages.export(canvasId, pageId)
voh.canvas.pages.import(canvasId, data)
```


## 11. ÉVÉNEMENTS

### 11.1 Événements Canvas
```
canvas:created
canvas:deleted
canvas:activated         // un canvas devient le canvas actif (en édition)
canvas:deactivated
canvas:moved             // position x/y changée
canvas:resized           // taille changée
canvas:minimized
canvas:maximized
canvas:restored
canvas:closed
canvas:docked
canvas:undocked
canvas:zOrderChanged
canvas:locked            // canvas verrouillé
canvas:unlocked          // canvas déverrouillé
canvas:shown             // canvas rendu visible
canvas:hidden            // canvas masqué
canvas:opacityChanged
canvas:duplicated        // canvas dupliqué, { sourceId, newId }
canvas:exported
canvas:imported
canvas:cursorChanged
canvas:nameChanged
canvas:borderChanged
canvas:shadowChanged
canvas:leftClick                 // clic sur la surface du canvas (pas sur un objet)
canvas:leftDoubleClick
canvas:leftDown
canvas:leftUp
canvas:rightClick
canvas:rightDoubleClick
canvas:rightDown
canvas:rightUp
canvas:middleClick
canvas:middleDoubleClick
canvas:middleDown
canvas:middleUp
canvas:wheel                     // { deltaY }
canvas:mouseMove                 // { x, y }
canvas:mouseEnter
canvas:mouseLeave
canvas:handle:dragStart          // { position: 'topLeft'|'top'|... }
canvas:handle:drag               // { position, deltaX, deltaY }
canvas:handle:dragEnd            // { position }
canvas:handle:hover              // { position }
canvas:handle:leave              // { position }
canvas:handle:leftClick          // { position }
canvas:handle:leftDoubleClick    // { position }
canvas:handle:leftDown           // { position }
canvas:handle:leftUp             // { position }
canvas:handle:rightClick         // { position }
canvas:handle:rightDoubleClick   // { position }
canvas:handle:rightDown          // { position }
canvas:handle:rightUp            // { position }
canvas:handle:middleClick        // { position }
canvas:handle:middleDoubleClick  // { position }
canvas:handle:middleDown         // { position }
canvas:handle:middleUp           // { position }
canvas:handle:wheel              // { position, deltaY }
canvas:handle:mouseMove          // { position, x, y }
canvas:titleBar:leftClick
canvas:titleBar:leftDoubleClick
canvas:titleBar:leftDown
canvas:titleBar:leftUp
canvas:titleBar:rightClick
canvas:titleBar:rightDoubleClick
canvas:titleBar:rightDown
canvas:titleBar:rightUp
canvas:titleBar:middleClick
canvas:titleBar:middleDoubleClick
canvas:titleBar:middleDown
canvas:titleBar:middleUp
canvas:titleBar:wheel                // { deltaY }
canvas:titleBar:mouseMove            // { x, y }
canvas:titleBar:mouseEnter
canvas:titleBar:mouseLeave
canvas:titleBar:dragStart        // début du déplacement du canvas
canvas:titleBar:drag             // { deltaX, deltaY }
canvas:titleBar:dragEnd
canvas:titleBar:buttonClicked    // { button: 'close'|'minimize'|'maximize' }
canvas:titleBar:buttonHover      // { button }
canvas:titleBar:buttonLeave      // { button }
canvas:titleBar:buttonLeftDown   // { button }
canvas:titleBar:buttonLeftDoubleClick // { button }
canvas:titleBar:buttonLeftUp     // { button }
canvas:titleBar:buttonRightClick      // { button }
canvas:titleBar:buttonRightDoubleClick // { button }
canvas:titleBar:buttonRightDown  // { button }
canvas:titleBar:buttonRightUp    // { button }
canvas:titleBar:buttonMiddleClick     // { button }
canvas:titleBar:buttonMiddleDoubleClick // { button }
canvas:titleBar:buttonMiddleDown // { button }
canvas:titleBar:buttonMiddleUp   // { button }
canvas:titleBar:buttonWheel      // { button, deltaY }
canvas:moveIcon:leftClick
canvas:moveIcon:leftDoubleClick
canvas:moveIcon:leftDown
canvas:moveIcon:leftUp
canvas:moveIcon:rightClick
canvas:moveIcon:rightDoubleClick
canvas:moveIcon:rightDown
canvas:moveIcon:rightUp
canvas:moveIcon:middleClick
canvas:moveIcon:middleDoubleClick
canvas:moveIcon:middleDown
canvas:moveIcon:middleUp
canvas:moveIcon:wheel            // { deltaY }
canvas:moveIcon:mouseMove        // { x, y }
canvas:moveIcon:hover
canvas:moveIcon:leave
canvas:moveIcon:dragStart
canvas:moveIcon:drag             // { deltaX, deltaY }
canvas:moveIcon:dragEnd
canvas:docking:arrowHover        // { direction: 'left'|'right'|'top'|'bottom'|'center' }
canvas:docking:arrowLeave        // { direction }
canvas:docking:preview           // { direction, targetCanvasId }
canvas:docking:separatorDragStart
canvas:docking:separatorDrag     // { deltaX, deltaY }
canvas:docking:separatorDragEnd
canvas:docking:separatorHover
canvas:docking:separatorLeave
```

### 11.2 Événements Pages
```
page:added
page:removed
page:activated           // changement de page active dans un canvas
page:deactivated
page:renamed
page:moved               // ordre changé
page:duplicated
page:exported
page:imported
page:undone              // action annulée
page:redone              // action refaite
page:historyCleared      // historique vidé
page:gridChanged         // modification de la grille
page:snapChanged         // snap activé/désactivé
page:backgroundChanged   // couleur ou image de fond modifiée
```


## 12. PLAN D'IMPLÉMENTATION (par étapes)

### Étape 1 — Canvas basique
- Création/suppression d'un canvas dans une zone
- Position X, Y dans la zone
- Taille (largeur, hauteur)
- Bordure (couleur, épaisseur, style, arrondis)
- Clipping du contenu
- Fond couleur + fond image (page par défaut)
- 5 layers Pixi.js
- Z-order par ordre de création
- Nom du canvas
- Canvas actif (un seul à la fois)
- Verrouillage, visibilité, opacité
- Contraintes de taille (min/max)
- Snap à la grille de la zone
- Curseur de souris personnalisable
- Duplication de canvas
- Export/Import JSON
- Ombre portée du canvas
- Événements de base (created, deleted, activated, moved, resized, locked, hidden, etc.)
- Événements souris complets sur le canvas
- API voh.canvas.* de base (sections 9.1 à 9.13)

### Étape 2 — Barre de titre + déplacement + redimensionnement
- Barre de titre avec nom
- Déplacement du canvas par drag de la barre de titre
- Poignées de redimensionnement (8 directions)
- Icône de déplacement alternative
- Personnalisation de la barre de titre (couleurs, police, hauteur, bordure)
- Personnalisation des poignées (couleur, forme, taille)
- API voh.canvas.titleBar.* (section 9.14)
- API voh.canvas.handles.* (section 9.16)
- API voh.canvas.moveIcon.* (section 9.17)

### Étape 3 — Boutons minimiser/maximiser/fermer
- 3 boutons dans la barre de titre
- Minimiser → barre en bas de la zone
- Maximiser → plein canvas dans la zone
- Restaurer → retour à la position/taille d'avant
- Fermer → supprime ou masque (configurable)
- Personnalisation complète de chaque bouton
- Double-clic barre de titre → maximiser/restaurer
- API voh.canvas.titleBar.buttons.* (section 9.15)
- API voh.canvas.minimize/maximize/restore/close (section 9.11)

### Étape 4 — Pages
- Création/suppression de pages
- Page 1 automatique à la création du canvas
- Navigation entre pages
- Propriétés par page (fond, grille, objets, connexions)
- Undo/Redo par page
- Sélection vidée au changement de page
- Clipboard partagé entre canvas
- API voh.canvas.pages.* (section 10)
- Événements pages (section 11.2)

### Étape 5 — Docking des canvas
- Flèches de docking au drag d'un canvas
- Ancrage aux 4 bords + onglets (centre)
- Redimensionnement automatique des canvas ancrés
- Séparateurs redimensionnables entre canvas ancrés
- Détachement (retour en flottant)
- Personnalisation des flèches et de la prévisualisation
- API voh.canvas.docking.* (section 9.18)

### Étape 6 — Rendu hybride
- Détection automatique de contenu animé (GIF, vidéo, animations)
- Bascule statique ↔ dynamique transparente
- Optimisation GPU (pas de boucle de rendu quand tout est statique)


## 13. NOTES TECHNIQUES

### 13.1 Pixi.js
- Chaque canvas est une instance Pixi.Application (ou un Container dans un Application partagé par zone — à déterminer)
- Le clipping utilise le masking Pixi.js natif
- Les arrondis du clipping utilisent Pixi.Graphics avec drawRoundedRect
- Le z-order des canvas dans la zone est géré par l'ordre des enfants dans le container Pixi.js de la zone

### 13.2 Fichiers prévus
- Core-Canvas.js        — CanvasManager (gestion des canvas)
- Core-CanvasPage.js     — PageManager (gestion des pages par canvas)
- Core-CanvasDocking.js — Système de docking des canvas (étape 5)
- Core-API.js           — Extension avec voh.canvas.* et voh.canvas.pages.*

### 13.3 Règle des 1 500 lignes
Si un fichier dépasse 1 500 lignes, le découper. Le CanvasManager sera
probablement le plus gros fichier — anticiper le découpage si nécessaire.

### 13.4 Autonomie du Core
Le canvas, les pages, le docking — tout ça c'est du Core.
L'éditeur visuel viendra plus tard et utilisera cette API.
Le Core fonctionne seul, sans éditeur, sans wrapper desktop.
