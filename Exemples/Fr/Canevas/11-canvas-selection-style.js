// ═══════════════════════════════════════════════════════════════
// VOH — Canevas: Exemple 11: Style du rectangle de sélection
// ═══════════════════════════════════════════════════════════════
//
// Ce script montre comment personnaliser l'apparence du rectangle
// de sélection tracé à la souris sur un canevas.
//
// 6 propriétés disponibles via voh.canvas.selection:
//   setEnabled(canvasId, bool)             — activer/désactiver (défaut: false)
//   setMouseButton(canvasId, button)       — bouton souris: 'left', 'middle', 'right' (défaut: 'left')
//   setBackgroundColor(canvasId, color)    — couleur de fond (rgba)
//   setBorderColor(canvasId, color)        — couleur de bordure (rgba)
//   setBorderThickness(canvasId, pixels)   — épaisseur de bordure
//   setBorderStyle(canvasId, style)        — 'solid', 'dashed', 'dotted'
//
// Ces propriétés peuvent aussi être définies à la création du
// canevas via les paramètres selectionBackgroundColor,
// selectionBorderColor, selectionBorderThickness, selectionBorderStyle.
//
// Chaque canevas a ses propres réglages de sélection indépendants.
//
// ═══════════════════════════════════════════════════════════════


// ── Initialisation de VOH ──────────────────────────────────────
const voh = new VisualObjectsHandler(document.getElementById('container')); // crée l'instance VOH
await voh.init(); // initialise le moteur (asynchrone)


// ── Créer une zone ─────────────────────────────────────────────
const zone = voh.zone.create({ // crée une zone, retourne son ID
    name:            'Zone test',
    backgroundColor: 'rgba(30, 30, 40, 1.0)',  // fond sombre
    borderColor:     'rgba(80, 80, 100, 1.0)', // bordure grise
    borderThickness: 2
});


// ═══════════════════════════════════════════════════════════════
// PARTIE 1 (0s): Style par défaut
// Créer un canevas sans préciser les paramètres de sélection.
// VOH applique automatiquement le style bleu par défaut.
// ═══════════════════════════════════════════════════════════════

const canvasA = voh.canvas.create(zone, { // crée le canevas A avec le style de sélection par défaut
    name:            'Canvas A — Style par défaut',
    x:               30, y: 30,
    width:           500, height: 350,
    backgroundColor: 'rgba(255, 255, 255, 1.0)' // fond blanc
});

// Activer la sélection sur le canvas A (désactivée par défaut)
voh.canvas.selection.setEnabled(canvasA, true); // active la sélection à la souris

console.log('══════════════════════════════════════════════════');
console.log(' PARTIE 1: Style par défaut (bleu)');
console.log('══════════════════════════════════════════════════');
console.log('');

// Lire les valeurs par défaut pour les afficher
console.log('Valeurs par défaut du canvas A:');
console.log('  Activée:   ', voh.canvas.selection.getEnabled(canvasA));           // true (activée manuellement)
console.log('  Bouton:    ', voh.canvas.selection.getMouseButton(canvasA));        // left
console.log('  Fond:      ', voh.canvas.selection.getBackgroundColor(canvasA));  // rgba(0, 120, 215, 0.15)
console.log('  Bordure:   ', voh.canvas.selection.getBorderColor(canvasA));      // rgba(0, 120, 215, 0.8)
console.log('  Épaisseur: ', voh.canvas.selection.getBorderThickness(canvasA));  // 1
console.log('  Style:     ', voh.canvas.selection.getBorderStyle(canvasA));      // solid

console.log('');
console.log('   → Style bleu par défaut, prêt à tracer un rectangle.');
console.log('   → Prochaine étape dans 3 secondes...');


// ═══════════════════════════════════════════════════════════════
// PARTIE 2 (3s): Style vert tiretés
// Modifier les 4 propriétés après la création.
// ═══════════════════════════════════════════════════════════════

setTimeout(() => { // exécute le bloc après 3 secondes

    console.log('');
    console.log('══════════════════════════════════════════════════');
    console.log(' PARTIE 2: Modifier le style (vert tiretés)');
    console.log('══════════════════════════════════════════════════');
    console.log('');

    // Changer le bouton souris — bouton droit pour cette démo
    // (le menu contextuel est bloqué automatiquement par VOH quand bouton = 'right')
    voh.canvas.selection.setMouseButton(canvasA, 'right'); // bouton droit
    console.log('Bouton mis à jour:    ', voh.canvas.selection.getMouseButton(canvasA));

    // Changer la couleur de fond — fond vert très transparent
    voh.canvas.selection.setBackgroundColor(canvasA, 'rgba(0, 200, 80, 0.10)'); // fond vert léger
    console.log('Fond mis à jour:      ', voh.canvas.selection.getBackgroundColor(canvasA));

    // Changer la couleur de bordure — vert plus opaque
    voh.canvas.selection.setBorderColor(canvasA, 'rgba(0, 180, 60, 0.9)'); // bordure verte
    console.log('Bordure mise à jour:  ', voh.canvas.selection.getBorderColor(canvasA));

    // Changer l'épaisseur — 2 pixels
    voh.canvas.selection.setBorderThickness(canvasA, 2); // épaisseur 2px
    console.log('Épaisseur mise à jour:', voh.canvas.selection.getBorderThickness(canvasA));

    // Changer le style — tiretés
    voh.canvas.selection.setBorderStyle(canvasA, 'dashed'); // tiretés
    console.log('Style mis à jour:     ', voh.canvas.selection.getBorderStyle(canvasA));

    console.log('');
    console.log('   → Le rectangle tracé à la souris sera maintenant vert et tireté.');
    console.log('   → Prochaine étape dans 3 secondes...');

}, 3000);


// ═══════════════════════════════════════════════════════════════
// PARTIE 3 (6s): Style orange pointillés
// Démontrer le style 'dotted' et une épaisseur plus grande.
// ═══════════════════════════════════════════════════════════════

setTimeout(() => { // exécute le bloc après 6 secondes

    console.log('');
    console.log('══════════════════════════════════════════════════');
    console.log(' PARTIE 3: Style orange pointillés');
    console.log('══════════════════════════════════════════════════');
    console.log('');

    voh.canvas.selection.setMouseButton(canvasA, 'left'); // retour au bouton gauche
    voh.canvas.selection.setBackgroundColor(canvasA, 'rgba(255, 100, 0, 0.10)'); // fond orange léger
    voh.canvas.selection.setBorderColor(canvasA, 'rgba(255, 80, 0, 0.9)');       // bordure orange
    voh.canvas.selection.setBorderThickness(canvasA, 3);                          // épaisseur 3px
    voh.canvas.selection.setBorderStyle(canvasA, 'dotted');                       // pointillés

    console.log('Fond:      ', voh.canvas.selection.getBackgroundColor(canvasA));
    console.log('Bordure:   ', voh.canvas.selection.getBorderColor(canvasA));
    console.log('Épaisseur: ', voh.canvas.selection.getBorderThickness(canvasA));
    console.log('Style:     ', voh.canvas.selection.getBorderStyle(canvasA));

    console.log('');
    console.log('   → Prochaine étape dans 3 secondes...');

}, 6000);


// ═══════════════════════════════════════════════════════════════
// PARTIE 4 (9s): Paramètres à la création
// Créer un second canevas avec le style défini directement
// dans les paramètres de create(), sans appel post-création.
// ═══════════════════════════════════════════════════════════════

setTimeout(() => { // exécute le bloc après 9 secondes

    console.log('');
    console.log('══════════════════════════════════════════════════');
    console.log(' PARTIE 4: Style défini à la création du canevas');
    console.log('══════════════════════════════════════════════════');
    console.log('');

    // Les paramètres selectionBackgroundColor, selectionBorderColor,
    // selectionBorderThickness et selectionBorderStyle peuvent être
    // passés directement à voh.canvas.create() pour éviter 4 appels séparés.
    const canvasB = voh.canvas.create(zone, { // crée le canevas B avec style rouge défini à la création
        name:                    'Canvas B — Style défini à la création',
        x:                       560, y: 30,   // à droite du canvas A
        width:                   400, height: 350,
        backgroundColor:         'rgba(255, 240, 240, 1.0)', // fond rose très clair

        // Style de sélection rouge, défini directement ici:
        selectionEnabled:         true,                    // active dès la création
        selectionMouseButton:     'left',                  // bouton gauche (défaut)
        selectionBackgroundColor: 'rgba(220, 0, 0, 0.10)',  // fond rouge léger
        selectionBorderColor:     'rgba(200, 0, 0, 0.9)',   // bordure rouge
        selectionBorderThickness: 2,                         // épaisseur 2px
        selectionBorderStyle:     'solid'                    // trait continu
    });

    console.log('Canvas B créé avec style rouge intégré:');
    console.log('  Activée:   ', voh.canvas.selection.getEnabled(canvasB));
    console.log('  Bouton:    ', voh.canvas.selection.getMouseButton(canvasB));
    console.log('  Fond:      ', voh.canvas.selection.getBackgroundColor(canvasB));
    console.log('  Bordure:   ', voh.canvas.selection.getBorderColor(canvasB));
    console.log('  Épaisseur: ', voh.canvas.selection.getBorderThickness(canvasB));
    console.log('  Style:     ', voh.canvas.selection.getBorderStyle(canvasB));

    console.log('');
    console.log('   → Chaque canevas a ses propres réglages de sélection.');
    console.log('   → Canvas A = orange pointillés, Canvas B = rouge solide.');
    console.log('   → Prochaine étape dans 3 secondes...');

}, 9000);


// ═══════════════════════════════════════════════════════════════
// PARTIE 5 (12s): Style invalide — validation automatique
// Tenter de passer un style invalide pour voir la validation.
// ═══════════════════════════════════════════════════════════════

setTimeout(() => { // exécute le bloc après 12 secondes

    console.log('');
    console.log('══════════════════════════════════════════════════');
    console.log(' PARTIE 5: Style invalide (validation)');
    console.log('══════════════════════════════════════════════════');
    console.log('');

    // Tenter un style invalide — VOH refuse et retourne false,
    // le style actuel est conservé inchangé.
    const styleAvant  = voh.canvas.selection.getBorderStyle(canvasA); // style actuel
    const resultat    = voh.canvas.selection.setBorderStyle(canvasA, 'double'); // invalide !
    const styleApres  = voh.canvas.selection.getBorderStyle(canvasA); // style après la tentative

    console.log('Style avant:          ', styleAvant);   // dotted
    console.log('setBorderStyle résultat:', resultat);   // false
    console.log('Style après:          ', styleApres);   // dotted (inchangé)

    console.log('');
    console.log('   → Un avertissement a été affiché en console.');
    console.log('   → Le style est resté inchangé à \'dotted\'.');
    console.log('   → Valeurs valides: \'solid\', \'dashed\', \'dotted\'.');
    console.log('');
    console.log('✅ Exemple terminé !');

}, 12000);

// ── Diagnostic (décommentez si besoin) ────────────────────────
// Affiche le rapport de diagnostic dans une fenêtre.
// Utile si une erreur se produit pour comprendre d'où ça vient.
// voh.diagnostics.showReport();

// Télécharge le rapport de diagnostic en fichier .txt.
// voh.diagnostics.downloadReport();
