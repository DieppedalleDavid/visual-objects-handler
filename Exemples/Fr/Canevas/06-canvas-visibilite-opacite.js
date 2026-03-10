// ═══════════════════════════════════════════════════════════════
// VOH — Canevas: Exemple 06: Visibilité et opacité
// ═══════════════════════════════════════════════════════════════
//
// Ce script montre comment:
// - Masquer un canvas (le rendre invisible)
// - Réafficher un canvas masqué
// - Modifier l'opacité d'un canvas (transparence progressive)
//
// Visibilité: un canvas masqué n'est plus rendu du tout.
// Il ne reçoit plus d'événements souris. Ses données (objets,
// pages, configuration) restent intactes en mémoire.
//
// Opacité: valeur entre 0.0 (transparent) et 1.0 (opaque).
// Un canvas avec une opacité basse est toujours rendu et reçoit
// les événements souris. L'opacité affecte TOUT le contenu.
//
// API utilisées:
//   voh.canvas.setVisible(), voh.canvas.isVisible()
//   voh.canvas.setOpacity(), voh.canvas.getOpacity()
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

// ── Créer un canvas pour tester visibilité et opacité ──────────
const canvas = voh.canvas.create(zone, { // crée un canvas dans la zone, retourne son ID
    name: 'Canvas test',                           // nom du canvas
    x: 30, y: 30,                                  // position dans la zone (pixels)
    width: 500, height: 350,                       // taille du canvas (pixels)
    backgroundColor: 'rgba(255, 255, 255, 1.0)'    // couleur de fond (blanc)
});


// ═══════════════════════════════════════════════════════════════
// PARTIE 1 (0s): État initial
// ═══════════════════════════════════════════════════════════════

console.log('══════════════════════════════════════════════════');
console.log(' PARTIE 1: État initial');
console.log('══════════════════════════════════════════════════');
console.log('');

// Par défaut, un canvas est visible et opaque (1.0).
console.log('Visible?', voh.canvas.isVisible(canvas));  // affiche true (visible par défaut)
console.log('Opacité:', voh.canvas.getOpacity(canvas));  // affiche 1 (opaque par défaut)

console.log('');
console.log('   → Prochaine étape dans 3 secondes...');


// ═══════════════════════════════════════════════════════════════
// PARTIE 2 (3s): Masquer le canvas
// ═══════════════════════════════════════════════════════════════

setTimeout(() => { // exécute le bloc après 3 secondes

    console.log('');
    console.log('══════════════════════════════════════════════════');
    console.log(' PARTIE 2: Masquer le canvas');
    console.log('══════════════════════════════════════════════════');
    console.log('');

    // setVisible(canvasId, false) masque complètement le canvas.
    // Le canvas disparaît visuellement mais ses données sont préservées.
    voh.canvas.setVisible(canvas, false);                  // masque le canvas
    console.log('Visible?', voh.canvas.isVisible(canvas)); // affiche false

    console.log('');
    console.log('   → Le canvas a disparu. Ses données sont toujours en mémoire.');
    console.log('   → Prochaine étape dans 3 secondes...');

}, 3000);


// ═══════════════════════════════════════════════════════════════
// PARTIE 3 (6s): Réafficher le canvas
// ═══════════════════════════════════════════════════════════════

setTimeout(() => { // exécute le bloc après 6 secondes

    console.log('');
    console.log('══════════════════════════════════════════════════');
    console.log(' PARTIE 3: Réafficher le canvas');
    console.log('══════════════════════════════════════════════════');
    console.log('');

    // setVisible(canvasId, true) réaffiche le canvas.
    // Tout est restauré: position, taille, contenu, état actif.
    voh.canvas.setVisible(canvas, true);                   // réaffiche le canvas
    console.log('Visible?', voh.canvas.isVisible(canvas)); // affiche true

    console.log('');
    console.log('   → Le canvas réapparaît exactement comme avant.');
    console.log('   → Prochaine étape dans 3 secondes...');

}, 6000);


// ═══════════════════════════════════════════════════════════════
// PARTIE 4 (9s): Opacité progressive (de 100% à 25% puis retour)
// ═══════════════════════════════════════════════════════════════
// setOpacity() accepte une valeur entre 0.0 et 1.0.
// La valeur est automatiquement bornée (pas d'erreur si on dépasse).
// Contrairement à setVisible(false), le canvas reste rendu et cliquable.

setTimeout(() => { // exécute le bloc après 9 secondes

    console.log('');
    console.log('══════════════════════════════════════════════════');
    console.log(' PARTIE 4: Opacité progressive');
    console.log('══════════════════════════════════════════════════');
    console.log('');

    console.log('── Opacité à 75% ──');
    voh.canvas.setOpacity(canvas, 0.75);                   // rend le canvas légèrement transparent
    console.log('Opacité:', voh.canvas.getOpacity(canvas)); // affiche 0.75

}, 9000);

setTimeout(() => { // exécute le bloc après 11 secondes

    console.log('');
    console.log('── Opacité à 50% ──');
    voh.canvas.setOpacity(canvas, 0.5);                    // semi-transparent
    console.log('Opacité:', voh.canvas.getOpacity(canvas)); // affiche 0.5

}, 11000);

setTimeout(() => { // exécute le bloc après 13 secondes

    console.log('');
    console.log('── Opacité à 25% ──');
    voh.canvas.setOpacity(canvas, 0.25);                   // très transparent
    console.log('Opacité:', voh.canvas.getOpacity(canvas)); // affiche 0.25

}, 13000);

setTimeout(() => { // exécute le bloc après 15 secondes

    console.log('');
    // Restaurer l'opacité à 100% (1.0 = totalement opaque).
    console.log('── Opacité restaurée à 100% ──');
    voh.canvas.setOpacity(canvas, 1.0);                    // redevient totalement opaque
    console.log('Opacité:', voh.canvas.getOpacity(canvas)); // affiche 1

    console.log('');
    console.log('✅ Exemple terminé !');

}, 15000);

// ── Diagnostic (décommentez si besoin) ────────────────────────
// Affiche le rapport de diagnostic dans une fenêtre.
// Utile si une erreur se produit pour comprendre d'où ça vient.
// voh.diagnostics.showReport();

// Télécharge le rapport de diagnostic en fichier .txt.
// voh.diagnostics.downloadReport();
