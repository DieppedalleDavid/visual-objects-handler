// ═══════════════════════════════════════════════════════════════
// VOH — Test drawingCallback + Undo/Redo (5 objets)
// ═══════════════════════════════════════════════════════════════
//
// Test simple et visuel pour vérifier que :
// 1. Les drawingCallback s'affichent correctement
// 2. Le déplacement fonctionne et se voit
// 3. Le redimensionnement fonctionne (texture recréée)
// 4. Le undo annule visuellement chaque opération
// 5. Le redo refait visuellement chaque opération
// 6. setDrawingCallback() ajoute/retire un callback en live
// 7. redraw() met à jour l'affichage avec de nouvelles données
//
// ═══════════════════════════════════════════════════════════════


// ── Initialisation ───────────────────────────────────────────
const voh = new VisualObjectsHandler(document.getElementById('container'));
await voh.init();

const zone = voh.zone.create({
    name: 'Zone test callback',
    width: 1200, height: 800,
    backgroundColor: 'rgba(35, 35, 45, 1.0)'
});

const canvas = voh.canvas.create(zone, {
    name: 'Canvas test',
    x: 20, y: 20, width: 900, height: 650,
    backgroundColor: 'rgba(255, 255, 255, 1.0)'
});

let delai = 0;


// ═══════════════════════════════════════════════════════════════
// ÉTAPE 1 (1s) — Créer 5 objets avec drawingCallback
// ═══════════════════════════════════════════════════════════════

delai += 1000;
setTimeout(() => {

    console.log('══════════════════════════════════════════');
    console.log('ÉTAPE 1: Création de 5 objets');
    console.log('══════════════════════════════════════════');

    // ── Objet 1 : Bouton bleu avec texte ──
    window.obj1 = voh.objects.create(canvas, {
        name: 'Bouton bleu',
        x: 30, y: 30, width: 200, height: 60,
        drawingCallback: function(ctx, w, h) {
            ctx.fillStyle = '#3498db';
            ctx.fillRect(0, 0, w, h);
            ctx.strokeStyle = '#2980b9';
            ctx.lineWidth = 2;
            ctx.strokeRect(1, 1, w - 2, h - 2);
            ctx.fillStyle = 'white';
            ctx.font = 'bold 16px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('Bouton Bleu', w / 2, h / 2);
        }
    });
    console.log('  ✅ Obj1: Bouton bleu (200×60) à (30, 30)');

    // ── Objet 2 : Jauge verte 70% ──
    window.jaugeValeur = 0.70;
    window.obj2 = voh.objects.create(canvas, {
        name: 'Jauge verte',
        x: 30, y: 120, width: 300, height: 35,
        drawingCallback: function(ctx, w, h) {
            ctx.fillStyle = '#ecf0f1';
            ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = '#27ae60';
            ctx.fillRect(0, 0, w * window.jaugeValeur, h);
            ctx.strokeStyle = '#bdc3c7';
            ctx.lineWidth = 1;
            ctx.strokeRect(0, 0, w, h);
            ctx.fillStyle = '#2c3e50';
            ctx.font = 'bold 13px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(Math.round(window.jaugeValeur * 100) + '%', w / 2, h / 2);
        }
    });
    console.log('  ✅ Obj2: Jauge verte 70% (300×35) à (30, 120)');

    // ── Objet 3 : Carte violette avec header ──
    window.obj3 = voh.objects.create(canvas, {
        name: 'Carte violette',
        x: 30, y: 190, width: 220, height: 160,
        drawingCallback: function(ctx, w, h, id) {
            ctx.fillStyle = '#f8f9fa';
            ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = '#8e44ad';
            ctx.fillRect(0, 0, w, 35);
            ctx.fillStyle = 'white';
            ctx.font = 'bold 13px Arial';
            ctx.fillText('  Carte Info', 10, 22);
            ctx.fillStyle = '#333';
            ctx.font = '12px Arial';
            ctx.fillText('ID: ' + id, 15, 60);
            ctx.fillText('Taille: ' + w + ' × ' + h, 15, 80);
            ctx.fillText('Position visible', 15, 100);
            ctx.strokeStyle = '#ddd';
            ctx.lineWidth = 1;
            ctx.strokeRect(0, 0, w, h);
        }
    });
    console.log('  ✅ Obj3: Carte violette (220×160) à (30, 190)');

    // ── Objet 4 : Cercle orange (dessin complexe) ──
    window.obj4 = voh.objects.create(canvas, {
        name: 'Badge orange',
        x: 350, y: 30, width: 80, height: 80,
        drawingCallback: function(ctx, w, h) {
            ctx.beginPath();
            ctx.arc(w / 2, h / 2, Math.min(w, h) / 2 - 3, 0, Math.PI * 2);
            ctx.fillStyle = '#e67e22';
            ctx.fill();
            ctx.strokeStyle = '#d35400';
            ctx.lineWidth = 3;
            ctx.stroke();
            ctx.fillStyle = 'white';
            ctx.font = 'bold 20px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('4', w / 2, h / 2);
        }
    });
    console.log('  ✅ Obj4: Badge orange (80×80) à (350, 30)');

    // ── Objet 5 : Objet SANS callback (rendu par défaut) ──
    window.obj5 = voh.objects.create(canvas, {
        name: 'Objet normal',
        x: 350, y: 140, width: 150, height: 100,
        backgroundColor: 'rgba(52, 152, 219, 0.5)'
    });
    console.log('  ✅ Obj5: Objet normal SANS callback (150×100) à (350, 140)');
    console.log('');
    console.log('   → Étape 2 dans 3s : déplacer obj1...');

}, delai);


// ═══════════════════════════════════════════════════════════════
// ÉTAPE 2 (4s) — Déplacer le bouton bleu
// ═══════════════════════════════════════════════════════════════

delai += 3000;
setTimeout(() => {

    console.log('══════════════════════════════════════════');
    console.log('ÉTAPE 2: Déplacer le bouton bleu → (400, 300)');
    console.log('══════════════════════════════════════════');

    voh.canvas.pages.history.pause(canvas);
    voh.objects.setX(obj1, 400);
    voh.objects.setY(obj1, 300);
    voh.canvas.pages.history.resume(canvas, null, 'Déplacement bouton bleu');

    console.log('  ✅ Bouton bleu déplacé à (400, 300)');
    console.log(`  Undo: ${voh.canvas.pages.history.getUndoCount(canvas)}`);
    console.log('   → Étape 3 dans 3s : resize carte violette...');

}, delai);


// ═══════════════════════════════════════════════════════════════
// ÉTAPE 3 (7s) — Redimensionner la carte violette
// ═══════════════════════════════════════════════════════════════

delai += 3000;
setTimeout(() => {

    console.log('══════════════════════════════════════════');
    console.log('ÉTAPE 3: Redimensionner la carte → 350×220');
    console.log('══════════════════════════════════════════');

    voh.canvas.pages.history.pause(canvas);
    voh.objects.setWidth(obj3, 350);
    voh.objects.setHeight(obj3, 220);
    voh.canvas.pages.history.resume(canvas, null, 'Resize carte violette');

    console.log('  ✅ Carte violette agrandie à 350×220');
    console.log('  (Le callback doit afficher les nouvelles dimensions)');
    console.log(`  Undo: ${voh.canvas.pages.history.getUndoCount(canvas)}`);
    console.log('   → Étape 4 dans 3s : redraw jauge à 95%...');

}, delai);


// ═══════════════════════════════════════════════════════════════
// ÉTAPE 4 (10s) — Mettre à jour la jauge via redraw()
// ═══════════════════════════════════════════════════════════════

delai += 3000;
setTimeout(() => {

    console.log('══════════════════════════════════════════');
    console.log('ÉTAPE 4: Mise à jour jauge → 95% via redraw()');
    console.log('══════════════════════════════════════════');

    window.jaugeValeur = 0.95;
    voh.objects.redraw(obj2);

    console.log('  ✅ Jauge mise à jour à 95%');
    console.log('   → Étape 5 dans 3s : ajouter callback à obj5...');

}, delai);


// ═══════════════════════════════════════════════════════════════
// ÉTAPE 5 (13s) — Ajouter un callback à l'objet normal
// ═══════════════════════════════════════════════════════════════

delai += 3000;
setTimeout(() => {

    console.log('══════════════════════════════════════════');
    console.log('ÉTAPE 5: Ajouter drawingCallback à obj5');
    console.log('══════════════════════════════════════════');

    voh.objects.setDrawingCallback(obj5, function(ctx, w, h) {
        ctx.fillStyle = '#e74c3c';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = 'white';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('TRANSFORMÉ !', w / 2, h / 2);
    });

    console.log('  ✅ Obj5 transformé (bleu → rouge avec texte)');
    console.log('   → Étape 6 dans 3s : retirer callback de obj5...');

}, delai);


// ═══════════════════════════════════════════════════════════════
// ÉTAPE 6 (16s) — Retirer le callback de obj5
// ═══════════════════════════════════════════════════════════════

delai += 3000;
setTimeout(() => {

    console.log('══════════════════════════════════════════');
    console.log('ÉTAPE 6: Retirer drawingCallback de obj5');
    console.log('══════════════════════════════════════════');

    voh.objects.setDrawingCallback(obj5, null);

    console.log('  ✅ Obj5 retour au rendu par défaut (bleu semi-transparent)');
    console.log('   → Étape 7 dans 3s : UNDO ×3 ...');

}, delai);


// ═══════════════════════════════════════════════════════════════
// ÉTAPE 7 (19s) — 3 UNDO successifs (1.5s entre chaque)
// ═══════════════════════════════════════════════════════════════

delai += 3000;
setTimeout(() => {

    console.log('══════════════════════════════════════════');
    console.log('ÉTAPE 7: UNDO ×3 (un toutes les 1.5s)');
    console.log('══════════════════════════════════════════');
    console.log(`  Undo disponibles: ${voh.canvas.pages.history.getUndoCount(canvas)}`);

    let count = 0;
    const undoStep = () => {
        if (count >= 3 || !voh.canvas.pages.history.canUndo(canvas)) {
            console.log(`  → ${count} undo effectués`);
            console.log('   → Étape 8 dans 3s : REDO ×3...');
            setTimeout(etape8, 3000);
            return;
        }
        count++;
        const result = voh.canvas.pages.history.undo(canvas);
        console.log(`  ↩️ UNDO #${count}: ${result ? 'OK' : 'ÉCHOUÉ'}`);
        setTimeout(undoStep, 1500);
    };
    undoStep();

}, delai);


// ═══════════════════════════════════════════════════════════════
// ÉTAPE 8 — 3 REDO successifs (1.5s entre chaque)
// ═══════════════════════════════════════════════════════════════

function etape8() {

    console.log('══════════════════════════════════════════');
    console.log('ÉTAPE 8: REDO ×3 (un toutes les 1.5s)');
    console.log('══════════════════════════════════════════');
    console.log(`  Redo disponibles: ${voh.canvas.pages.history.getRedoCount(canvas)}`);

    let count = 0;
    const redoStep = () => {
        if (count >= 3 || !voh.canvas.pages.history.canRedo(canvas)) {
            console.log(`  → ${count} redo effectués`);
            console.log('');
            console.log('════════════════════════════════════════');
            console.log('  TEST TERMINÉ');
            console.log('  Vérifier visuellement que :');
            console.log('  - Bouton bleu est à (400, 300)');
            console.log('  - Carte violette fait 350×220');
            console.log('  - Jauge est à 95%');
            console.log('  - Obj5 est bleu (rendu par défaut)');
            console.log('  - Badge orange est à (350, 30)');
            console.log('════════════════════════════════════════');
            return;
        }
        count++;
        const result = voh.canvas.pages.history.redo(canvas);
        console.log(`  ↪️ REDO #${count}: ${result ? 'OK' : 'ÉCHOUÉ'}`);
        setTimeout(redoStep, 1500);
    };
    redoStep();
}
