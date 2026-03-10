// ═══════════════════════════════════════════════════════════════
// VOH — Canevas: Exemple 04: Z-order
// ═══════════════════════════════════════════════════════════════
//
// Ce script montre comment:
// - Comprendre l'ordre d'empilement (z-order) des canvas
// - Mettre un canvas au premier plan (bringToFront)
// - Mettre un canvas en arrière-plan (sendToBack)
// - Monter ou descendre un canvas d'un cran (moveUp, moveDown)
//
// Le z-order détermine quel canvas s'affiche au-dessus des autres.
// Un z-order plus élevé = affiché au-dessus.
// Par défaut, chaque nouveau canvas a un z-order supérieur
// au précédent (le dernier créé est au-dessus de tout).
//
// API utilisées:
//   voh.canvas.bringToFront(), voh.canvas.sendToBack()
//   voh.canvas.moveUp(), voh.canvas.moveDown()
//   voh.canvas.getZOrder()
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


// ── Créer une zone (conteneur de premier niveau) ───────────────
const zone = voh.zone.create({ // crée une zone, retourne son ID
    name: 'Zone test',                             // nom pour identifier la zone
    width: 1500,                                   // largeur de la zone en pixels
    height: 1000,                                  // hauteur de la zone en pixels
    backgroundColor: 'rgba(40, 40, 50, 1.0)'       // couleur de fond (gris foncé)
});

// ── Créer 3 canvas qui se chevauchent volontairement ───────────
// Grâce aux couleurs différentes, on verra facilement
// quel canvas est au-dessus ou en-dessous des autres.
const canvasRouge = voh.canvas.create(zone, { // crée le canvas rouge, retourne son ID
    name: 'Rouge',                                 // nom du canvas
    x: 30, y: 30,                                  // position dans la zone (pixels)
    width: 300, height: 250,                       // taille du canvas (pixels)
    backgroundColor: 'rgba(255, 180, 180, 1.0)'    // couleur de fond (rose clair)
});

const canvasVert = voh.canvas.create(zone, { // crée le canvas vert, retourne son ID
    name: 'Vert',                                  // nom du canvas
    x: 130, y: 80,                                 // décalé pour chevaucher le rouge
    width: 300, height: 250,                       // même taille que le rouge
    backgroundColor: 'rgba(180, 255, 180, 1.0)'    // couleur de fond (vert clair)
});

const canvasBleu = voh.canvas.create(zone, { // crée le canvas bleu, retourne son ID
    name: 'Bleu',                                  // nom du canvas
    x: 230, y: 130,                                // décalé pour chevaucher les deux autres
    width: 300, height: 250,                       // même taille
    backgroundColor: 'rgba(180, 180, 255, 1.0)'    // couleur de fond (bleu clair)
});


// ═══════════════════════════════════════════════════════════════
// PARTIE 1 (0s): Z-order initial (ordre de création)
// ═══════════════════════════════════════════════════════════════

console.log('══════════════════════════════════════════════════');
console.log(' PARTIE 1: Z-order initial');
console.log('══════════════════════════════════════════════════');
console.log('');

// getZOrder() retourne la valeur de z-order d'un canvas.
// Plus le nombre est élevé, plus le canvas est au-dessus.
// Par défaut, chaque canvas créé a un z-order incrémenté de 1.
console.log('Rouge (créé 1er):', voh.canvas.getZOrder(canvasRouge));  // z-order le plus bas
console.log('Vert  (créé 2e):', voh.canvas.getZOrder(canvasVert));    // z-order intermédiaire
console.log('Bleu  (créé 3e):', voh.canvas.getZOrder(canvasBleu));    // z-order le plus haut

console.log('');
console.log('   → Le bleu est au-dessus de tout (créé en dernier).');
console.log('   → Prochaine étape dans 3 secondes...');


// ═══════════════════════════════════════════════════════════════
// PARTIE 2 (3s): bringToFront — Mettre le rouge au premier plan
// ═══════════════════════════════════════════════════════════════

setTimeout(() => { // exécute le bloc après 3 secondes

    console.log('');
    console.log('══════════════════════════════════════════════════');
    console.log(' PARTIE 2: bringToFront (Rouge au premier plan)');
    console.log('══════════════════════════════════════════════════');
    console.log('');

    // bringToFront() place un canvas tout en haut de la pile.
    // Son z-order devient le plus élevé de tous les canvas.
    voh.canvas.bringToFront(canvasRouge); // rouge passe au-dessus de tout

    console.log('Rouge:', voh.canvas.getZOrder(canvasRouge)); // maintenant le plus haut
    console.log('Vert:', voh.canvas.getZOrder(canvasVert));   // inchangé
    console.log('Bleu:', voh.canvas.getZOrder(canvasBleu));   // inchangé

    console.log('');
    console.log('   → Le rouge est maintenant au-dessus de tout.');
    console.log('   → Prochaine étape dans 3 secondes...');

}, 3000);


// ═══════════════════════════════════════════════════════════════
// PARTIE 3 (6s): sendToBack — Envoyer le rouge en arrière-plan
// ═══════════════════════════════════════════════════════════════

setTimeout(() => { // exécute le bloc après 6 secondes

    console.log('');
    console.log('══════════════════════════════════════════════════');
    console.log(' PARTIE 3: sendToBack (Rouge en arrière-plan)');
    console.log('══════════════════════════════════════════════════');
    console.log('');

    // sendToBack() place un canvas tout en bas de la pile.
    // Son z-order devient le plus faible de tous les canvas.
    voh.canvas.sendToBack(canvasRouge); // rouge passe derrière tout

    console.log('Rouge:', voh.canvas.getZOrder(canvasRouge)); // maintenant le plus bas
    console.log('Vert:', voh.canvas.getZOrder(canvasVert));   // inchangé
    console.log('Bleu:', voh.canvas.getZOrder(canvasBleu));   // inchangé

    console.log('');
    console.log('   → Le rouge est maintenant derrière tout le monde.');
    console.log('   → Prochaine étape dans 3 secondes...');

}, 6000);


// ═══════════════════════════════════════════════════════════════
// PARTIE 4 (9s): moveUp et moveDown — Déplacement d'un cran
// ═══════════════════════════════════════════════════════════════

setTimeout(() => { // exécute le bloc après 9 secondes

    console.log('');
    console.log('══════════════════════════════════════════════════');
    console.log(' PARTIE 4: moveUp et moveDown');
    console.log('══════════════════════════════════════════════════');
    console.log('');

    // moveUp() échange le z-order d'un canvas avec celui juste au-dessus.
    // Si le canvas est déjà tout en haut, rien ne se passe.
    console.log('── moveUp (Rouge monte d\'un cran) ──');
    voh.canvas.moveUp(canvasRouge);                           // rouge échange avec le vert (au-dessus)
    console.log('Rouge:', voh.canvas.getZOrder(canvasRouge)); // a monté d'un cran
    console.log('Vert:', voh.canvas.getZOrder(canvasVert));   // a descendu d'un cran

    console.log('');

    // moveDown() échange le z-order d'un canvas avec celui juste en-dessous.
    // Si le canvas est déjà tout en bas, rien ne se passe.
    console.log('── moveDown (Rouge redescend d\'un cran) ──');
    voh.canvas.moveDown(canvasRouge);                         // rouge échange avec le vert (en-dessous)
    console.log('Rouge:', voh.canvas.getZOrder(canvasRouge)); // revenu à sa position
    console.log('Vert:', voh.canvas.getZOrder(canvasVert));   // revenu aussi

    console.log('');
    console.log('✅ Exemple terminé !');

}, 9000);

// ── Diagnostic (décommentez si besoin) ────────────────────────
// Affiche le rapport de diagnostic dans une fenêtre.
// Utile si une erreur se produit pour comprendre d'où ça vient.
// voh.diagnostics.showReport();

// Télécharge le rapport de diagnostic en fichier .txt.
// voh.diagnostics.downloadReport();
