// ═══════════════════════════════════════════════════════════════
// VOH — Canevas: Exemple 05: Verrouillage
// ═══════════════════════════════════════════════════════════════
//
// Ce script montre comment:
// - Verrouiller un canvas pour empêcher sa manipulation à la souris
// - Déverrouiller un canvas
// - Prouver que l'API fonctionne toujours même verrouillé
// - Créer un canvas déjà verrouillé dès sa création
//
// Le verrouillage empêche le déplacement et le redimensionnement
// du canvas par la souris. Les objets à l'intérieur du canvas
// restent manipulables normalement.
//
// Important: l'API (setX, setWidth, etc.) fonctionne TOUJOURS,
// même sur un canvas verrouillé. Le verrou ne concerne que la
// manipulation par la souris.
//
// API utilisées:
//   voh.canvas.setLocked(), voh.canvas.isLocked()
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

// ── Créer un canvas pour tester le verrouillage ────────────────
const canvas = voh.canvas.create(zone, { // crée un canvas dans la zone, retourne son ID
    name: 'Canvas verrouillable',                  // nom du canvas
    x: 30, y: 30,                                  // position dans la zone (pixels)
    width: 500, height: 350,                       // taille du canvas (pixels)
    backgroundColor: 'rgba(255, 255, 255, 1.0)'    // couleur de fond (blanc)
});


// ═══════════════════════════════════════════════════════════════
// PARTIE 1 (0s): État initial (déverrouillé par défaut)
// ═══════════════════════════════════════════════════════════════

console.log('══════════════════════════════════════════════════');
console.log(' PARTIE 1: État initial');
console.log('══════════════════════════════════════════════════');
console.log('');

// isLocked() retourne true si verrouillé, false si déverrouillé.
// Par défaut, un canvas est déverrouillé.
console.log('Verrouillé?', voh.canvas.isLocked(canvas)); // affiche false (déverrouillé par défaut)

console.log('');
console.log('   → Le canvas est déverrouillé par défaut.');
console.log('   → Prochaine étape dans 3 secondes...');


// ═══════════════════════════════════════════════════════════════
// PARTIE 2 (3s): Verrouiller le canvas
// ═══════════════════════════════════════════════════════════════

setTimeout(() => { // exécute le bloc après 3 secondes

    console.log('');
    console.log('══════════════════════════════════════════════════');
    console.log(' PARTIE 2: Verrouiller');
    console.log('══════════════════════════════════════════════════');
    console.log('');

    // setLocked(canvasId, true) verrouille le canvas.
    // À partir de maintenant, la souris ne pourra plus
    // déplacer ni redimensionner ce canvas.
    voh.canvas.setLocked(canvas, true);                                     // verrouille le canvas
    console.log('Verrouillé?', voh.canvas.isLocked(canvas));                // affiche true

    console.log('');

    // Même verrouillé, l'API fonctionne normalement.
    // Le verrou est une protection contre la manipulation manuelle,
    // pas contre le code. Le développeur garde le contrôle total.
    console.log('── L\'API fonctionne toujours sur un canvas verrouillé ──');
    voh.canvas.setX(canvas, 100);                                           // déplace le canvas malgré le verrou
    console.log('Position X après setX(100):', voh.canvas.getX(canvas));    // affiche 100

    // Remettre en position initiale pour la démonstration.
    voh.canvas.setX(canvas, 30);                                            // remet à la position d'origine

    console.log('');
    console.log('   → Le verrou bloque la souris, pas l\'API.');
    console.log('   → Prochaine étape dans 3 secondes...');

}, 3000);


// ═══════════════════════════════════════════════════════════════
// PARTIE 3 (6s): Déverrouiller et créer un canvas déjà verrouillé
// ═══════════════════════════════════════════════════════════════

setTimeout(() => { // exécute le bloc après 6 secondes

    console.log('');
    console.log('══════════════════════════════════════════════════');
    console.log(' PARTIE 3: Déverrouiller');
    console.log('══════════════════════════════════════════════════');
    console.log('');

    // setLocked(canvasId, false) déverrouille le canvas.
    // La souris peut à nouveau interagir avec lui.
    voh.canvas.setLocked(canvas, false);                                    // déverrouille le canvas
    console.log('Verrouillé?', voh.canvas.isLocked(canvas));                // affiche false

    console.log('');

    // On peut aussi créer un canvas déjà verrouillé dès le départ
    // en passant isLocked: true dans les options de création.
    // Utile pour des canvas décoratifs ou de référence.
    console.log('── Créer un canvas verrouillé dès le départ ──');
    const canvasFixe = voh.canvas.create(zone, { // crée un canvas verrouillé, retourne son ID
        name: 'Canvas fixe',                       // nom du canvas
        x: 560, y: 30,                             // position dans la zone (pixels)
        width: 300, height: 200,                    // taille du canvas (pixels)
        backgroundColor: 'rgba(255, 240, 240, 1.0)', // couleur de fond (rose très clair)
        isLocked: true                              // verrouillé dès la création
    });
    console.log('Canvas fixe verrouillé?', voh.canvas.isLocked(canvasFixe)); // affiche true

    console.log('');
    console.log('✅ Exemple terminé !');

}, 6000);

// ── Diagnostic (décommentez si besoin) ────────────────────────
// Affiche le rapport de diagnostic dans une fenêtre.
// Utile si une erreur se produit pour comprendre d'où ça vient.
// voh.diagnostics.showReport();

// Télécharge le rapport de diagnostic en fichier .txt.
// voh.diagnostics.downloadReport();
