// ═══════════════════════════════════════════════════════════════
// VOH — Canevas: Exemple 07: Supprimer un canvas
// ═══════════════════════════════════════════════════════════════
//
// Ce script montre comment:
// - Supprimer un canvas non-actif (le canvas actif ne change pas)
// - Supprimer le canvas actif (getActiveId() retourne null ensuite)
// - Réactiver manuellement un canvas après suppression
// - Vérifier l'état après suppression
//
// Quand on supprime un canvas, son élément HTML est retiré du DOM,
// ses données sont libérées, et l'ID n'est plus valide.
// Si le canvas supprimé était le canvas actif, aucun autre canvas
// n'est activé automatiquement — c'est au développeur de décider
// quel canvas activer ensuite via voh.canvas.setActive().
//
// API utilisées:
//   voh.canvas.delete()
//   voh.canvas.exists()
//   voh.canvas.getActiveId()
//   voh.canvas.getCount(), voh.canvas.getList()
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

// ── Créer 3 canvas pour démontrer les cas de suppression ───────
// Le premier créé (Canvas A) est automatiquement activé.
const canvas1 = voh.canvas.create(zone, { // crée Canvas A (premier = auto-activé), retourne son ID
    name: 'Canvas A',                              // nom du canvas
    x: 30, y: 30,                                  // position dans la zone (pixels)
    width: 400, height: 300,                       // taille du canvas (pixels)
    backgroundColor: 'rgba(255, 255, 255, 1.0)'    // couleur de fond (blanc)
});

const canvas2 = voh.canvas.create(zone, { // crée Canvas B, retourne son ID
    name: 'Canvas B',                              // nom du canvas
    x: 460, y: 30,                                 // décalé à droite du premier
    width: 400, height: 300,                       // même taille
    backgroundColor: 'rgba(240, 248, 255, 1.0)'    // couleur de fond (bleu très clair)
});

const canvas3 = voh.canvas.create(zone, { // crée Canvas C, retourne son ID
    name: 'Canvas C',                              // nom du canvas
    x: 30, y: 360,                                 // sous le premier
    width: 400, height: 300,                       // même taille
    backgroundColor: 'rgba(245, 255, 240, 1.0)'    // couleur de fond (vert très clair)
});


// ═══════════════════════════════════════════════════════════════
// PARTIE 1 (0s): État initial avec 3 canvas
// ═══════════════════════════════════════════════════════════════

console.log('══════════════════════════════════════════════════');
console.log(' PARTIE 1: État initial (3 canvas)');
console.log('══════════════════════════════════════════════════');
console.log('');

console.log('Canvas existants:', voh.canvas.getList(zone));                                     // liste des 3 IDs
console.log('Nombre:', voh.canvas.getCount(zone));                                              // affiche 3
console.log('Canvas actif:', voh.canvas.getActiveId(), '→', voh.canvas.getName(canvas1));       // Canvas A est actif

console.log('');
console.log('   → Canvas A est actif (outline bleu).');
console.log('   → Prochaine étape dans 3 secondes...');


// ═══════════════════════════════════════════════════════════════
// PARTIE 2 (3s): Supprimer un canvas qui N'EST PAS actif
// ═══════════════════════════════════════════════════════════════

setTimeout(() => { // exécute le bloc après 3 secondes

    console.log('');
    console.log('══════════════════════════════════════════════════');
    console.log(' PARTIE 2: Supprimer un canvas non-actif');
    console.log('══════════════════════════════════════════════════');
    console.log('');

    // Supprimer le Canvas C (qui n'est pas actif).
    // Le canvas actif (Canvas A) ne change pas.
    console.log('── Supprimer "Canvas C" (non-actif) ──');
    voh.canvas.delete(canvas3);                                              // supprime Canvas C

    // exists() retourne false pour un canvas supprimé.
    // Toute opération sur cet ID retournera null ou sera ignorée.
    console.log('Canvas C existe encore?', voh.canvas.exists(canvas3));      // affiche false
    console.log('Canvas restants:', voh.canvas.getList(zone));               // 2 canvas restants
    console.log('Canvas actif (inchangé):', voh.canvas.getActiveId());       // toujours Canvas A

    console.log('');
    console.log('   → Le canvas actif n\'a pas changé, c\'est normal.');
    console.log('   → Prochaine étape dans 3 secondes...');

}, 3000);


// ═══════════════════════════════════════════════════════════════
// PARTIE 3 (6s): Supprimer le canvas ACTIF (et réactiver manuellement)
// ═══════════════════════════════════════════════════════════════

setTimeout(() => { // exécute le bloc après 6 secondes

    console.log('');
    console.log('══════════════════════════════════════════════════');
    console.log(' PARTIE 3: Supprimer le canvas actif');
    console.log('══════════════════════════════════════════════════');
    console.log('');

    console.log('Canvas actif avant suppression:', voh.canvas.getActiveId()); // Canvas A

    // Supprimer le Canvas A (qui EST le canvas actif).
    // Après suppression, getActiveId() retourne null.
    // Aucun canvas n'est activé automatiquement — c'est au
    // développeur de choisir quel canvas activer ensuite.
    console.log('── Supprimer "Canvas A" (actif) ──');
    voh.canvas.delete(canvas1);                                               // supprime Canvas A (actif)

    console.log('Canvas restants:', voh.canvas.getList(zone));                // 1 canvas restant
    console.log('Canvas actif après suppression:', voh.canvas.getActiveId()); // null (aucun actif)

    console.log('');
    console.log('   → getActiveId() retourne null : aucun canvas n\'est activé automatiquement.');
    console.log('   → On choisit manuellement quel canvas activer :');

    // On active manuellement le Canvas B restant.
    voh.canvas.setActive(canvas2);                                            // active Canvas B manuellement
    console.log('Canvas actif après setActive(B):', voh.canvas.getActiveId()); // Canvas B

    console.log('');
    console.log('✅ Exemple terminé !');

}, 6000);

// ── Diagnostic (décommentez si besoin) ────────────────────────
// Affiche le rapport de diagnostic dans une fenêtre.
// Utile si une erreur se produit pour comprendre d'où ça vient.
// voh.diagnostics.showReport();

// Télécharge le rapport de diagnostic en fichier .txt.
// voh.diagnostics.downloadReport();
