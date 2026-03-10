// ═══════════════════════════════════════════════════════════════
// VOH — Canevas: Exemple 09: Événements canvas
// ═══════════════════════════════════════════════════════════════
//
// Ce script montre comment:
// - Écouter les 14 types d'événements émis par les canvas
// - Comprendre quand chaque événement est déclenché
// - Voir les données reçues dans chaque callback
//
// Chaque action sur un canvas (création, déplacement,
// verrouillage, etc.) émet un événement capturable.
// On s'abonne avec voh.on('canvas:...', callback) et on reçoit
// un objet de données contenant les informations de l'événement.
//
// 14 types d'événements canvas (étape 1a):
//   canvas:created, canvas:deleted, canvas:activated,
//   canvas:deactivated, canvas:moved, canvas:resized,
//   canvas:locked, canvas:unlocked, canvas:shown, canvas:hidden,
//   canvas:opacityChanged, canvas:nameChanged, canvas:zOrderChanged,
//   canvas:backgroundColorChanged
//
// Les démonstrations s'enchaînent avec un délai entre chaque
// partie pour que vous puissiez suivre les logs dans la console.
//
// ═══════════════════════════════════════════════════════════════


// ── Initialisation de VOH ──────────────────────────────────────
// VisualObjectsHandler est la classe principale du moteur VOH.
// On lui passe un élément HTML (<div>) qui servira de conteneur
// pour afficher les zones, canvas et objets visuels.
// Le conteneur 'container' est un <div> présent dans runner.html.
const voh = new VisualObjectsHandler(document.getElementById('container')); // crée l'instance VOH dans le conteneur HTML

// init() prépare le moteur (allocation des ressources internes).
// C'est une fonction asynchrone — on DOIT attendre qu'elle finisse
// avec 'await' avant de pouvoir utiliser quoi que ce soit.
await voh.init(); // initialise le moteur (asynchrone, attendre avec await)


// ═══════════════════════════════════════════════════════════════
// ABONNEMENTS — On s'inscrit aux 13 événements canvas AVANT
// de faire quoi que ce soit, pour tout capturer dès le début.
// ═══════════════════════════════════════════════════════════════

// ── canvas:created — émis quand un canvas est créé ──
// Données: { canvasId, zoneId, name }
// Déclenché par voh.canvas.create().
voh.on('canvas:created', (data) => { // écoute les créations de canvas
    console.log('📦 canvas:created — ID:', data.canvasId, '— Zone:', data.zoneId, '— Nom:', data.name);
});

// ── canvas:deleted — émis quand un canvas est supprimé ──
// Données: { canvasId, zoneId, name }
// Déclenché par voh.canvas.delete().
voh.on('canvas:deleted', (data) => { // écoute les suppressions de canvas
    console.log('🗑️ canvas:deleted — ID:', data.canvasId, '— Nom:', data.name);
});

// ── canvas:activated — émis quand un canvas devient actif ──
// Données: { canvasId, previousCanvasId }
// Déclenché par voh.canvas.setActive() ou automatiquement
// lors de la première création ou après une suppression.
voh.on('canvas:activated', (data) => { // écoute les activations de canvas
    console.log('👁️ canvas:activated — ID:', data.canvasId, '— Précédent:', data.previousCanvasId);
});

// ── canvas:deactivated — émis quand un canvas perd le focus ──
// Données: { canvasId }
// Déclenché automatiquement quand un autre canvas est activé.
voh.on('canvas:deactivated', (data) => { // écoute les désactivations de canvas
    console.log('💤 canvas:deactivated — ID:', data.canvasId);
});

// ── canvas:moved — émis quand la position X ou Y change ──
// Données: { canvasId, x, y }
// Déclenché par voh.canvas.setX() ou voh.canvas.setY().
// Note: chaque appel à setX ou setY émet un événement séparé.
voh.on('canvas:moved', (data) => { // écoute les déplacements de canvas
    console.log('↔️ canvas:moved — ID:', data.canvasId, '— Position:', data.x, ',', data.y);
});

// ── canvas:resized — émis quand la largeur ou hauteur change ──
// Données: { canvasId, width, height }
// Déclenché par voh.canvas.setWidth() ou voh.canvas.setHeight().
voh.on('canvas:resized', (data) => { // écoute les redimensionnements de canvas
    console.log('📐 canvas:resized — ID:', data.canvasId, '— Taille:', data.width, '×', data.height);
});

// ── canvas:locked — émis quand un canvas est verrouillé ──
// Données: { canvasId }
// Déclenché par voh.canvas.setLocked(id, true).
voh.on('canvas:locked', (data) => { // écoute les verrouillages de canvas
    console.log('🔒 canvas:locked — ID:', data.canvasId);
});

// ── canvas:unlocked — émis quand un canvas est déverrouillé ──
// Données: { canvasId }
// Déclenché par voh.canvas.setLocked(id, false).
voh.on('canvas:unlocked', (data) => { // écoute les déverrouillages de canvas
    console.log('🔓 canvas:unlocked — ID:', data.canvasId);
});

// ── canvas:shown — émis quand un canvas masqué redevient visible ──
// Données: { canvasId }
// Déclenché par voh.canvas.setVisible(id, true) sur un canvas masqué.
voh.on('canvas:shown', (data) => { // écoute les réaffichages de canvas
    console.log('👀 canvas:shown — ID:', data.canvasId);
});

// ── canvas:hidden — émis quand un canvas est masqué ──
// Données: { canvasId }
// Déclenché par voh.canvas.setVisible(id, false).
voh.on('canvas:hidden', (data) => { // écoute les masquages de canvas
    console.log('🙈 canvas:hidden — ID:', data.canvasId);
});

// ── canvas:opacityChanged — émis quand l'opacité change ──
// Données: { canvasId, opacity }
// Déclenché par voh.canvas.setOpacity().
voh.on('canvas:opacityChanged', (data) => { // écoute les changements d'opacité
    console.log('🌫️ canvas:opacityChanged — ID:', data.canvasId, '— Opacité:', data.opacity);
});

// ── canvas:nameChanged — émis quand le nom change ──
// Données: { canvasId, name }
// Déclenché par voh.canvas.setName().
voh.on('canvas:nameChanged', (data) => { // écoute les changements de nom
    console.log('✏️ canvas:nameChanged — ID:', data.canvasId, '— Nom:', data.name);
});

// ── canvas:zOrderChanged — émis quand le z-order change ──
// Données: { canvasId, zOrder }
// Déclenché par bringToFront, sendToBack, moveUp, moveDown.
// Note: moveUp et moveDown échangent le z-order de 2 canvas,
// donc chacun émet un événement (2 événements au total).
voh.on('canvas:zOrderChanged', (data) => { // écoute les changements de z-order
    console.log('📊 canvas:zOrderChanged — ID:', data.canvasId, '— Z-order:', data.zOrder);
});

// ── canvas:backgroundColorChanged — émis quand la couleur de fond change ──
// Données: { canvasId, backgroundColor }
// Déclenché par voh.canvas.setBackgroundColor().
voh.on('canvas:backgroundColorChanged', (data) => { // écoute les changements de couleur de fond
    console.log('🎨 canvas:backgroundColorChanged — ID:', data.canvasId, '— Couleur:', data.backgroundColor);
});

console.log('✅ 14 abonnements canvas en place. Les démonstrations commencent...');
console.log('');


// ═══════════════════════════════════════════════════════════════
// Variables partagées entre les étapes.
// Déclarées avec let car elles seront assignées plus bas.
// ═══════════════════════════════════════════════════════════════
let zone1   = null; // ID de la zone (assigné dans PARTIE 1)
let canvas1 = null; // ID du premier canvas (assigné dans PARTIE 1)
let canvas2 = null; // ID du deuxième canvas (assigné dans PARTIE 1)


// ═══════════════════════════════════════════════════════════════
// PARTIE 1 (0s): Créer une zone et deux canvas
// ═══════════════════════════════════════════════════════════════
// Événements attendus: canvas:created (×2), canvas:activated (×1)

console.log('══════════════════════════════════════════════════');
console.log(' PARTIE 1: Création (canvas:created, canvas:activated)');
console.log('══════════════════════════════════════════════════');
console.log('');

// ── Créer une zone (conteneur de premier niveau) ───────────────
zone1 = voh.zone.create({ // crée une zone, retourne son ID
    name: 'Zone test',                             // nom pour identifier la zone
    backgroundColor: 'rgba(40, 40, 50, 1.0)',      // couleur de fond (gris foncé)
    borderColor: 'rgba(80, 80, 100, 1.0)',         // couleur de la bordure (gris clair)
    borderThickness: 2                                 // épaisseur de la bordure en pixels
});

// ── Créer 2 canvas dans la zone ────────────────────────────────
// Le premier canvas créé émet canvas:created + canvas:activated.
canvas1 = voh.canvas.create(zone1, { // crée Canvas A (premier = auto-activé), retourne son ID
    name: 'Canvas A',                              // nom du canvas
    x: 30, y: 30,                                  // position dans la zone (pixels)
    width: 500, height: 350,                       // taille du canvas (pixels)
    backgroundColor: 'rgba(255, 255, 255, 1.0)'    // couleur de fond (blanc)
});

// Le deuxième canvas émet seulement canvas:created (pas activated).
canvas2 = voh.canvas.create(zone1, { // crée Canvas B, retourne son ID
    name: 'Canvas B',                              // nom du canvas
    x: 560, y: 30,                                 // décalé à droite du premier
    width: 400, height: 250,                       // taille plus petite
    backgroundColor: 'rgba(240, 248, 255, 1.0)'    // couleur de fond (bleu très clair)
});

console.log('');
console.log('   → 2× canvas:created + 1× canvas:activated (automatique pour le premier).');
console.log('   → Prochaine étape dans 3 secondes...');


// ═══════════════════════════════════════════════════════════════
// PARTIE 2 (3s): Activation / Désactivation
// ═══════════════════════════════════════════════════════════════
// Événements attendus: canvas:deactivated (×1), canvas:activated (×1)

setTimeout(() => { // exécute le bloc après 3 secondes

    console.log('');
    console.log('══════════════════════════════════════════════════');
    console.log(' PARTIE 2: Activation (canvas:deactivated, canvas:activated)');
    console.log('══════════════════════════════════════════════════');
    console.log('');

    // Activer le canvas B → le canvas A est désactivé automatiquement.
    // Ordre des événements: d'abord deactivated (ancien), puis activated (nouveau).
    voh.canvas.setActive(canvas2); // active Canvas B, désactive Canvas A

    console.log('');
    console.log('   → Le canvas A émet deactivated, puis le canvas B émet activated.');
    console.log('   → Prochaine étape dans 3 secondes...');

}, 3000);


// ═══════════════════════════════════════════════════════════════
// PARTIE 3 (6s): Déplacement et redimensionnement
// ═══════════════════════════════════════════════════════════════
// Événements attendus: canvas:moved (×2), canvas:resized (×2)

setTimeout(() => { // exécute le bloc après 6 secondes

    console.log('');
    console.log('══════════════════════════════════════════════════');
    console.log(' PARTIE 3: Position et taille (canvas:moved, canvas:resized)');
    console.log('══════════════════════════════════════════════════');
    console.log('');

    // Chaque appel à setX ou setY émet un canvas:moved séparé.
    console.log('── Déplacer le canvas A ──');
    voh.canvas.setX(canvas1, 100); // déplace à 100px du bord gauche
    voh.canvas.setY(canvas1, 80);  // déplace à 80px du bord supérieur

    console.log('');

    // De même, chaque appel à setWidth ou setHeight émet un canvas:resized.
    console.log('── Redimensionner le canvas A ──');
    voh.canvas.setWidth(canvas1, 700);  // agrandit la largeur à 700px
    voh.canvas.setHeight(canvas1, 450); // agrandit la hauteur à 450px

    console.log('');
    console.log('   → 2× canvas:moved (un par setX, un par setY).');
    console.log('   → 2× canvas:resized (un par setWidth, un par setHeight).');
    console.log('   → Prochaine étape dans 3 secondes...');

}, 6000);


// ═══════════════════════════════════════════════════════════════
// PARTIE 4 (9s): Renommage
// ═══════════════════════════════════════════════════════════════
// Événements attendus: canvas:nameChanged (×1)

setTimeout(() => { // exécute le bloc après 9 secondes

    console.log('');
    console.log('══════════════════════════════════════════════════');
    console.log(' PARTIE 4: Renommage (canvas:nameChanged)');
    console.log('══════════════════════════════════════════════════');
    console.log('');

    // setName() émet canvas:nameChanged avec le nouveau nom.
    voh.canvas.setName(canvas1, 'Canvas A (renommé)'); // renomme le canvas A

    console.log('');
    console.log('   → 1× canvas:nameChanged.');
    console.log('   → Prochaine étape dans 3 secondes...');

}, 9000);


// ═══════════════════════════════════════════════════════════════
// PARTIE 5 (12s): Z-order
// ═══════════════════════════════════════════════════════════════
// Événements attendus: canvas:zOrderChanged (plusieurs)

setTimeout(() => { // exécute le bloc après 12 secondes

    console.log('');
    console.log('══════════════════════════════════════════════════');
    console.log(' PARTIE 5: Z-order (canvas:zOrderChanged)');
    console.log('══════════════════════════════════════════════════');
    console.log('');

    // bringToFront émet 1 événement (le canvas qui monte).
    console.log('── bringToFront (canvas A) ──');
    voh.canvas.bringToFront(canvas1); // canvas A passe au-dessus de tout

    console.log('');

    // sendToBack émet 1 événement (le canvas qui descend).
    console.log('── sendToBack (canvas A) ──');
    voh.canvas.sendToBack(canvas1); // canvas A passe derrière tout

    console.log('');

    // moveUp échange les z-order de deux canvas → 2 événements.
    console.log('── moveUp (canvas A) ──');
    voh.canvas.moveUp(canvas1); // canvas A monte d'un cran

    console.log('');

    // moveDown échange les z-order de deux canvas → 2 événements.
    console.log('── moveDown (canvas A) ──');
    voh.canvas.moveDown(canvas1); // canvas A redescend d'un cran

    console.log('');
    console.log('   → Chaque changement de z-order émet un événement par canvas affecté.');
    console.log('   → Prochaine étape dans 3 secondes...');

}, 12000);


// ═══════════════════════════════════════════════════════════════
// PARTIE 6 (15s): Verrouillage
// ═══════════════════════════════════════════════════════════════
// Événements attendus: canvas:locked (×1), canvas:unlocked (×1)

setTimeout(() => { // exécute le bloc après 15 secondes

    console.log('');
    console.log('══════════════════════════════════════════════════');
    console.log(' PARTIE 6: Verrouillage (canvas:locked, canvas:unlocked)');
    console.log('══════════════════════════════════════════════════');
    console.log('');

    // setLocked(id, true) émet canvas:locked.
    console.log('── Verrouiller ──');
    voh.canvas.setLocked(canvas1, true); // verrouille le canvas A

    console.log('');

    // setLocked(id, false) émet canvas:unlocked.
    console.log('── Déverrouiller ──');
    voh.canvas.setLocked(canvas1, false); // déverrouille le canvas A

    console.log('');
    console.log('   → 1× canvas:locked + 1× canvas:unlocked.');
    console.log('   → Prochaine étape dans 3 secondes...');

}, 15000);


// ═══════════════════════════════════════════════════════════════
// PARTIE 7 (18s): Visibilité
// ═══════════════════════════════════════════════════════════════
// Événements attendus: canvas:hidden (×1), canvas:shown (×1)

setTimeout(() => { // exécute le bloc après 18 secondes

    console.log('');
    console.log('══════════════════════════════════════════════════');
    console.log(' PARTIE 7: Visibilité (canvas:hidden, canvas:shown)');
    console.log('══════════════════════════════════════════════════');
    console.log('');

    // setVisible(id, false) émet canvas:hidden.
    console.log('── Masquer le canvas B ──');
    voh.canvas.setVisible(canvas2, false); // masque le canvas B

    console.log('');

    // setVisible(id, true) émet canvas:shown.
    console.log('── Réafficher le canvas B ──');
    voh.canvas.setVisible(canvas2, true); // réaffiche le canvas B

    console.log('');
    console.log('   → 1× canvas:hidden + 1× canvas:shown.');
    console.log('   → Prochaine étape dans 3 secondes...');

}, 18000);


// ═══════════════════════════════════════════════════════════════
// PARTIE 8 (21s): Opacité
// ═══════════════════════════════════════════════════════════════
// Événements attendus: canvas:opacityChanged (×2)

setTimeout(() => { // exécute le bloc après 21 secondes

    console.log('');
    console.log('══════════════════════════════════════════════════');
    console.log(' PARTIE 8: Opacité (canvas:opacityChanged)');
    console.log('══════════════════════════════════════════════════');
    console.log('');

    // setOpacity() émet canvas:opacityChanged à chaque modification.
    console.log('── Opacité à 30% ──');
    voh.canvas.setOpacity(canvas2, 0.3); // rend le canvas B très transparent

    console.log('');

    console.log('── Opacité restaurée à 100% ──');
    voh.canvas.setOpacity(canvas2, 1.0); // remet le canvas B opaque

    console.log('');
    console.log('   → 2× canvas:opacityChanged.');
    console.log('   → Prochaine étape dans 3 secondes...');

}, 21000);


// ═══════════════════════════════════════════════════════════════
// PARTIE 9 (24s): Couleur de fond
// ═══════════════════════════════════════════════════════════════
// Événements attendus: canvas:backgroundColorChanged (×2)

setTimeout(() => { // exécute le bloc après 24 secondes

    console.log('');
    console.log('══════════════════════════════════════════════════');
    console.log(' PARTIE 9: Couleur de fond (canvas:backgroundColorChanged)');
    console.log('══════════════════════════════════════════════════');
    console.log('');

    // setBackgroundColor() émet canvas:backgroundColorChanged à chaque modification.
    console.log('── Couleur de fond rouge ──');
    voh.canvas.setBackgroundColor(canvas1, 'rgba(220, 80, 80, 1.0)'); // passe le canvas A en rouge

    console.log('');

    console.log('── Couleur de fond restaurée (blanc) ──');
    voh.canvas.setBackgroundColor(canvas1, 'rgba(255, 255, 255, 1.0)'); // restaure le fond blanc

    console.log('');
    console.log('   → 2× canvas:backgroundColorChanged.');
    console.log('   → Prochaine étape dans 3 secondes...');

}, 24000);


// ═══════════════════════════════════════════════════════════════
// PARTIE 10 (27s): Suppression
// ═══════════════════════════════════════════════════════════════
// Événements attendus: canvas:deleted (×1)

setTimeout(() => { // exécute le bloc après 27 secondes

    console.log('');
    console.log('══════════════════════════════════════════════════');
    console.log(' PARTIE 10: Suppression (canvas:deleted)');
    console.log('══════════════════════════════════════════════════');
    console.log('');

    // Le canvas B est actuellement actif. Le supprimer émet canvas:deleted.
    // Aucun canvas n'est activé automatiquement après — getActiveId() retourne null.
    console.log('── Supprimer le canvas B (actif) ──');
    voh.canvas.delete(canvas2); // supprime le canvas B (actif)

    console.log('');
    console.log('   → canvas:deleted émis. Aucun canvas:activated automatique.');
    console.log('   → getActiveId() =', voh.canvas.getActiveId(), '(null: aucun canvas actif).');

}, 27000);


// ═══════════════════════════════════════════════════════════════
// RÉCAPITULATIF (30s)
// ═══════════════════════════════════════════════════════════════

setTimeout(() => { // exécute le bloc après 30 secondes

    console.log('');
    console.log('══════════════════════════════════════════════════');
    console.log(' RÉCAPITULATIF');
    console.log('══════════════════════════════════════════════════');
    console.log('');
    console.log('14 types d\'événements canvas:');
    console.log('  canvas:created          — Création');
    console.log('  canvas:deleted          — Suppression');
    console.log('  canvas:activated        — Devenu actif');
    console.log('  canvas:deactivated      — N\'est plus actif');
    console.log('  canvas:moved            — Position changée');
    console.log('  canvas:resized          — Taille changée');
    console.log('  canvas:locked           — Verrouillé');
    console.log('  canvas:unlocked         — Déverrouillé');
    console.log('  canvas:shown            — Rendu visible');
    console.log('  canvas:hidden           — Masqué');
    console.log('  canvas:opacityChanged   — Opacité modifiée');
    console.log('  canvas:nameChanged               — Nom modifié');
    console.log('  canvas:zOrderChanged             — Z-order modifié');
    console.log('  canvas:backgroundColorChanged    — Couleur de fond modifiée');
    console.log('');
    console.log('✅ Exemple terminé !');

}, 27000);

// ── Diagnostic (décommentez si besoin) ────────────────────────
// Affiche le rapport de diagnostic dans une fenêtre.
// Utile si une erreur se produit pour comprendre d'où ça vient.
// voh.diagnostics.showReport();

// Télécharge le rapport de diagnostic en fichier .txt.
// voh.diagnostics.downloadReport();
