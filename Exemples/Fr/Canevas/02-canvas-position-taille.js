// ═══════════════════════════════════════════════════════════════
// VOH — Canevas: Exemple 02: Position et taille
// ═══════════════════════════════════════════════════════════════
//
// Ce script montre comment:
// - Déplacer un canvas dans sa zone (position X, Y)
// - Redimensionner un canvas (largeur, hauteur)
// - Lire les valeurs actuelles
//
// La position du canvas est relative au coin haut-gauche de la zone.
// Les valeurs sont en pixels. Le canvas peut dépasser les bords
// de la zone (il sera simplement tronqué par l'overflow).
//
// API utilisées:
//   voh.canvas.setX(), voh.canvas.getX()
//   voh.canvas.setY(), voh.canvas.getY()
//   voh.canvas.setWidth(), voh.canvas.getWidth()
//   voh.canvas.setHeight(), voh.canvas.getHeight()
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


// ── Créer une zone assez grande pour voir le canvas se déplacer ─
// La zone fait 1500×1000 pixels, bien plus grande que le canvas.
const zone = voh.zone.create({ // crée une zone, retourne son ID
    name: 'Zone test',                             // nom pour identifier la zone
    width: 1500,                                   // largeur de la zone en pixels
    height: 1000,                                  // hauteur de la zone en pixels
    backgroundColor: 'rgba(40, 40, 50, 1.0)'       // couleur de fond (gris foncé)
});

// ── Créer un canvas à la position (30, 30) ─────────────────────
// On commence petit (400×300) pour bien voir l'agrandissement ensuite.
const canvas = voh.canvas.create(zone, { // crée un canvas dans la zone, retourne son ID
    name: 'Canvas mobile',                         // nom du canvas
    x: 30,                                         // position horizontale dans la zone (pixels)
    y: 30,                                         // position verticale dans la zone (pixels)
    width: 400,                                    // largeur du canvas en pixels
    height: 300,                                   // hauteur du canvas en pixels
    backgroundColor: 'rgba(255, 255, 255, 1.0)'    // couleur de fond (blanc)
});


// ═══════════════════════════════════════════════════════════════
// PARTIE 1 (0s): Afficher la position et la taille initiales
// ═══════════════════════════════════════════════════════════════

console.log('══════════════════════════════════════════════════');
console.log(' PARTIE 1: Position et taille initiales');
console.log('══════════════════════════════════════════════════');
console.log('');

// getX() et getY() retournent la position actuelle du coin haut-gauche.
console.log('Position:', voh.canvas.getX(canvas), ',', voh.canvas.getY(canvas));      // affiche 30, 30

// getWidth() et getHeight() retournent les dimensions actuelles.
console.log('Taille:', voh.canvas.getWidth(canvas), '×', voh.canvas.getHeight(canvas)); // affiche 400 × 300

console.log('');
console.log('   → Prochaine étape dans 3 secondes...');


// ═══════════════════════════════════════════════════════════════
// PARTIE 2 (3s): Déplacer le canvas
// ═══════════════════════════════════════════════════════════════

setTimeout(() => { // exécute le bloc après 3 secondes

    console.log('');
    console.log('══════════════════════════════════════════════════');
    console.log(' PARTIE 2: Déplacer le canvas');
    console.log('══════════════════════════════════════════════════');
    console.log('');

    // setX() change la position horizontale (distance depuis le bord gauche de la zone).
    // setY() change la position verticale (distance depuis le bord supérieur de la zone).
    // Le canvas se déplace instantanément à la nouvelle position.
    voh.canvas.setX(canvas, 200);  // déplace à 200px du bord gauche
    voh.canvas.setY(canvas, 150);  // déplace à 150px du bord supérieur

    console.log('Nouvelle position:', voh.canvas.getX(canvas), ',', voh.canvas.getY(canvas)); // affiche 200, 150
    console.log('');
    console.log('   → Le canvas a bougé vers la droite et vers le bas.');
    console.log('   → Prochaine étape dans 3 secondes...');

}, 3000);


// ═══════════════════════════════════════════════════════════════
// PARTIE 3 (6s): Redimensionner le canvas
// ═══════════════════════════════════════════════════════════════

setTimeout(() => { // exécute le bloc après 6 secondes

    console.log('');
    console.log('══════════════════════════════════════════════════');
    console.log(' PARTIE 3: Redimensionner le canvas');
    console.log('══════════════════════════════════════════════════');
    console.log('');

    // setWidth() change la largeur du canvas.
    // setHeight() change la hauteur du canvas.
    // Le redimensionnement est instantané et affecte le rendu visuel immédiatement.
    voh.canvas.setWidth(canvas, 700);   // agrandit la largeur à 700px
    voh.canvas.setHeight(canvas, 500);  // agrandit la hauteur à 500px

    console.log('Nouvelle taille:', voh.canvas.getWidth(canvas), '×', voh.canvas.getHeight(canvas)); // affiche 700 × 500
    console.log('');
    console.log('   → Le canvas est maintenant plus grand.');
    console.log('');
    console.log('✅ Exemple terminé !');

}, 6000);

// ── Diagnostic (décommentez si besoin) ────────────────────────
// Affiche le rapport de diagnostic dans une fenêtre.
// Utile si une erreur se produit pour comprendre d'où ça vient.
// voh.diagnostics.showReport();

// Télécharge le rapport de diagnostic en fichier .txt.
// voh.diagnostics.downloadReport();
