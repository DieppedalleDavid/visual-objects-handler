// ═══════════════════════════════════════════════════════════════
// VOH — Test Undo/Redo du drawingCallback
// ═══════════════════════════════════════════════════════════════
//
// 1 objet, 7 modifications, 7 undo, 7 redo.
// Chaque étape = 1 seconde. Vérification visuelle.
//
// ═══════════════════════════════════════════════════════════════

const voh = new VisualObjectsHandler(document.getElementById('container'));
await voh.init();

const zone = voh.zone.create({
    name: 'Zone test',
    width: 1000, height: 700,
    backgroundColor: 'rgba(35, 35, 45, 1.0)'
});

const canvas = voh.canvas.create(zone, {
    name: 'Canvas test',
    x: 20, y: 20, width: 800, height: 550,
    backgroundColor: 'rgba(255, 255, 255, 1.0)'
});

let delai = 0;
let obj;


// ═══════════════════════════════════════════════════════════════
// ACTION 1 (1s) — Créer un objet vide (rendu par défaut gris)
// ═══════════════════════════════════════════════════════════════

delai += 1000;
setTimeout(() => {
    console.log('── ACTION 1: Créer un objet vide (gris) ──');
    obj = voh.objects.create(canvas, {
        name: 'Objet test',
        x: 100, y: 100, width: 150, height: 100,
        backgroundColor: 'rgba(200, 200, 200, 1.0)'
    });
    console.log('  → Rectangle gris 150×100 à (100, 100)');
    console.log(`  Undo: ${voh.canvas.pages.history.getUndoCount(canvas)}`);
}, delai);


// ═══════════════════════════════════════════════════════════════
// ACTION 2 (2s) — Assigner un drawingCallback (fond bleu + texte)
// ═══════════════════════════════════════════════════════════════

delai += 1000;
setTimeout(() => {
    console.log('── ACTION 2: Assigner drawingCallback (BLEU + texte) ──');
    voh.objects.setDrawingCallback(obj, function(ctx, w, h) {
        ctx.fillStyle = '#3498db';
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = '#2980b9';
        ctx.lineWidth = 2;
        ctx.strokeRect(1, 1, w - 2, h - 2);
        ctx.fillStyle = 'white';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('BLEU', w / 2, h / 2);
    });
    console.log('  → L\'objet doit être BLEU avec texte "BLEU"');
    console.log(`  Undo: ${voh.canvas.pages.history.getUndoCount(canvas)}`);
}, delai);


// ═══════════════════════════════════════════════════════════════
// ACTION 3 (3s) — Modifier le dessin (fond vert + texte)
// ═══════════════════════════════════════════════════════════════

delai += 1000;
setTimeout(() => {
    console.log('── ACTION 3: Modifier drawingCallback (VERT + texte) ──');
    voh.objects.setDrawingCallback(obj, function(ctx, w, h) {
        ctx.fillStyle = '#27ae60';
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = '#1e8449';
        ctx.lineWidth = 2;
        ctx.strokeRect(1, 1, w - 2, h - 2);
        ctx.fillStyle = 'white';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('VERT', w / 2, h / 2);
    });
    console.log('  → L\'objet doit être VERT avec texte "VERT"');
    console.log(`  Undo: ${voh.canvas.pages.history.getUndoCount(canvas)}`);
}, delai);


// ═══════════════════════════════════════════════════════════════
// ACTION 4 (4s) — Agrandir l'objet (150×100 → 250×180)
// ═══════════════════════════════════════════════════════════════

delai += 1000;
setTimeout(() => {
    console.log('── ACTION 4: Agrandir → 250×180 ──');
    voh.canvas.pages.history.pause(canvas);
    voh.objects.setWidth(obj, 250);
    voh.objects.setHeight(obj, 180);
    voh.canvas.pages.history.resume(canvas, null, 'Agrandissement');
    console.log('  → L\'objet VERT doit être plus grand (250×180)');
    console.log(`  Undo: ${voh.canvas.pages.history.getUndoCount(canvas)}`);
}, delai);


// ═══════════════════════════════════════════════════════════════
// ACTION 5 (5s) — Déplacer l'objet (100,100 → 350,200)
// ═══════════════════════════════════════════════════════════════

delai += 1000;
setTimeout(() => {
    console.log('── ACTION 5: Déplacer → (350, 200) ──');
    voh.canvas.pages.history.pause(canvas);
    voh.objects.setX(obj, 350);
    voh.objects.setY(obj, 200);
    voh.canvas.pages.history.resume(canvas, null, 'Déplacement');
    console.log('  → L\'objet VERT doit être en bas à droite (350, 200)');
    console.log(`  Undo: ${voh.canvas.pages.history.getUndoCount(canvas)}`);
}, delai);


// ═══════════════════════════════════════════════════════════════
// ACTION 6 (6s) — Assigner un AUTRE drawingCallback (fond rouge)
// ═══════════════════════════════════════════════════════════════

delai += 1000;
setTimeout(() => {
    console.log('── ACTION 6: Nouveau drawingCallback (ROUGE + texte) ──');
    voh.objects.setDrawingCallback(obj, function(ctx, w, h) {
        ctx.fillStyle = '#e74c3c';
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = '#c0392b';
        ctx.lineWidth = 2;
        ctx.strokeRect(1, 1, w - 2, h - 2);
        ctx.fillStyle = 'white';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('ROUGE', w / 2, h / 2);
    });
    console.log('  → L\'objet doit être ROUGE avec texte "ROUGE"');
    console.log(`  Undo: ${voh.canvas.pages.history.getUndoCount(canvas)}`);
}, delai);


// ═══════════════════════════════════════════════════════════════
// ACTION 7 (7s) — Modifier le dessin (fond violet)
// ═══════════════════════════════════════════════════════════════

delai += 1000;
setTimeout(() => {
    console.log('── ACTION 7: Modifier drawingCallback (VIOLET + texte) ──');
    voh.objects.setDrawingCallback(obj, function(ctx, w, h) {
        ctx.fillStyle = '#8e44ad';
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = '#6c3483';
        ctx.lineWidth = 2;
        ctx.strokeRect(1, 1, w - 2, h - 2);
        ctx.fillStyle = 'white';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('VIOLET', w / 2, h / 2);
    });
    console.log('  → L\'objet doit être VIOLET avec texte "VIOLET"');
    console.log(`  Undo: ${voh.canvas.pages.history.getUndoCount(canvas)}`);
    console.log('');
    console.log('══════════════════════════════════════════');
    console.log('  7 actions. Début des UNDO dans 2s...');
    console.log('══════════════════════════════════════════');
}, delai);


// ═══════════════════════════════════════════════════════════════
// UNDO ×7 (9s → 16s) — 1 seconde entre chaque
// ═══════════════════════════════════════════════════════════════

delai += 2000;
setTimeout(() => {
    console.log('');
    console.log('══════════════════════════════════════════');
    console.log('UNDO ×7 — Annuler tout (1s entre chaque)');
    console.log('══════════════════════════════════════════');

    const attendus = [
        'UNDO 1 → doit revenir à ROUGE',
        'UNDO 2 → doit revenir à VERT (en bas droite)',
        'UNDO 3 → doit revenir à VERT en haut gauche (100,100)',
        'UNDO 4 → doit revenir à VERT petit (150×100)',
        'UNDO 5 → doit revenir à BLEU',
        'UNDO 6 → doit revenir à GRIS (rendu par défaut)',
        'UNDO 7 → objet supprimé (création annulée)'
    ];

    let count = 0;
    const undoStep = () => {
        if (count >= 7 || !voh.canvas.pages.history.canUndo(canvas)) {
            console.log('');
            console.log(`  ${count} undo effectués.`);
            console.log('  L\'objet doit avoir DISPARU.');
            console.log('  Début des REDO dans 2s...');
            setTimeout(startRedo, 2000);
            return;
        }
        const result = voh.canvas.pages.history.undo(canvas);
        console.log(`  ↩️ ${attendus[count]} — ${result ? 'OK' : 'ÉCHOUÉ'}`);
        count++;
        setTimeout(undoStep, 1000);
    };
    undoStep();
}, delai);


// ═══════════════════════════════════════════════════════════════
// REDO ×7 — Refaire tout (1s entre chaque)
// ═══════════════════════════════════════════════════════════════

function startRedo() {
    console.log('');
    console.log('══════════════════════════════════════════');
    console.log('REDO ×7 — Refaire tout (1s entre chaque)');
    console.log('══════════════════════════════════════════');

    const attendus = [
        'REDO 1 → objet GRIS réapparaît (150×100 à 100,100)',
        'REDO 2 → passe à BLEU',
        'REDO 3 → passe à VERT',
        'REDO 4 → VERT agrandi (250×180)',
        'REDO 5 → VERT déplacé en bas droite (350,200)',
        'REDO 6 → passe à ROUGE',
        'REDO 7 → passe à VIOLET'
    ];

    let count = 0;
    const redoStep = () => {
        if (count >= 7 || !voh.canvas.pages.history.canRedo(canvas)) {
            console.log('');
            console.log(`  ${count} redo effectués.`);
            console.log('');
            console.log('════════════════════════════════════════');
            console.log('  TEST TERMINÉ');
            console.log('  L\'objet doit être VIOLET 250×180');
            console.log('  à la position (350, 200)');
            console.log('════════════════════════════════════════');
            return;
        }
        const result = voh.canvas.pages.history.redo(canvas);
        console.log(`  ↪️ ${attendus[count]} — ${result ? 'OK' : 'ÉCHOUÉ'}`);
        count++;
        setTimeout(redoStep, 1000);
    };
    redoStep();
}
