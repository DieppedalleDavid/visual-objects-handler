// ═══════════════════════════════════════════════════════════════
// VOH — Canevas: Exemple 08: Multi-canvas et canvas actif
// ═══════════════════════════════════════════════════════════════
//
// Ce script montre comment:
// - Créer plusieurs canvas dans une même zone
// - Basculer le canvas actif (celui qu'on édite)
// - Comprendre la règle du "un seul actif à la fois"
// - Vérifier ce qui se passe quand on active un canvas déjà actif
//
// Un seul canvas est éditable (actif) à la fois dans TOUTE
// l'instance VOH, même s'il y a plusieurs zones. Le canvas actif
// est visuellement identifiable par son outline bleu.
//
// IMPORTANT: "Actif" ≠ "focus souris"
// Les événements souris (survol d'objet, clic, etc.) fonctionnent
// sur TOUS les canvas en permanence, qu'ils soient actifs ou non.
// L'état "actif" est uniquement une notion API/éditeur — il ne
// bloque pas les interactions souris des autres canvas.
// C'est au développeur de conditionner ses handlers à l'état actif
// s'il le souhaite, via voh.canvas.getActiveId().
//
// API utilisées:
//   voh.canvas.create() (création de plusieurs canvas)
//   voh.canvas.setActive(), voh.canvas.getActiveId()
//   voh.canvas.getCount(), voh.canvas.getList()
//   voh.canvas.getName()
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


// ── Créer une zone assez grande pour 4 canvas côte à côte ─────
const zone = voh.zone.create({ // crée une zone, retourne son ID
    name: 'Zone principale',                       // nom pour identifier la zone
    width: 2000,                                   // largeur de la zone en pixels
    height: 1500,                                  // hauteur de la zone en pixels
    backgroundColor: 'rgba(40, 40, 50, 1.0)',      // couleur de fond (gris foncé)
    borderColor: 'rgba(80, 80, 100, 1.0)',         // couleur de la bordure (gris clair)
    borderThickness: 2                                 // épaisseur de la bordure en pixels
});


// ═══════════════════════════════════════════════════════════════
// PARTIE 1 (0s): Créer 4 canvas dans la zone
// ═══════════════════════════════════════════════════════════════

console.log('══════════════════════════════════════════════════');
console.log(' PARTIE 1: Créer 4 canvas');
console.log('══════════════════════════════════════════════════');
console.log('');

// Le premier canvas créé dans l'instance VOH est automatiquement activé.
// Les suivants sont créés mais restent inactifs (pas d'outline bleu).
const canvasA = voh.canvas.create(zone, { // crée le canvas Éditeur (premier = auto-activé), retourne son ID
    name: 'Éditeur',                               // nom du canvas
    x: 30, y: 30,                                  // position dans la zone (pixels)
    width: 600, height: 400,                       // taille du canvas (pixels)
    backgroundColor: 'rgba(255, 255, 255, 1.0)'    // couleur de fond (blanc)
});

// Les canvas suivants ne sont PAS automatiquement activés.
// Seul le tout premier canvas de l'instance a ce comportement spécial.
const canvasB = voh.canvas.create(zone, { // crée le canvas Palette, retourne son ID
    name: 'Palette',                               // nom du canvas
    x: 660, y: 30,                                 // décalé à droite de l'éditeur
    width: 300, height: 250,                       // taille plus petite
    backgroundColor: 'rgba(240, 248, 255, 1.0)'    // couleur de fond (bleu très clair)
});

const canvasC = voh.canvas.create(zone, { // crée le canvas Aperçu, retourne son ID
    name: 'Aperçu',                                // nom du canvas
    x: 660, y: 310,                                // sous la palette
    width: 300, height: 120,                       // canvas court (aperçu)
    backgroundColor: 'rgba(245, 255, 240, 1.0)'    // couleur de fond (vert très clair)
});

const canvasD = voh.canvas.create(zone, { // crée le canvas Propriétés, retourne son ID
    name: 'Propriétés',                            // nom du canvas
    x: 30, y: 460,                                 // sous l'éditeur
    width: 250, height: 200,                       // taille modeste
    backgroundColor: 'rgba(255, 245, 238, 1.0)'    // couleur de fond (orange très clair)
});

console.log('4 canvas créés:', voh.canvas.getList(zone));                                       // liste des 4 IDs
console.log('Canvas actif:', voh.canvas.getActiveId(), '→', voh.canvas.getName(canvasA));       // Éditeur est actif

console.log('');
console.log('   → Seul "Éditeur" a l\'outline bleu (activé automatiquement car premier créé).');
console.log('   → Prochaine étape dans 3 secondes...');


// ═══════════════════════════════════════════════════════════════
// PARTIE 2 (3s): Basculer vers "Palette"
// ═══════════════════════════════════════════════════════════════

setTimeout(() => { // exécute le bloc après 3 secondes

    console.log('');
    console.log('══════════════════════════════════════════════════');
    console.log(' PARTIE 2: Basculer vers "Palette"');
    console.log('══════════════════════════════════════════════════');
    console.log('');

    // setActive() active un canvas et désactive automatiquement le précédent.
    // Deux événements sont émis: canvas:deactivated (pour l'ancien)
    // puis canvas:activated (pour le nouveau).
    voh.canvas.setActive(canvasB); // active le canvas Palette, désactive l'ancien

    console.log('Canvas actif:', voh.canvas.getActiveId(), '→', voh.canvas.getName(canvasB)); // Palette est actif

    console.log('');
    console.log('   → L\'outline bleu est passé de "Éditeur" à "Palette".');
    console.log('   → Prochaine étape dans 3 secondes...');

}, 3000);


// ═══════════════════════════════════════════════════════════════
// PARTIE 3 (6s): Basculer vers "Propriétés"
// ═══════════════════════════════════════════════════════════════

setTimeout(() => { // exécute le bloc après 6 secondes

    console.log('');
    console.log('══════════════════════════════════════════════════');
    console.log(' PARTIE 3: Basculer vers "Propriétés"');
    console.log('══════════════════════════════════════════════════');
    console.log('');

    // On peut basculer vers n'importe quel canvas à tout moment.
    // Il n'y a pas de restriction sur l'ordre d'activation.
    voh.canvas.setActive(canvasD); // active le canvas Propriétés

    console.log('Canvas actif:', voh.canvas.getActiveId(), '→', voh.canvas.getName(canvasD)); // Propriétés est actif

    console.log('');
    console.log('   → Un seul canvas actif à la fois, toujours.');
    console.log('   → Prochaine étape dans 3 secondes...');

}, 6000);


// ═══════════════════════════════════════════════════════════════
// PARTIE 4 (9s): Activer un canvas déjà actif (aucun effet)
// ═══════════════════════════════════════════════════════════════

setTimeout(() => { // exécute le bloc après 9 secondes

    console.log('');
    console.log('══════════════════════════════════════════════════');
    console.log(' PARTIE 4: Activer un canvas déjà actif');
    console.log('══════════════════════════════════════════════════');
    console.log('');

    // Si on appelle setActive() sur un canvas qui est déjà actif,
    // rien ne se passe. Pas d'événement émis, pas de changement visuel.
    // C'est une opération sans effet (idempotente).
    console.log('Canvas actif avant:', voh.canvas.getActiveId());  // Propriétés
    voh.canvas.setActive(canvasD);                                 // déjà actif → aucun effet
    console.log('Canvas actif après:', voh.canvas.getActiveId());  // toujours Propriétés

    console.log('');
    console.log('   → Aucun changement, aucun événement émis.');
    console.log('');
    console.log('✅ Exemple terminé !');

}, 9000);

// ── Diagnostic (décommentez si besoin) ────────────────────────
// Affiche le rapport de diagnostic dans une fenêtre.
// Utile si une erreur se produit pour comprendre d'où ça vient.
// voh.diagnostics.showReport();

// Télécharge le rapport de diagnostic en fichier .txt.
// voh.diagnostics.downloadReport();
