// ═══════════════════════════════════════════════════════════════
// VOH — Canevas: Exemple 01: Création basique
// ═══════════════════════════════════════════════════════════════
//
// Ce script montre comment:
// - Initialiser le moteur VOH
// - Créer une zone (conteneur de premier niveau)
// - Créer un canvas dans cette zone
// - Lire les propriétés du canvas créé
//
// Un canvas est une surface de travail positionnée dans une zone.
// C'est sur un canvas qu'on placera ensuite des objets visuels.
// Chaque zone peut contenir un ou plusieurs canvas indépendants.
// Le premier canvas créé est automatiquement activé (éditable).
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


// ── Créer une zone (le conteneur de premier niveau) ────────────
// Un canvas doit toujours être créé à l'intérieur d'une zone.
// La zone sert de viewport: fond, grille décorative, scroll, zoom.
// voh.zone.create() retourne l'ID de la zone (un nombre unique).
const zone = voh.zone.create({ // crée une zone, retourne son ID
    name: 'Zone principale',                       // nom pour identifier la zone
    width: 1500,                                   // largeur de la zone en pixels
    height: 1000,                                  // hauteur de la zone en pixels
    backgroundColor: 'rgba(40, 40, 50, 1.0)',      // couleur de fond (gris foncé)
    borderColor: 'rgba(80, 80, 100, 1.0)',         // couleur de la bordure (gris clair)
    borderThickness: 2                                 // épaisseur de la bordure en pixels
});


// ── Créer un canvas dans la zone ───────────────────────────────
// voh.canvas.create() prend l'ID de la zone en premier paramètre,
// puis un objet d'options (tous optionnels).
// Par défaut: x=50, y=50, width=800, height=600, fond blanc.
const canvas = voh.canvas.create(zone, { // crée un canvas dans la zone, retourne son ID
    name: 'Mon premier canvas',                    // nom pour identifier le canvas
    x: 30,                                         // position horizontale dans la zone (pixels)
    y: 30,                                         // position verticale dans la zone (pixels)
    width: 600,                                    // largeur du canvas en pixels
    height: 400,                                   // hauteur du canvas en pixels
    backgroundColor: 'rgba(255, 255, 255, 1.0)'    // couleur de fond du canvas (blanc)
});


// ── Lire les propriétés du canvas ──────────────────────────────
// Chaque propriété est lisible avec un getter (get...).
// L'ID retourné par create() est nécessaire pour toutes les opérations.
console.log('✅ Canvas créé — ID:', canvas);                                                 // affiche l'ID unique du canvas
console.log('📋 Nom:', voh.canvas.getName(canvas));                                          // retourne le nom du canvas
console.log('📍 Position:', voh.canvas.getX(canvas), ',', voh.canvas.getY(canvas));           // retourne la position X, Y
console.log('📐 Taille:', voh.canvas.getWidth(canvas), '×', voh.canvas.getHeight(canvas));   // retourne largeur × hauteur
console.log('🔢 Z-order:', voh.canvas.getZOrder(canvas));                                    // retourne l'ordre d'empilement
console.log('🔓 Verrouillé?', voh.canvas.isLocked(canvas));                                  // retourne true/false
console.log('👁️ Visible?', voh.canvas.isVisible(canvas));                                   // retourne true/false
console.log('🌫️ Opacité:', voh.canvas.getOpacity(canvas));                                  // retourne 0.0 à 1.0
console.log('');

// Le premier canvas créé dans l'instance est automatiquement activé.
// Le canvas actif est celui qui est en cours d'édition (outline bleu visible).
// Un seul canvas est actif à la fois dans toute l'instance VOH.
console.log('👁️ Canvas actif:', voh.canvas.getActiveId(), '(automatique pour le premier)');  // retourne l'ID du canvas actif
console.log('🗺️ Zone parente:', voh.canvas.getZoneId(canvas));                               // retourne l'ID de la zone contenant ce canvas

// ── Diagnostic (décommentez si besoin) ────────────────────────
// Affiche le rapport de diagnostic dans une fenêtre.
// Utile si une erreur se produit pour comprendre d'où ça vient.
// voh.diagnostics.showReport();

// Télécharge le rapport de diagnostic en fichier .txt.
// voh.diagnostics.downloadReport();
