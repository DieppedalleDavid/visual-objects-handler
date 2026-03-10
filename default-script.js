/* ═══════════════════════════════════════════════════════════════════════════
   SCRIPT PAR DÉFAUT — Template affiché dans l'éditeur au premier lancement.
   Fichier externe pour faciliter la maintenance et la personnalisation.
   Utilisé par Index.html via la variable globale VOH_DEFAULT_SCRIPT.
   ═══════════════════════════════════════════════════════════════════════════ */

// eslint-disable-next-line no-unused-vars
const VOH_DEFAULT_SCRIPT = `// ═══════════════════════════════════════════════════════════════
// VOH — Script de démarrage
// ═══════════════════════════════════════════════════════════════
//
// Ce script crée une scène complète avec une zone, un canevas
// et un objet, en montrant TOUS les paramètres disponibles.
//
// Chaque paramètre est commenté. Modifiez les valeurs et
// appuyez sur F5 pour voir le résultat immédiatement.
//
// Les valeurs ci-dessous sont celles utilisées par ce script.
// Supprimez un paramètre pour utiliser la valeur par défaut.
//
// ═══════════════════════════════════════════════════════════════


// ── Initialisation de VOH ─────────────────────────────────────
// VisualObjectsHandler est la classe principale du moteur.
// On lui passe un élément HTML (<div>) qui sert de conteneur.
const voh = new VisualObjectsHandler(document.getElementById('container'));
await voh.init(); // Initialise le moteur (asynchrone, attendre avec await).


// ═══════════════════════════════════════════════════════════════
// ZONE — Conteneur de premier niveau
// ═══════════════════════════════════════════════════════════════
// Une zone contient un fond, une grille, une bordure et un ou
// plusieurs canevas. Tous les paramètres sont optionnels.

const zone = voh.zone.create({

    name: 'Ma zone',                               // Nom (affiché dans les logs et l'interface).

    // ── Dimensions ──
    width:  null,                                   // Largeur en pixels (null = 100% du parent).
    height: null,                                   // Hauteur en pixels (null = 100% du parent).

    // ── Fond ──
    backgroundColor:    'rgba(40, 40, 55, 1.0)',    // Couleur de fond (format CSS).
    backgroundImage:    '',                          // Image de fond (URL ou data:URI, '' = aucune).
    backgroundImageOpacity: 1.0,                     // Opacité de l'image (0.0 à 1.0).

    // ── Grille ──
    gridWidth:     40,                               // Largeur des cases en pixels.
    gridHeight:    40,                               // Hauteur des cases en pixels.
    gridColor:     'rgba(100, 200, 255, 1.0)',       // Couleur des lignes.
    gridOpacity:   0.15,                             // Opacité des lignes (0.0 à 1.0).
    gridIsVisible: true,                             // Afficher la grille.

    // ── Bordure ──
    borderColor:     'rgba(100, 200, 255, 0.6)',     // Couleur de la bordure.
    borderThickness: 2,                              // Épaisseur en pixels.

    // ── Viewport ──
    scrollbarIsVisible: true,                        // Scrollbars automatiques.
    zoom: 1.0,                                       // Niveau de zoom (1.0 = 100%).

    // ── Comportement ──
    bringCanvasToFrontOnActivation: false             // Le canevas cliqué passe devant les autres.
});


// ═══════════════════════════════════════════════════════════════
// CANEVAS — Surface de travail dans la zone
// ═══════════════════════════════════════════════════════════════
// Un canevas est une surface indépendante (sélection, objets,
// historique, pages). On place les objets visuels dessus.

const canvas = voh.canvas.create(zone, {

    name: 'Mon canevas',                             // Nom du canevas.

    // ── Position dans la zone ──
    x: 50,                                           // Position X en pixels.
    y: 50,                                           // Position Y en pixels.

    // ── Dimensions ──
    width:  800,                                     // Largeur en pixels.
    height: 600,                                     // Hauteur en pixels.

    // ── Fond ──
    backgroundColor: 'rgba(255, 255, 255, 1.0)',     // Couleur de fond.

    // ── État ──
    isLocked:  false,                                // Verrouillé (empêche déplacement souris).
    isVisible: true,                                 // Visible (false = masqué sans supprimer).
    opacity:   1.0,                                  // Opacité globale (0.0 à 1.0).

    // ── Sélection à la souris (rectangle de sélection) ──
    selectionEnabled:          true,                 // Activer le rectangle de sélection.
    selectionMouseButton:      'left',               // Bouton ('left', 'middle' ou 'right').
    selectionBackgroundColor:  'rgba(0, 120, 215, 0.15)', // Fond du rectangle.
    selectionBorderColor:      'rgba(0, 120, 215, 0.8)',  // Bordure du rectangle.
    selectionBorderThickness:  1,                    // Épaisseur de la bordure.
    selectionBorderStyle:      'solid'               // Style ('solid', 'dashed' ou 'dotted').
});


// ── Activer le canevas ───────────────────────────────────────
// Un seul canevas peut être édité à la fois par zone.
voh.canvas.setActive(canvas);


// ── Bordure du canevas (propriété de la page active) ─────────
voh.canvas.pages.border.setVisible(canvas, true);
voh.canvas.pages.border.setColor(canvas, 'rgba(0, 120, 215, 0.5)');
voh.canvas.pages.border.setThickness(canvas, 2);
voh.canvas.pages.border.setStyle(canvas, 'solid');      // 'solid', 'dashed', 'dotted'.
voh.canvas.pages.border.setCornerRadius(canvas, 0);     // Arrondi des coins en pixels.

// ── Grille du canevas (propriété de la page active) ──────────
voh.canvas.pages.grid.setVisible(canvas, true);
voh.canvas.pages.grid.setCellWidth(canvas, 25);         // Largeur des cases.
voh.canvas.pages.grid.setCellHeight(canvas, 25);        // Hauteur des cases.
voh.canvas.pages.grid.setColor(canvas, 'rgba(0, 0, 0, 0.08)'); // Couleur.
voh.canvas.pages.grid.setOpacity(canvas, 1.0);          // Opacité.
voh.canvas.pages.grid.setThickness(canvas, 1);          // Épaisseur des lignes.
voh.canvas.pages.grid.setStyle(canvas, 'solid');         // 'solid', 'dashed', 'dotted'.
voh.canvas.pages.grid.setSnapEnabled(canvas, false);    // Magnétisme sur la grille.

// Attendre que le rendu Pixi.js soit prêt.
await voh.canvas.waitForRender(canvas);


// ═══════════════════════════════════════════════════════════════
// CALLBACKS DE DESSIN
// ═══════════════════════════════════════════════════════════════

// Dessin principal de l'objet (fond jaune, bordure rouge 1px).
// ctx = contexte Canvas 2D, w = largeur, h = hauteur, id = identifiant de l'objet.
function dessinerObjet(ctx, w, h, id) {
    // Fond jaune
    // fillStyle — couleur de remplissage.
    //   Formats acceptés — '#ff0000', 'rgb(255,0,0)', 'rgba(255,0,0,0.5)', 'red',
    //   'hsl(0,100%,50%)', 'hsla(0,100%,50%,0.5)', ctx.createLinearGradient(),
    //   ctx.createRadialGradient(), ctx.createPattern().
    ctx.fillStyle = '#f5c542';
    // fillRect(x, y, largeur, hauteur) — dessine un rectangle plein.
    ctx.fillRect(0, 0, w, h);

    // Bordure rouge (1px à l'intérieur)
    // strokeStyle — couleur du contour (mêmes formats que fillStyle).
    ctx.strokeStyle = '#e03030';
    // lineWidth — épaisseur du trait en pixels (0.5, 1, 2, 3...).
    ctx.lineWidth = 1;
    // strokeRect(x, y, largeur, hauteur) — dessine un contour rectangulaire.
    //   Décalage 0.5px pour un rendu net sur les écrans non-Retina.
    ctx.strokeRect(0.5, 0.5, w - 1, h - 1);

    // Texte centré
    // fillStyle — couleur du texte (mêmes formats que ci-dessus).
    ctx.fillStyle = '#2563eb';
    // font — police du texte.
    //   Format CSS — 'taille famille' ou 'style poids taille famille'.
    //   Styles — 'normal', 'italic', 'oblique'.
    //   Poids — 'normal', 'bold', 'lighter', 'bolder', 100 à 900.
    //   Taille — '12px', '1em', '14pt'.
    //   Familles — 'sans-serif', 'serif', 'monospace', 'Arial', 'Segoe UI', etc.
    ctx.font = 'bold 14px sans-serif';
    // textAlign — alignement horizontal du texte par rapport à la position X.
    //   'left', 'right', 'center', 'start' (défaut), 'end'.
    ctx.textAlign = 'center';
    // textBaseline — alignement vertical du texte par rapport à la position Y.
    //   'top', 'hanging', 'middle', 'alphabetic' (défaut), 'ideographic', 'bottom'.
    ctx.textBaseline = 'middle';
    // fillText(texte, x, y) — dessine le texte à la position donnée.
    //   strokeText(texte, x, y) dessine le contour du texte à la place.
    ctx.fillText('Objet ' + id, w / 2, h / 2);
}

// Fantôme affiché pendant le drag en mode preview.
// Même forme mais semi-transparent avec bordure en tirets.
function dessinerFantome(ctx, w, h, id) {
    // Fond jaune transparent
    ctx.fillStyle = 'rgba(245, 197, 66, 0.25)';
    ctx.fillRect(0, 0, w, h);

    // Bordure rouge en tirets (1px)
    // setLineDash([longueur, espace]) — active les tirets.
    //   [] = trait continu, [5, 5] = tirets égaux, [10, 5, 2, 5] = alternés.
    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = 'rgba(224, 48, 48, 0.6)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, w - 1, h - 1);

    // Texte centré (bleu semi-transparent)
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(37, 99, 235, 0.5)';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Objet ' + id, w / 2, h / 2);
}


// ═══════════════════════════════════════════════════════════════
// OBJET — Forme visuelle sur le canevas
// ═══════════════════════════════════════════════════════════════
// Un objet est un élément visuel que l'utilisateur peut manipuler.
// Le drawingCallback dessine le contenu (texte, formes, icônes).

const objet = voh.objects.create(canvas, {

    name: 'Mon objet',                              // Nom de l'objet.

    // ── Position et dimensions ──
    x: 100,                                          // Position X sur le canevas (pixels).
    y: 80,                                           // Position Y sur le canevas (pixels).
    width:  200,                                     // Largeur en pixels (minimum 5).
    height: 120,                                     // Hauteur en pixels (minimum 5).

    // ── Apparence ──
    backgroundColor: 'rgba(200, 200, 200, 1.0)',     // Couleur de fond (ignoré si drawingCallback).
    opacity: 1.0,                                    // Opacité (0.0 à 1.0).

    // ── Dessin personnalisé ──
    // Reçoit (context2D, largeur, hauteur, identifiantObjet).
    drawingCallback: dessinerObjet,

    // ── État ──
    isLocked:  false,                                // Verrouillé (empêche modification souris).
    isVisible: true,                                 // Visible (false = masqué sans supprimer).

    // ── Curseur ──
    cursor: 'grab',                                  // Curseur CSS au survol (null = défaut canevas).

    // ── Drag souris ──
    mouseDragEnabled: true,                          // Activer le déplacement à la souris.
    mouseDragButton:  'left',                        // Bouton ('left', 'middle' ou 'right').
    mouseDragMode:    'preview',                     // 'direct' = bouge en temps réel.
                                                     // 'preview' = fantôme, l'objet saute à la fin.
    mouseDragOffsetX: 0,                             // Décalage X du curseur (0 = position relative).
    mouseDragOffsetY: 0,                             // Décalage Y du curseur.

    // ── Fantôme du drag (mode preview) ──
    // Callback de dessin du fantôme en solo.
    // null = pointillés bleus par défaut.
    mouseDragPreviewCallback: dessinerFantome,

    // ── Multi-sélection drag ──
    mouseDragMultiMode: null,                        // Mode en multi (null = hérite de mouseDragMode).
                                                     // 'direct' ou 'preview' pour un mode différent.
    mouseDragMultiPreviewCallback: null,             // Fantôme multi (null = hérite du solo).

    // ── Contour de sélection (quand l'objet est sélectionné) ──
    selectionBorderColor:     'rgba(0, 0, 0, 1)', // Bordure blanche.
    selectionBorderThickness: 1,                     // Épaisseur 1 pixel.
    selectionBorderOffset:    1,                    // 1 pixels vers l'intérieur de l'objet.
    selectionBorderStyle:     'dotted',              // Ligne pointillée.

    // ── Mode de sélection par rectangle ──
    selectionMode: 'enclosed'                        // 'enclosed' = entièrement dans le rectangle.
                                                     // 'intersect' = dès qu'il touche le rectangle.
});


// ═══════════════════════════════════════════════════════════════
// ÉVÉNEMENTS — Réagir aux interactions
// ═══════════════════════════════════════════════════════════════

// Curseur grab/grabbing pendant le drag.
voh.on('object:dragstart', (data) => {
    if (voh.objects.getCursor(data.objectId) === 'grab')
        voh.objects.setCursor(data.objectId, 'grabbing');
});
voh.on('object:dragend', (data) => {
    if (voh.objects.getCursor(data.objectId) === 'grabbing')
        voh.objects.setCursor(data.objectId, 'grab');
});
voh.on('object:dragcancel', (data) => {
    if (voh.objects.getCursor(data.objectId) === 'grabbing')
        voh.objects.setCursor(data.objectId, 'grab');
});

// Clic sur un objet.
voh.on('object:click', (data) => {
    console.log('Clic sur "' + voh.objects.getName(data.objectId) + '"'
        + ' à (' + data.x + ', ' + data.y + ')');
});

// Changement de sélection.
voh.on('selection:changed', (data) => {
    console.log('Sélection —', data.selectedIds.length, 'objet(s)');
});


// ── Nettoyer l'historique ─────────────────────────────────────
// Les appels ci-dessus (bordure, grille, etc.) ont créé des
// entrées dans l'historique. On vide tout pour que l'utilisateur
// démarre avec un historique vierge (0 undo / 0 redo).
voh.canvas.pages.history.clear(canvas);


// ═══════════════════════════════════════════════════════════════
// INFORMATIONS — Console F12
// ═══════════════════════════════════════════════════════════════

console.log('═══════════════════════════════════════════');
console.log('VOH — Script de démarrage');
console.log('═══════════════════════════════════════════');
console.log('');
console.log('Version —', voh.getVersion());
console.log('Zone —', voh.zone.getName(zone), '(ID', zone + ')');
console.log('Canevas —', voh.canvas.getName(canvas), '(ID', canvas + ')');
console.log('Objet —', voh.objects.getName(objet), '(ID', objet + ')');
console.log('');
console.log('Modifiez ce script et appuyez sur F5.');

// ── Diagnostic (décommentez si besoin) ────────────────────────
// voh.diagnostics.showReport();     Rapport dans une fenêtre.
// voh.diagnostics.downloadReport(); Télécharge en .txt.
`;