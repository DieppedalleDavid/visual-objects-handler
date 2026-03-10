// ═══════════════════════════════════════════════════════════════
// VOH — Canevas: Exemple 03: Nom et informations
// ═══════════════════════════════════════════════════════════════
//
// Ce script montre comment:
// - Renommer un canvas après sa création
// - Vérifier si un canvas existe encore
// - Compter les canvas et lister leurs IDs
// - Retrouver la zone parente d'un canvas
//
// Ces fonctions d'information sont utiles pour gérer
// dynamiquement une interface à plusieurs canvas,
// surtout quand des canvas sont créés ou supprimés au fil du temps.
//
// API utilisées:
//   voh.canvas.setName(), voh.canvas.getName()
//   voh.canvas.exists()
//   voh.canvas.getCount(), voh.canvas.getList()
//   voh.canvas.getZoneId()
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
// Un canvas doit toujours être créé à l'intérieur d'une zone.
const zone = voh.zone.create({ // crée une zone, retourne son ID
    name: 'Zone test',                             // nom pour identifier la zone
    width: 1500,                                   // largeur de la zone en pixels
    height: 1000,                                  // hauteur de la zone en pixels
    backgroundColor: 'rgba(40, 40, 50, 1.0)'       // couleur de fond (gris foncé)
});

// ── Créer 2 canvas pour avoir des données à interroger ─────────
// On donne des noms explicites pour illustrer le renommage ensuite.
const canvas1 = voh.canvas.create(zone, { // crée le premier canvas, retourne son ID
    name: 'Premier canvas',                        // nom du canvas
    x: 30, y: 30,                                  // position dans la zone (pixels)
    width: 400, height: 300,                       // taille du canvas (pixels)
    backgroundColor: 'rgba(255, 255, 255, 1.0)'    // couleur de fond (blanc)
});

const canvas2 = voh.canvas.create(zone, { // crée le deuxième canvas, retourne son ID
    name: 'Deuxième canvas',                       // nom du canvas
    x: 460, y: 30,                                 // position décalée à droite du premier
    width: 300, height: 200,                       // taille plus petite
    backgroundColor: 'rgba(240, 248, 255, 1.0)'    // couleur de fond (bleu très clair)
});


// ═══════════════════════════════════════════════════════════════
// PARTIE 1 (0s): Obtenir des informations sur les canvas
// ═══════════════════════════════════════════════════════════════

console.log('══════════════════════════════════════════════════');
console.log(' PARTIE 1: Informations sur les canvas');
console.log('══════════════════════════════════════════════════');
console.log('');

// getCount() retourne le nombre de canvas.
// Si on passe un zoneId, on compte uniquement dans cette zone.
// Sans argument (ou null), on compte TOUS les canvas de l'instance.
console.log('Nombre de canvas (zone):', voh.canvas.getCount(zone));        // compte dans la zone spécifiée
console.log('Nombre de canvas (instance):', voh.canvas.getCount());        // compte dans toute l'instance

// getList() retourne un tableau des IDs de canvas.
// Même logique: avec zoneId → liste par zone, sans → toute l'instance.
console.log('Liste des IDs:', voh.canvas.getList(zone));                   // retourne [id1, id2]

// exists() vérifie si un canvas avec cet ID existe encore.
// Utile après une suppression, ou pour valider un ID reçu de l'extérieur.
console.log('Canvas 1 existe?', voh.canvas.exists(canvas1));               // retourne true (il existe)
console.log('Canvas 999 existe?', voh.canvas.exists(999));                 // retourne false (n'existe pas)

// getZoneId() retourne l'ID de la zone dans laquelle vit le canvas.
// Utile quand on manipule des canvas sans savoir dans quelle zone ils sont.
console.log('Zone du canvas 1:', voh.canvas.getZoneId(canvas1));           // retourne l'ID de la zone
console.log('Zone du canvas 2:', voh.canvas.getZoneId(canvas2));           // même zone pour les deux

console.log('');
console.log('   → Prochaine étape dans 3 secondes...');


// ═══════════════════════════════════════════════════════════════
// PARTIE 2 (3s): Renommer un canvas
// ═══════════════════════════════════════════════════════════════

setTimeout(() => { // exécute le bloc après 3 secondes

    console.log('');
    console.log('══════════════════════════════════════════════════');
    console.log(' PARTIE 2: Renommer un canvas');
    console.log('══════════════════════════════════════════════════');
    console.log('');

    // getName() retourne le nom actuel du canvas.
    console.log('Nom actuel du canvas 1:', voh.canvas.getName(canvas1));   // affiche "Premier canvas"

    // setName() change le nom d'un canvas.
    // Le nom est purement informatif pour le développeur,
    // il sera aussi affiché dans la barre de titre du canvas (étape ultérieure).
    voh.canvas.setName(canvas1, 'Éditeur principal'); // renomme le canvas

    console.log('Nouveau nom du canvas 1:', voh.canvas.getName(canvas1));  // affiche "Éditeur principal"

    console.log('');
    console.log('✅ Exemple terminé !');

}, 3000);

// ── Diagnostic (décommentez si besoin) ────────────────────────
// Affiche le rapport de diagnostic dans une fenêtre.
// Utile si une erreur se produit pour comprendre d'où ça vient.
// voh.diagnostics.showReport();

// Télécharge le rapport de diagnostic en fichier .txt.
// voh.diagnostics.downloadReport();
