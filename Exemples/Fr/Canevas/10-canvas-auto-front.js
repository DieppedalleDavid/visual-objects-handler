// ═══════════════════════════════════════════════════════════════
// VOH — Canevas: Exemple 10: Mise au premier plan automatique
// ═══════════════════════════════════════════════════════════════
//
// Ce script montre comment:
// - Activer l'option bringCanvasToFrontOnActivation sur une zone
// - Comprendre la différence entre le comportement par défaut
//   (les z-orders ne bougent pas à l'activation) et le
//   comportement "fenêtres de bureau" (le canvas activé passe
//   automatiquement devant tous les autres)
// - Écouter les événements canvas:zOrderChanged déclenchés
//   automatiquement lors de l'activation
//
// Par défaut, activer un canvas (le sélectionner pour l'éditer)
// ne change PAS son ordre d'affichage (z-order). Un canvas au
// fond reste visuellement au fond même s'il est actif et
// éditable. Seuls les appels explicites à moveUp(), moveDown(),
// bringToFront(), sendToBack() et setZOrder() modifient les
// z-orders.
//
// Avec l'option bringCanvasToFrontOnActivation activée sur la
// zone, activer un canvas le place automatiquement devant tous
// les autres, exactement comme le comportement des fenêtres de
// bureau (Windows, macOS): cliquer sur une fenêtre la met devant.
//
// L'option est configurée par ZONE, ce qui permet d'avoir un
// comportement différent selon les zones si nécessaire.
//
// Les démonstrations s'enchaînent avec un délai entre chaque
// partie pour que vous puissiez suivre les logs dans la console.
//
// API utilisées:
//   voh.zone.create()
//   voh.zone.setBringCanvasToFrontOnActivation()
//   voh.zone.getBringCanvasToFrontOnActivation()
//   voh.canvas.create()
//   voh.canvas.setActive()
//   voh.canvas.getActiveId()
//   voh.canvas.getZOrder()
//   voh.canvas.getName()
//   voh.on() (canvas:zOrderChanged, canvas:activated,
//             zone:bringCanvasToFrontOnActivationChanged)
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
// ABONNEMENTS — On s'inscrit aux événements AVANT de faire quoi
// que ce soit, pour capturer tout ce qui se passe dès le début.
// ═══════════════════════════════════════════════════════════════

// ── canvas:zOrderChanged — émis quand l'ordre d'affichage change ──
// Données: { canvasId, zOrder }
// Déclenché par setZOrder(), moveUp(), moveDown(), bringToFront(),
// sendToBack(), et AUSSI automatiquement à l'activation si
// l'option bringCanvasToFrontOnActivation est activée.
voh.on('canvas:zOrderChanged', (data) => { // écoute les changements de z-order
    const canvasName = voh.canvas.getName(data.canvasId); // récupère le nom du canvas pour l'affichage
    console.log(`  📐 canvas:zOrderChanged — ${canvasName} → zOrder ${data.zOrder}`); // affiche le nouveau z-order
});

// ── canvas:activated — émis quand un canvas devient actif ──
// Données: { canvasId, previousCanvasId }
// Déclenché par voh.canvas.setActive() ou automatiquement
// lors de la première création ou après une suppression.
// previousCanvasId est null si c'est la première activation.
voh.on('canvas:activated', (data) => { // écoute les activations de canvas
    const canvasName = voh.canvas.getName(data.canvasId); // récupère le nom du canvas activé
    console.log(`  ✅ canvas:activated — ${canvasName}`); // affiche quel canvas est maintenant actif
});

// ── zone:bringCanvasToFrontOnActivationChanged ──
// Données: { zoneId, enabled }
// Émis quand l'option est activée ou désactivée sur une zone.
voh.on('zone:bringCanvasToFrontOnActivationChanged', (data) => { // écoute les changements de l'option
    const etat = data.enabled ? 'ACTIVÉE' : 'DÉSACTIVÉE'; // traduit le booléen en texte lisible
    console.log(`  ⚙️ zone:bringCanvasToFrontOnActivationChanged — ${etat} sur la zone ${data.zoneId}`); // affiche le changement
});

console.log('✅ 3 abonnements en place. Les démonstrations commencent...'); // confirme que les abonnements sont prêts
console.log(''); // ligne vide pour la lisibilité dans la console


// ═══════════════════════════════════════════════════════════════
// Variables partagées entre les étapes.
// Déclarées avec let car elles seront assignées plus bas.
// ═══════════════════════════════════════════════════════════════
let zoneId  = null; // ID de la zone (assigné dans PARTIE 1)
let canvasA = null; // ID du canvas rouge (assigné dans PARTIE 1)
let canvasB = null; // ID du canvas vert (assigné dans PARTIE 1)
let canvasC = null; // ID du canvas bleu (assigné dans PARTIE 1)


// ═══════════════════════════════════════════════════════════════
// PARTIE 1 (0s): Création de la zone et des 3 canvas
// Chaque canvas a une couleur de fond différente pour les
// différencier visuellement dans la zone.
// ═══════════════════════════════════════════════════════════════

console.log('══════════════════════════════════════════════════'); // séparateur visuel
console.log(' PARTIE 1: Création de la zone et des 3 canvas'); // titre de la partie
console.log('══════════════════════════════════════════════════'); // séparateur visuel
console.log(''); // ligne vide

// ── Créer une zone (conteneur de premier niveau) ───────────────
zoneId = voh.zone.create({ // crée une zone, retourne son ID
    name: 'Zone principale',                       // nom pour identifier la zone
    backgroundColor: 'rgba(40, 40, 50, 1.0)',      // couleur de fond (gris foncé)
    borderColor: 'rgba(80, 80, 100, 1.0)',         // couleur de la bordure (gris clair)
    borderThickness: 2                                 // épaisseur de la bordure en pixels
});

// ── Créer 3 canvas superposés dans la zone ─────────────────────
// Chaque canvas est décalé pour qu'on puisse voir l'empilement.
// Le premier créé (Canvas A) sera au fond (z-order le plus bas),
// le dernier créé (Canvas C) sera devant (z-order le plus haut).

canvasA = voh.canvas.create(zoneId, { // crée le canvas A (premier = auto-activé), retourne son ID
    name: 'Canvas A (rouge)',                      // nom avec sa couleur pour l'identifier
    x: 20,  y: 20,                                 // position en haut à gauche
    width: 400, height: 250,                       // dimensions en pixels
    backgroundColor: 'rgba(180, 60, 60, 1.0)'     // fond rouge pour l'identifier visuellement
});

canvasB = voh.canvas.create(zoneId, { // crée le canvas B, retourne son ID
    name: 'Canvas B (vert)',                       // nom avec sa couleur pour l'identifier
    x: 100, y: 80,                                 // décalé pour être visible derrière C mais devant A
    width: 400, height: 250,                       // mêmes dimensions
    backgroundColor: 'rgba(60, 140, 60, 1.0)'     // fond vert pour l'identifier visuellement
});

canvasC = voh.canvas.create(zoneId, { // crée le canvas C, retourne son ID
    name: 'Canvas C (bleu)',                       // nom avec sa couleur pour l'identifier
    x: 180, y: 140,                                // décalé encore plus pour être visible devant A et B
    width: 400, height: 250,                       // mêmes dimensions
    backgroundColor: 'rgba(60, 80, 180, 1.0)'     // fond bleu pour l'identifier visuellement
});

// Afficher les z-orders initiaux pour bien comprendre l'empilement.
console.log(''); // ligne vide
console.log('Z-orders initiaux:'); // titre
console.log(`  Canvas A (rouge): zOrder ${voh.canvas.getZOrder(canvasA)}`); // z-order de A (le plus bas)
console.log(`  Canvas B (vert):  zOrder ${voh.canvas.getZOrder(canvasB)}`); // z-order de B (milieu)
console.log(`  Canvas C (bleu):  zOrder ${voh.canvas.getZOrder(canvasC)}`); // z-order de C (le plus haut)
console.log(''); // ligne vide
console.log('   → Prochaine étape dans 3 secondes...'); // annonce le délai


// ═══════════════════════════════════════════════════════════════
// PARTIE 2 (3s): Sans l'option (comportement par défaut)
// Quand on active un canvas, il devient éditable mais son
// z-order ne change PAS. Un canvas au fond reste au fond.
// ═══════════════════════════════════════════════════════════════

setTimeout(() => { // exécute le bloc après 3 secondes

    console.log(''); // ligne vide
    console.log('══════════════════════════════════════════════════'); // séparateur visuel
    console.log(' PARTIE 2: Option DÉSACTIVÉE (par défaut)'); // titre de la partie
    console.log('══════════════════════════════════════════════════'); // séparateur visuel
    console.log(''); // ligne vide

    // Vérifier que l'option est bien désactivée par défaut.
    const optionParDefaut = voh.zone.getBringCanvasToFrontOnActivation(zoneId); // lit l'état de l'option
    console.log(`Option par défaut: ${optionParDefaut}`); // affiche false (désactivée)
    console.log(''); // ligne vide

    // Activer le canvas A qui est AU FOND (z-order le plus bas).
    // Sans l'option, il devient actif (éditable) mais reste
    // visuellement derrière les autres canvas.
    console.log('── Activation du Canvas A (rouge, au fond) ──'); // annonce l'action
    voh.canvas.setActive(canvasA); // active le canvas A

    // Vérifier que les z-orders n'ont PAS changé.
    // Le canvas A est actif mais toujours au fond visuellement.
    console.log(''); // ligne vide
    console.log('Z-orders après activation (inchangés):'); // titre
    console.log(`  Canvas A (rouge): zOrder ${voh.canvas.getZOrder(canvasA)} ← actif mais toujours au fond`); // z-order inchangé
    console.log(`  Canvas B (vert):  zOrder ${voh.canvas.getZOrder(canvasB)} ← inchangé`); // z-order inchangé
    console.log(`  Canvas C (bleu):  zOrder ${voh.canvas.getZOrder(canvasC)} ← inchangé`); // z-order inchangé
    console.log(''); // ligne vide
    console.log('   → Aucun événement canvas:zOrderChanged émis.'); // pas de changement = pas d'événement
    console.log('   → Prochaine étape dans 3 secondes...'); // annonce le délai

}, 3000);


// ═══════════════════════════════════════════════════════════════
// PARTIE 3 (6s): Activer l'option
// On active bringCanvasToFrontOnActivation sur la zone.
// À partir de maintenant, chaque activation placera le canvas
// activé devant tous les autres automatiquement.
// ═══════════════════════════════════════════════════════════════

setTimeout(() => { // exécute le bloc après 6 secondes

    console.log(''); // ligne vide
    console.log('══════════════════════════════════════════════════'); // séparateur visuel
    console.log(' PARTIE 3: Activation de l\'option'); // titre de la partie
    console.log('══════════════════════════════════════════════════'); // séparateur visuel
    console.log(''); // ligne vide

    // Activer l'option sur la zone.
    // Émet l'événement zone:bringCanvasToFrontOnActivationChanged.
    console.log('── setBringCanvasToFrontOnActivation(true) ──'); // annonce l'action
    voh.zone.setBringCanvasToFrontOnActivation(zoneId, true); // active l'option

    // Vérifier que l'option est bien activée.
    const optionActivee = voh.zone.getBringCanvasToFrontOnActivation(zoneId); // relit l'état
    console.log(`Option activée: ${optionActivee}`); // affiche true
    console.log(''); // ligne vide
    console.log('   → Prochaine étape dans 3 secondes...'); // annonce le délai

}, 6000);


// ═══════════════════════════════════════════════════════════════
// PARTIE 4 (9s): Activer le canvas C (déjà devant)
// Le canvas C est déjà au z-order le plus haut, donc l'activer
// ne devrait pas changer significativement l'empilement.
// ═══════════════════════════════════════════════════════════════

setTimeout(() => { // exécute le bloc après 9 secondes

    console.log(''); // ligne vide
    console.log('══════════════════════════════════════════════════'); // séparateur visuel
    console.log(' PARTIE 4: Activer Canvas C (bleu, déjà devant)'); // titre de la partie
    console.log('══════════════════════════════════════════════════'); // séparateur visuel
    console.log(''); // ligne vide

    // Le canvas C est déjà devant (z-order le plus haut).
    // L'activer avec l'option va quand même appeler bringToFront,
    // mais comme il est déjà devant, rien ne change visuellement.
    console.log('── Activation du Canvas C (bleu) ──'); // annonce l'action
    voh.canvas.setActive(canvasC); // active le canvas C

    console.log(''); // ligne vide
    console.log('Z-orders:'); // titre
    console.log(`  Canvas A (rouge): zOrder ${voh.canvas.getZOrder(canvasA)}`); // position relative
    console.log(`  Canvas B (vert):  zOrder ${voh.canvas.getZOrder(canvasB)}`); // position relative
    console.log(`  Canvas C (bleu):  zOrder ${voh.canvas.getZOrder(canvasC)} ← déjà devant, pas de changement`); // déjà au max
    console.log(''); // ligne vide
    console.log('   → Prochaine étape dans 3 secondes...'); // annonce le délai

}, 9000);


// ═══════════════════════════════════════════════════════════════
// PARTIE 5 (12s): Activer le canvas A (au fond)
// Cette fois le canvas A est au fond. Avec l'option activée,
// il va passer automatiquement devant tous les autres !
// C'est ici que la différence est bien visible.
// ═══════════════════════════════════════════════════════════════

setTimeout(() => { // exécute le bloc après 12 secondes

    console.log(''); // ligne vide
    console.log('══════════════════════════════════════════════════'); // séparateur visuel
    console.log(' PARTIE 5: Activer Canvas A (rouge, au fond) → il passe devant !'); // titre de la partie
    console.log('══════════════════════════════════════════════════'); // séparateur visuel
    console.log(''); // ligne vide

    // Le canvas A est au fond (z-order le plus bas).
    // Grâce à l'option, il va passer automatiquement devant tous
    // les autres ! Un événement canvas:zOrderChanged sera émis.
    console.log('── Activation du Canvas A (rouge) ──'); // annonce l'action
    voh.canvas.setActive(canvasA); // active le canvas A → il passe devant automatiquement !

    console.log(''); // ligne vide
    console.log('Z-orders après activation automatique:'); // titre
    console.log(`  Canvas A (rouge): zOrder ${voh.canvas.getZOrder(canvasA)} ← maintenant devant !`); // z-order le plus haut
    console.log(`  Canvas B (vert):  zOrder ${voh.canvas.getZOrder(canvasB)}`); // position relative
    console.log(`  Canvas C (bleu):  zOrder ${voh.canvas.getZOrder(canvasC)}`); // position relative
    console.log(''); // ligne vide
    console.log('   → canvas:zOrderChanged émis pour Canvas A.'); // l'événement a été capturé
    console.log('   → Prochaine étape dans 3 secondes...'); // annonce le délai

}, 12000);


// ═══════════════════════════════════════════════════════════════
// PARTIE 6 (15s): Activer le canvas B → lui aussi passe devant
// On vérifie que ça fonctionne à chaque activation.
// ═══════════════════════════════════════════════════════════════

setTimeout(() => { // exécute le bloc après 15 secondes

    console.log(''); // ligne vide
    console.log('══════════════════════════════════════════════════'); // séparateur visuel
    console.log(' PARTIE 6: Activer Canvas B (vert) → il passe devant !'); // titre de la partie
    console.log('══════════════════════════════════════════════════'); // séparateur visuel
    console.log(''); // ligne vide

    // Le canvas B n'est pas devant. L'activer le place
    // automatiquement au premier plan grâce à l'option.
    console.log('── Activation du Canvas B (vert) ──'); // annonce l'action
    voh.canvas.setActive(canvasB); // active le canvas B → il passe devant automatiquement !

    console.log(''); // ligne vide
    console.log('Z-orders après activation automatique:'); // titre
    console.log(`  Canvas A (rouge): zOrder ${voh.canvas.getZOrder(canvasA)}`); // position relative
    console.log(`  Canvas B (vert):  zOrder ${voh.canvas.getZOrder(canvasB)} ← maintenant devant !`); // z-order le plus haut
    console.log(`  Canvas C (bleu):  zOrder ${voh.canvas.getZOrder(canvasC)}`); // position relative
    console.log(''); // ligne vide
    console.log('   → Prochaine étape dans 3 secondes...'); // annonce le délai

}, 15000);


// ═══════════════════════════════════════════════════════════════
// PARTIE 7 (18s): Désactiver l'option et vérifier
// On désactive l'option. Les z-orders restent dans leur état
// actuel mais les prochaines activations ne les modifieront plus.
// ═══════════════════════════════════════════════════════════════

setTimeout(() => { // exécute le bloc après 18 secondes

    console.log(''); // ligne vide
    console.log('══════════════════════════════════════════════════'); // séparateur visuel
    console.log(' PARTIE 7: Désactivation de l\'option'); // titre de la partie
    console.log('══════════════════════════════════════════════════'); // séparateur visuel
    console.log(''); // ligne vide

    // Désactiver l'option — retour au comportement par défaut.
    // Émet l'événement zone:bringCanvasToFrontOnActivationChanged.
    console.log('── setBringCanvasToFrontOnActivation(false) ──'); // annonce l'action
    voh.zone.setBringCanvasToFrontOnActivation(zoneId, false); // désactive l'option

    // Vérifier que l'option est bien désactivée.
    const optionDesactivee = voh.zone.getBringCanvasToFrontOnActivation(zoneId); // relit l'état
    console.log(`Option désactivée: ${optionDesactivee}`); // affiche false
    console.log(''); // ligne vide

    // Activer un autre canvas — cette fois, pas de changement
    // de z-order puisque l'option est désactivée.
    console.log('── Activation du Canvas C (bleu) ──'); // annonce l'action
    voh.canvas.setActive(canvasC); // active le canvas C

    // Vérifier que les z-orders n'ont PAS changé.
    console.log(''); // ligne vide
    console.log('Z-orders (aucun changement):'); // titre
    console.log(`  Canvas A (rouge): zOrder ${voh.canvas.getZOrder(canvasA)} ← inchangé`); // z-order inchangé
    console.log(`  Canvas B (vert):  zOrder ${voh.canvas.getZOrder(canvasB)} ← inchangé`); // z-order inchangé
    console.log(`  Canvas C (bleu):  zOrder ${voh.canvas.getZOrder(canvasC)} ← inchangé`); // z-order inchangé
    console.log(''); // ligne vide
    console.log('   → Retour au comportement normal: pas de changement de z-order.'); // confirmation

}, 18000);


// ═══════════════════════════════════════════════════════════════
// RÉCAPITULATIF (21s)
// ═══════════════════════════════════════════════════════════════

setTimeout(() => { // exécute le bloc après 21 secondes

    console.log(''); // ligne vide
    console.log('══════════════════════════════════════════════════'); // séparateur visuel
    console.log(' RÉCAPITULATIF'); // titre
    console.log('══════════════════════════════════════════════════'); // séparateur visuel
    console.log(''); // ligne vide
    console.log('• Par défaut (option false): activer un canvas ne'); // explication
    console.log('  change pas les z-orders. Il est éditable mais reste'); // suite
    console.log('  à sa position visuelle dans l\'empilement.'); // suite
    console.log(''); // ligne vide
    console.log('• Avec l\'option (true): activer un canvas le place'); // explication
    console.log('  automatiquement devant tous les autres, comme les'); // suite
    console.log('  fenêtres de bureau (Windows, macOS).'); // suite
    console.log(''); // ligne vide
    console.log('• L\'option est par zone: chaque zone peut avoir son'); // explication
    console.log('  propre comportement.'); // suite
    console.log(''); // ligne vide
    console.log('• Les moveUp(), moveDown(), setZOrder() fonctionnent'); // explication
    console.log('  toujours, indépendamment de l\'option.'); // suite
    console.log(''); // ligne vide
    console.log('✅ Exemple terminé !'); // fin de l'exemple

}, 21000);

// ── Diagnostic (décommentez si besoin) ────────────────────────
// Affiche le rapport de diagnostic dans une fenêtre.
// Utile si une erreur se produit pour comprendre d'où ça vient.
// voh.diagnostics.showReport();

// Télécharge le rapport de diagnostic en fichier .txt.
// voh.diagnostics.downloadReport();
