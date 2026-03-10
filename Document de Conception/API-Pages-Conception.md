# VOH v5 — API complète avec système de pages

**Date :** 6 mars 2026
**Statut :** Conception — À valider par David

---

## RÈGLE FONDAMENTALE

**Pas de pageId = page active du canvas. Avec pageId = page ciblée.**

```javascript
voh.objects.create(canvasId, { x: 50, y: 50 })           // crée sur la page ACTIVE
voh.objects.create(canvasId, { x: 50, y: 50 }, pageId)   // crée sur la page ciblée
```

Une page par défaut est créée automatiquement à la création du canvas.
Il doit toujours rester au moins une page — la suppression de la dernière page est refusée.

---

## 1. VOH (racine)

```javascript
// Initialisation
const voh = new VisualObjectsHandler(document.getElementById('monDiv'));
await voh.init();

// Informations globales
voh.getVersion()                          // → '5.14.10'
voh.isReady()                             // → true/false
voh.destroy()                             // détruit tout

// Événements globaux
voh.on(eventName, callback)               // abonne
voh.off(eventName, callback)              // désabonne
voh.once(eventName, callback)             // abonne une fois
```

---

## 2. VOH.ZONE — Conteneur de premier niveau

Pas de pages ici. Une zone contient des canvas.

```javascript
// Création / Suppression
voh.zone.create({ name, width, height, backgroundColor, ... })   // → zoneId
voh.zone.delete(zoneId)                                           // → boolean

// Zone active
voh.zone.setActive(zoneId)
voh.zone.getActiveId()                    // → zoneId | null

// Informations
voh.zone.getCount()                       // → nombre
voh.zone.getList()                        // → [zoneId, zoneId, ...]
voh.zone.exists(zoneId)                   // → boolean

// Propriétés (toutes avec canvasId)
voh.zone.setName(zoneId, name)
voh.zone.getName(zoneId)
voh.zone.setWidth(zoneId, width)
voh.zone.getWidth(zoneId)
voh.zone.setHeight(zoneId, height)
voh.zone.getHeight(zoneId)
voh.zone.setBackgroundColor(zoneId, color)
voh.zone.getBackgroundColor(zoneId)
voh.zone.setBackgroundImage(zoneId, image)
voh.zone.getBackgroundImage(zoneId)
voh.zone.setBackgroundImageOpacity(zoneId, opacity)
voh.zone.getBackgroundImageOpacity(zoneId)

// Grille de zone (décorative, pas de snap)
voh.zone.setGridWidth(zoneId, width)
voh.zone.getGridWidth(zoneId)
voh.zone.setGridHeight(zoneId, height)
voh.zone.getGridHeight(zoneId)
voh.zone.setGridColor(zoneId, color)
voh.zone.getGridColor(zoneId)
voh.zone.setGridOpacity(zoneId, opacity)
voh.zone.getGridOpacity(zoneId)
voh.zone.setGridVisible(zoneId, visible)
voh.zone.getGridVisible(zoneId)

// Viewport
voh.zone.setScrollbarVisible(zoneId, visible)
voh.zone.getScrollbarVisible(zoneId)
voh.zone.setScrollX(zoneId, x)
voh.zone.getScrollX(zoneId)
voh.zone.setScrollY(zoneId, y)
voh.zone.getScrollY(zoneId)
voh.zone.scrollToCenter(zoneId)

// Zoom
voh.zone.setZoom(zoneId, level)
voh.zone.getZoom(zoneId)
voh.zone.zoomIn(zoneId)
voh.zone.zoomOut(zoneId)
voh.zone.resetZoom(zoneId)

// Bordure
voh.zone.setBorderColor(zoneId, color)
voh.zone.getBorderColor(zoneId)
voh.zone.setBorderThickness(zoneId, thickness)
voh.zone.getBorderThickness(zoneId)

// Comportement
voh.zone.setBringCanvasToFrontOnActivation(zoneId, enabled)
voh.zone.getBringCanvasToFrontOnActivation(zoneId)
```

---

## 3. VOH.CANVAS — Surface de travail dans une zone

Propriétés GLOBALES du canvas (pas par page).

```javascript
// Création / Suppression
voh.canvas.create(zoneId, { name, x, y, ... })    // → canvasId
voh.canvas.delete(canvasId)                         // → boolean

// Canvas actif
voh.canvas.setActive(canvasId)
voh.canvas.getActiveId()                // → canvasId | null

// Informations
voh.canvas.getCount(zoneId)             // → nombre total dans la zone
voh.canvas.getList(zoneId)              // → [canvasId, canvasId, ...]
voh.canvas.exists(canvasId)             // → boolean
voh.canvas.getZoneId(canvasId)          // → zoneId | null

// Nom
voh.canvas.setName(canvasId, name)
voh.canvas.getName(canvasId)

// Position dans la zone (global, pas par page)
voh.canvas.setX(canvasId, x)
voh.canvas.getX(canvasId)
voh.canvas.setY(canvasId, y)
voh.canvas.getY(canvasId)

// Verrouillage (global)
voh.canvas.setLocked(canvasId, isLocked)
voh.canvas.getLocked(canvasId)
voh.canvas.isLocked(canvasId)

// Visibilité (global)
voh.canvas.setVisible(canvasId, isVisible)
voh.canvas.getVisible(canvasId)
voh.canvas.isVisible(canvasId)

// Opacité (global)
voh.canvas.setOpacity(canvasId, opacity)
voh.canvas.getOpacity(canvasId)

// Z-order (global)
voh.canvas.bringToFront(canvasId)
voh.canvas.sendToBack(canvasId)
voh.canvas.moveUp(canvasId)
voh.canvas.moveDown(canvasId)
voh.canvas.setZOrder(canvasId, zOrder)
voh.canvas.getZOrder(canvasId)
```

---

## 4. VOH.CANVAS.PAGES — Gestion des pages d'un canvas

```javascript
// Création / Suppression
voh.canvas.pages.add(canvasId, { name, width, height, backgroundColor, ... })  // → pageId
voh.canvas.pages.remove(canvasId, pageId)             // → boolean

// Navigation
voh.canvas.pages.setActive(canvasId, pageId)
voh.canvas.pages.getActiveId(canvasId)                // → pageId | null
voh.canvas.pages.next(canvasId)                       // page suivante
voh.canvas.pages.previous(canvasId)                   // page précédente
voh.canvas.pages.goTo(canvasId, index)                // page par index

// Informations
voh.canvas.pages.getCount(canvasId)                   // → nombre
voh.canvas.pages.getList(canvasId)                    // → [{ id, name }, ...]
voh.canvas.pages.exists(canvasId, pageId)             // → boolean
voh.canvas.pages.getIndex(canvasId, pageId)           // → nombre

// Nom
voh.canvas.pages.setName(canvasId, pageId, name)
voh.canvas.pages.getName(canvasId, pageId)

// Ordre
voh.canvas.pages.moveUp(canvasId, pageId)
voh.canvas.pages.moveDown(canvasId, pageId)
voh.canvas.pages.moveTo(canvasId, pageId, index)

// Duplication
voh.canvas.pages.duplicate(canvasId, pageId)          // → nouveau pageId

// Export / Import
voh.canvas.pages.export(canvasId, pageId)             // → données JSON
voh.canvas.pages.import(canvasId, data)               // → nouveau pageId
```

---

## 5. VOH.CANVAS.PAGES.DIMENSIONS — Taille par page

```javascript
// Sans pageId = page active. Avec pageId = page ciblée.
voh.canvas.pages.dimensions.setWidth(canvasId, width)
voh.canvas.pages.dimensions.setWidth(canvasId, width, pageId)
voh.canvas.pages.dimensions.getWidth(canvasId)
voh.canvas.pages.dimensions.getWidth(canvasId, pageId)
voh.canvas.pages.dimensions.setHeight(canvasId, height)
voh.canvas.pages.dimensions.setHeight(canvasId, height, pageId)
voh.canvas.pages.dimensions.getHeight(canvasId)
voh.canvas.pages.dimensions.getHeight(canvasId, pageId)
```

---

## 6. VOH.CANVAS.PAGES.BACKGROUND — Fond par page

```javascript
voh.canvas.pages.background.setColor(canvasId, color) // page active
voh.canvas.pages.background.setColor(canvasId, color, pageId) // page ciblée
voh.canvas.pages.background.getColor(canvasId)
voh.canvas.pages.background.getColor(canvasId, pageId)
voh.canvas.pages.background.setImage(canvasId, image)
voh.canvas.pages.background.setImage(canvasId, image, pageId)
voh.canvas.pages.background.getImage(canvasId)
voh.canvas.pages.background.getImage(canvasId, pageId)
voh.canvas.pages.background.setImageOpacity(canvasId, opacity)
voh.canvas.pages.background.setImageOpacity(canvasId, opacity, pageId)
voh.canvas.pages.background.getImageOpacity(canvasId)
voh.canvas.pages.background.getImageOpacity(canvasId, pageId)
```

---

## 7. VOH.CANVAS.PAGES.BORDER — Bordure par page

```javascript
voh.canvas.pages.border.setColor(canvasId, color) // page active
voh.canvas.pages.border.setColor(canvasId, color, pageId) // page ciblée
voh.canvas.pages.border.getColor(canvasId)
voh.canvas.pages.border.getColor(canvasId, pageId)
voh.canvas.pages.border.setThickness(canvasId, thickness)
voh.canvas.pages.border.setThickness(canvasId, thickness, pageId)
voh.canvas.pages.border.getThickness(canvasId)
voh.canvas.pages.border.getThickness(canvasId, pageId)
voh.canvas.pages.border.setStyle(canvasId, style)              // 'solid', 'dashed', 'dotted'
voh.canvas.pages.border.setStyle(canvasId, style, pageId)
voh.canvas.pages.border.getStyle(canvasId)
voh.canvas.pages.border.getStyle(canvasId, pageId)
voh.canvas.pages.border.setCornerRadius(canvasId, radius)
voh.canvas.pages.border.setCornerRadius(canvasId, radius, pageId)
voh.canvas.pages.border.getCornerRadius(canvasId)
voh.canvas.pages.border.getCornerRadius(canvasId, pageId)
```

---

## 8. VOH.CANVAS.PAGES.GRID — Grille/Snap par page

```javascript
voh.canvas.pages.grid.setCellWidth(canvasId, width) // page active
voh.canvas.pages.grid.setCellWidth(canvasId, width, pageId) // page ciblée
voh.canvas.pages.grid.getCellWidth(canvasId)
voh.canvas.pages.grid.getCellWidth(canvasId, pageId)
voh.canvas.pages.grid.setCellHeight(canvasId, height)
voh.canvas.pages.grid.setCellHeight(canvasId, height, pageId)
voh.canvas.pages.grid.getCellHeight(canvasId)
voh.canvas.pages.grid.getCellHeight(canvasId, pageId)
voh.canvas.pages.grid.setColor(canvasId, color)
voh.canvas.pages.grid.setColor(canvasId, color, pageId)
voh.canvas.pages.grid.getColor(canvasId)
voh.canvas.pages.grid.getColor(canvasId, pageId)
voh.canvas.pages.grid.setOpacity(canvasId, opacity)
voh.canvas.pages.grid.setOpacity(canvasId, opacity, pageId)
voh.canvas.pages.grid.getOpacity(canvasId)
voh.canvas.pages.grid.getOpacity(canvasId, pageId)
voh.canvas.pages.grid.setThickness(canvasId, thickness)
voh.canvas.pages.grid.setThickness(canvasId, thickness, pageId)
voh.canvas.pages.grid.getThickness(canvasId)
voh.canvas.pages.grid.getThickness(canvasId, pageId)
voh.canvas.pages.grid.setStyle(canvasId, style)                // 'solid', 'dashed', 'dotted', 'dots'
voh.canvas.pages.grid.setStyle(canvasId, style, pageId)
voh.canvas.pages.grid.getStyle(canvasId)
voh.canvas.pages.grid.getStyle(canvasId, pageId)
voh.canvas.pages.grid.setVisible(canvasId, visible)
voh.canvas.pages.grid.setVisible(canvasId, visible, pageId)
voh.canvas.pages.grid.getVisible(canvasId)
voh.canvas.pages.grid.getVisible(canvasId, pageId)
voh.canvas.pages.grid.setSnapEnabled(canvasId, enabled)
voh.canvas.pages.grid.setSnapEnabled(canvasId, enabled, pageId)
voh.canvas.pages.grid.getSnapEnabled(canvasId)
voh.canvas.pages.grid.getSnapEnabled(canvasId, pageId)
```

---

## 9. VOH.CANVAS.PAGES.SELECTION — Rectangle de sélection souris par page

Style et activation du rectangle qu'on trace à la souris pour sélectionner des objets.

```javascript
voh.canvas.pages.selection.setEnabled(canvasId, enabled) // page active
voh.canvas.pages.selection.setEnabled(canvasId, enabled, pageId) // page ciblée
voh.canvas.pages.selection.getEnabled(canvasId)
voh.canvas.pages.selection.getEnabled(canvasId, pageId)
voh.canvas.pages.selection.setMouseButton(canvasId, button)     // 'left', 'middle', 'right'
voh.canvas.pages.selection.setMouseButton(canvasId, button, pageId)
voh.canvas.pages.selection.getMouseButton(canvasId)
voh.canvas.pages.selection.getMouseButton(canvasId, pageId)
voh.canvas.pages.selection.setBackgroundColor(canvasId, color)
voh.canvas.pages.selection.setBackgroundColor(canvasId, color, pageId)
voh.canvas.pages.selection.getBackgroundColor(canvasId)
voh.canvas.pages.selection.getBackgroundColor(canvasId, pageId)
voh.canvas.pages.selection.setBorderColor(canvasId, color)
voh.canvas.pages.selection.setBorderColor(canvasId, color, pageId)
voh.canvas.pages.selection.getBorderColor(canvasId)
voh.canvas.pages.selection.getBorderColor(canvasId, pageId)
voh.canvas.pages.selection.setBorderThickness(canvasId, thickness)
voh.canvas.pages.selection.setBorderThickness(canvasId, thickness, pageId)
voh.canvas.pages.selection.getBorderThickness(canvasId)
voh.canvas.pages.selection.getBorderThickness(canvasId, pageId)
voh.canvas.pages.selection.setBorderStyle(canvasId, style)      // 'solid', 'dashed', 'dotted'
voh.canvas.pages.selection.setBorderStyle(canvasId, style, pageId)
voh.canvas.pages.selection.getBorderStyle(canvasId)
voh.canvas.pages.selection.getBorderStyle(canvasId, pageId)

// Simulation programmatique (pas de pageId — toujours page active)
voh.canvas.pages.selection.simulate(canvasId, x1, y1, x2, y2, options)
voh.canvas.pages.selection.cancelSimulation(canvasId)
```

---

## 10. VOH.CANVAS.PAGES.CURSOR — Curseur par page

```javascript
voh.canvas.pages.cursor.set(canvasId, cursor)                  // 'default', 'pointer', 'crosshair', image...
voh.canvas.pages.cursor.set(canvasId, cursor, pageId)          // page ciblée
voh.canvas.pages.cursor.get(canvasId)
voh.canvas.pages.cursor.get(canvasId, pageId)
```

---

## 11. VOH.CANVAS.PAGES.HISTORY — Undo/Redo par page

```javascript
voh.canvas.pages.history.undo(canvasId) // page active
voh.canvas.pages.history.undo(canvasId, pageId) // page ciblée
voh.canvas.pages.history.redo(canvasId)
voh.canvas.pages.history.redo(canvasId, pageId)
voh.canvas.pages.history.canUndo(canvasId)
voh.canvas.pages.history.canUndo(canvasId, pageId)
voh.canvas.pages.history.canRedo(canvasId)
voh.canvas.pages.history.canRedo(canvasId, pageId)
voh.canvas.pages.history.getUndoCount(canvasId)
voh.canvas.pages.history.getUndoCount(canvasId, pageId)
voh.canvas.pages.history.getRedoCount(canvasId)
voh.canvas.pages.history.getRedoCount(canvasId, pageId)
voh.canvas.pages.history.clear(canvasId)
voh.canvas.pages.history.clear(canvasId, pageId)
voh.canvas.pages.history.setMaxLevel(canvasId, maxLevel)
voh.canvas.pages.history.setMaxLevel(canvasId, maxLevel, pageId)
voh.canvas.pages.history.getMaxLevel(canvasId)
voh.canvas.pages.history.getMaxLevel(canvasId, pageId)
```

---

## 12. VOH.OBJECTS — Objets graphiques

Les objets vivent sur une page. Sans pageId = page active.

```javascript
// Création / Suppression
voh.objects.create(canvasId, { name, x, y, width, height, ... })           // page active
voh.objects.create(canvasId, { name, x, y, width, height, ... }, pageId)   // page ciblée
voh.objects.delete(objectId)               // l'objet sait sur quelle page il est

// Informations
voh.objects.getCount(canvasId)             // total TOUTES les pages du canvas
voh.objects.getCount(canvasId, pageId)     // total d'une page
voh.objects.getList(canvasId)              // TOUS les objets, toutes pages
voh.objects.getList(canvasId, pageId)      // objets d'une page
voh.objects.exists(objectId)               // → boolean
voh.objects.getCanvasId(objectId)          // → canvasId
voh.objects.getPageId(objectId)            // → pageId  ← NOUVEAU

// Propriétés (objectId suffit — l'objet sait où il est)
voh.objects.setName(objectId, name)
voh.objects.getName(objectId)
voh.objects.setX(objectId, x)
voh.objects.getX(objectId)
voh.objects.setY(objectId, y)
voh.objects.getY(objectId)
voh.objects.setWidth(objectId, width)
voh.objects.getWidth(objectId)
voh.objects.setHeight(objectId, height)
voh.objects.getHeight(objectId)
voh.objects.setLocked(objectId, isLocked)
voh.objects.getLocked(objectId)
voh.objects.isLocked(objectId)
voh.objects.setVisible(objectId, isVisible)
voh.objects.getVisible(objectId)
voh.objects.isVisible(objectId)
voh.objects.setOpacity(objectId, opacity)
voh.objects.getOpacity(objectId)
voh.objects.setBackgroundColor(objectId, color)
voh.objects.getBackgroundColor(objectId)
voh.objects.setDrawingCallback(objectId, callback)
voh.objects.getDrawingCallback(objectId)
voh.objects.redraw(objectId)

// Z-order (objectId suffit)
voh.objects.bringToFront(objectId)
voh.objects.sendToBack(objectId)
voh.objects.moveUp(objectId)
voh.objects.moveDown(objectId)
voh.objects.setZOrder(objectId, zOrder)
voh.objects.getZOrder(objectId)
```

---

## 13. VOH.OBJECTS.SELECTION — Sélection d'objets

La sélection est par canvas. Elle se vide automatiquement au changement de page.
On ne peut sélectionner QUE des objets de la page active.

```javascript
voh.objects.selection.select(canvasId, objectId)       // l'objet doit être sur la page active
voh.objects.selection.deselect(canvasId, objectId)
voh.objects.selection.selectAll(canvasId)               // tous les objets de la PAGE ACTIVE
voh.objects.selection.clear(canvasId)                   // vide la sélection
voh.objects.selection.toggle(canvasId, objectId)        // ajoute/retire de la sélection
voh.objects.selection.getList(canvasId)                 // → [objectId, objectId, ...]
voh.objects.selection.getCount(canvasId)                // → nombre
voh.objects.selection.isSelected(canvasId, objectId)    // → boolean
```

Pas de pageId ici — la sélection travaille TOUJOURS sur la page active.

---

## 14. VOH.CLIPBOARD — Presse-papiers partagé

Partagé entre TOUS les canvas de l'instance VOH.

```javascript
voh.clipboard.copy(canvasId)              // copie la sélection actuelle
voh.clipboard.cut(canvasId)               // coupe la sélection actuelle
voh.clipboard.paste(canvasId)             // colle sur la page active
voh.clipboard.paste(canvasId, pageId)     // colle sur une page précise
voh.clipboard.hasContent()                // → boolean
voh.clipboard.clear()                     // vide le presse-papiers
```

---

## 15. VOH.OBJECTS.CONNECTIONS — Connexions entre objets

Les connexions vivent sur une page (comme les objets).

```javascript
voh.objects.connections.create(canvasId, sourceObjectId, targetObjectId, options)   // page active
voh.objects.connections.create(canvasId, sourceObjectId, targetObjectId, options, pageId)
voh.objects.connections.delete(connectionId)
voh.objects.connections.getList(canvasId)              // toutes les connexions, toutes pages
voh.objects.connections.getList(canvasId, pageId)      // connexions d'une page
voh.objects.connections.getCount(canvasId)
voh.objects.connections.getCount(canvasId, pageId)
voh.objects.connections.exists(connectionId)
voh.objects.connections.getPageId(connectionId)        // → pageId
```

---

## 16. ÉVÉNEMENTS

Format domaine:action. Tous les événements passent les IDs pertinents dans data.

```
// Zone
zone:created            { zoneId, name }
zone:deleted            { zoneId, name }
zone:activated          { zoneId, previousZoneId }
zone:resized            { zoneId, width, height }
zone:renamed            { zoneId, name }
zone:backgroundChanged  { zoneId, property, value }
zone:borderChanged      { zoneId, property, value }
zone:gridChanged        { zoneId, property, value }
zone:scrollChanged      { zoneId, scrollX, scrollY }
zone:zoomChanged        { zoneId, zoom, previousZoom }
zone:scrollbarVisibleChanged      { zoneId, visible }
zone:bringCanvasToFrontOnActivationChanged { zoneId, enabled }

// Canvas
canvas:created          { canvasId, zoneId, name }
canvas:deleted          { canvasId, zoneId, name }
canvas:activated        { canvasId, previousCanvasId }
canvas:deactivated      { canvasId }
canvas:moved            { canvasId, x, y }
canvas:locked           { canvasId }
canvas:unlocked         { canvasId }
canvas:shown            { canvasId }
canvas:hidden           { canvasId }
canvas:nameChanged      { canvasId, name }
canvas:zOrderChanged    { canvasId, zOrder }

// Pages
page:added              { canvasId, pageId, name }
page:removed            { canvasId, pageId, name }
page:activated          { canvasId, pageId, previousPageId }
page:renamed            { canvasId, pageId, name }
page:moved              { canvasId, pageId, index }
page:duplicated         { canvasId, pageId, newPageId }
page:resized            { canvasId, pageId, width, height }
page:backgroundChanged  { canvasId, pageId, property, value }
page:borderChanged      { canvasId, pageId, property, value }
page:gridChanged        { canvasId, pageId, property, value }
page:selectionStyleChanged { canvasId, pageId, property, value }
page:cursorChanged      { canvasId, pageId, cursor }
page:undone             { canvasId, pageId }
page:redone             { canvasId, pageId }
page:historyCleared     { canvasId, pageId }

// Objets
object:created          { objectId, canvasId, pageId, name }
object:deleted          { objectId, canvasId, pageId, name }
object:moved            { objectId, x, y, previousX, previousY }
object:resized          { objectId, width, height }
object:locked           { objectId }
object:unlocked         { objectId }
object:shown            { objectId }
object:hidden           { objectId }
object:opacityChanged   { objectId, opacity }
object:backgroundColorChanged { objectId, backgroundColor }
object:nameChanged      { objectId, name }
object:zOrderChanged    { objectId, zOrder }
object:drawingCallbackChanged { objectId }

// Sélection d'objets
selection:changed       { canvasId, selected, deselected }
selection:cleared       { canvasId }

// Rectangle de sélection souris
selectionRect:started   { canvasId, x, y }
selectionRect:ended     { canvasId, x, y, width, height }

// Clipboard
clipboard:copied        { canvasId, objectIds }
clipboard:cut           { canvasId, objectIds }
clipboard:pasted        { canvasId, pageId, objectIds }

// Connexions
connection:created      { connectionId, canvasId, pageId, sourceId, targetId }
connection:deleted      { connectionId, canvasId, pageId }
```

---

## RÉCAPITULATIF — PAR PAGE vs GLOBAL

### Par page (change quand on change de page) :
- Dimensions (largeur, hauteur)
- Couleur de fond
- Image de fond (+ opacité, mode, échelle, rotation, flip, flou)
- Bordure (couleur, épaisseur, style)
- Arrondi des coins
- Grille/Snap
- Style rectangle de sélection souris (couleur, bordure, enabled, bouton)
- Curseur
- Objets
- Connexions
- Undo/Redo

### Global au canvas (ne change pas entre les pages) :
- Position X, Y dans la zone
- Nom
- Verrouillage
- Visibilité
- Opacité
- Z-order
- Barre de titre
- Poignées de redimensionnement du canvas
- Icône de déplacement
- Docking
- Tolérance d'interaction

### Global à l'instance VOH :
- Clipboard (partagé entre tous les canvas)
- Thème
- Langue
