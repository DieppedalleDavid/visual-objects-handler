// ═══════════════════════════════════════════════════════════════
// VOH — Benchmark Undo/Redo avec 20 000 objets + drawingCallback
// ═══════════════════════════════════════════════════════════════

function mesurer(label, callback) {
    const debut = performance.now();
    const resultat = callback();
    const fin = performance.now();
    const duree = (fin - debut).toFixed(3);
    console.log(`  ⏱ ${label}: ${duree} ms`);
    return { label, duree: parseFloat(duree), resultat };
}

function attendre(ms) { return new Promise(r => setTimeout(r, ms)); }

const voh = new VisualObjectsHandler(document.getElementById('container'));
await voh.init();
const resultats = [];

const zone = voh.zone.create({ name: 'Zone benchmark', width: 5500, height: 3000, backgroundColor: 'rgba(30, 30, 35, 1.0)' });
const canvas = voh.canvas.create(zone, { name: 'Canvas benchmark', x: 10, y: 10, width: 5200, height: 2800, backgroundColor: 'rgba(255, 255, 255, 1.0)' });

const tousLesObjets = [];
const colonnes = 200, lignes = 100, espacement = 5, taille = 20;

await voh.canvas.waitForRender(canvas);

console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║   BENCHMARK UNDO/REDO — 20 000 OBJETS + DRAWINGCALLBACK   ║');
console.log('╚══════════════════════════════════════════════════════════════╝');
console.log('');

// ═══ PHASE 1 ═══

const tempsGlobalDebut = performance.now(); // Pour calculer le temps que ça prends de créer les objets.

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('PHASE 1: Création de 20 000 objets + drawingCallback');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
voh.canvas.pages.history.pause(canvas);
const r1 = mesurer('Création de 20 000 objets (callback)', () => {
    for (let ligne = 0; ligne < lignes; ligne++) {
        for (let col = 0; col < colonnes; col++) {
            const x = 20 + col * (taille + espacement);
            const y = 20 + ligne * (taille + espacement);
            const rouge = Math.floor((col / colonnes) * 200) + 55;
            const vert  = Math.floor((ligne / lignes) * 200) + 55;
            const objId = voh.objects.create(canvas, {
                x: x, y: y, width: taille, height: taille,
                name: `Obj_${ligne}_${col}`,
                drawingCallback: function(ctx, w, h) {
                    ctx.fillStyle = `rgba(${rouge}, ${vert}, 150, 1.0)`;
                    ctx.fillRect(0, 0, w, h);
                    ctx.strokeStyle = `rgba(${Math.max(0, rouge - 40)}, ${Math.max(0, vert - 40)}, 120, 1.0)`;
                    ctx.lineWidth = 1;
                    ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
                }
            });
            tousLesObjets.push(objId);
        }
    }
    return tousLesObjets.length;
});
resultats.push(r1);

voh.canvas.pages.history.resume(canvas, null, 'Création de 20 000 objets (callback)');
console.log(`  → ${tousLesObjets.length} objets créés — Undo: ${voh.canvas.pages.history.getUndoCount(canvas)}`);

await voh.canvas.waitForRender(canvas);

const tempsGlobalFin = performance.now(); // Pour calculer le temps que ça prends de créer les objets.

console.log(`  ⏱ Temps TOTAL visible (création + rendu): ${(tempsGlobalFin - tempsGlobalDebut).toFixed(3)} ms`);
console.log(`  ⏱ Dont rendu GPU: ${voh.canvas.getLastRenderTime(canvas).toFixed(3)} ms`);
console.log(`  ⏱ Dont allocation JS: ${r1.duree.toFixed(3)} ms`);

await attendre(2000);

// ═══ PHASE 2 ═══
console.log('');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('PHASE 2: Déplacement batch de 500 objets (+50, +50)');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
voh.canvas.pages.history.pause(canvas);
const r2 = mesurer('Déplacement de 500 objets', () => {
    for (const objId of tousLesObjets.slice(0, 1000)) {
        voh.objects.setX(objId, voh.objects.getX(objId) + 50);
        voh.objects.setY(objId, voh.objects.getY(objId) + 50);
    }
});
resultats.push(r2);
voh.canvas.pages.history.resume(canvas, null, 'Déplacement 500 objets');
console.log(`  → Undo: ${voh.canvas.pages.history.getUndoCount(canvas)}`);
await voh.canvas.waitForRender(canvas);
await attendre(2000);

// ═══ PHASE 3 ═══
console.log('');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('PHASE 3: Redimensionnement batch de 200 objets (20→40)');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
voh.canvas.pages.history.pause(canvas);
const r3 = mesurer('Redimensionnement de 200 objets', () => {
    for (const objId of tousLesObjets.slice(500, 700)) {
        voh.objects.setWidth(objId, 40);
        voh.objects.setHeight(objId, 40);
    }
});
resultats.push(r3);
voh.canvas.pages.history.resume(canvas, null, 'Resize 200 objets');
console.log(`  → Undo: ${voh.canvas.pages.history.getUndoCount(canvas)}`);
await voh.canvas.waitForRender(canvas);
await attendre(2000);

// ═══ PHASE 4 ═══
console.log('');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('PHASE 4: 10 changements de drawingCallback (rouge)');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
const r4 = mesurer('10 changements de callback (rouge)', () => {
    for (let i = 0; i < 10; i++) {
        const objId = tousLesObjets[200 + i];
        voh.objects.setDrawingCallback(objId, function(ctx, w, h) {
            ctx.fillStyle = 'rgba(255, 0, 0, 1.0)';
            ctx.fillRect(0, 0, w, h);
            ctx.strokeStyle = 'rgba(180, 0, 0, 1.0)';
            ctx.lineWidth = 2;
            ctx.strokeRect(1, 1, w - 2, h - 2);
        });
    }
});
resultats.push(r4);
console.log(`  → Undo: ${voh.canvas.pages.history.getUndoCount(canvas)}`);
await voh.canvas.waitForRender(canvas);
await attendre(2000);

// ═══ PHASE 5 — UNDO ═══
console.log('');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('PHASE 5: UNDO — annuler chaque action une par une');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`  ${voh.canvas.pages.history.getUndoCount(canvas)} actions à annuler`);
let undoIndex = 0;
while (voh.canvas.pages.history.canUndo(canvas)) {
    undoIndex++;
    const r = mesurer(`UNDO #${undoIndex}`, () => voh.canvas.pages.history.undo(canvas));
    resultats.push(r);
    await voh.canvas.waitForRender(canvas);
    await attendre(500);
}
console.log(`  → ${undoIndex} undo effectués — Objets: ${voh.objects.getCount(canvas)}`);
await attendre(2000);

// ═══ PHASE 6 — REDO ═══
console.log('');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('PHASE 6: REDO — refaire chaque action une par une');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`  ${voh.canvas.pages.history.getRedoCount(canvas)} actions à refaire`);
let redoIndex = 0;
while (voh.canvas.pages.history.canRedo(canvas)) {
    redoIndex++;
    const r = mesurer(`REDO #${redoIndex}`, () => voh.canvas.pages.history.redo(canvas));
    resultats.push(r);
    await voh.canvas.waitForRender(canvas);
    await attendre(500);
}
console.log(`  → ${redoIndex} redo effectués — Objets: ${voh.objects.getCount(canvas)}`);
await attendre(2000);

// ═══ PHASE 7 — STRESS ═══
console.log('');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('PHASE 7: Stress — 500 objets × 60 mouvements');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
voh.canvas.pages.history.pause(canvas);
const r7 = mesurer('60 000 setX+setY (coalescing)', () => {
    for (let frame = 0; frame < 60; frame++) {
        for (const objId of tousLesObjets.slice(0, 500)) {
            voh.objects.setX(objId, voh.objects.getX(objId) + 1);
            voh.objects.setY(objId, voh.objects.getY(objId) + 1);
        }
    }
});
resultats.push(r7);
voh.canvas.pages.history.resume(canvas, null, 'Drag 500 obj × 60 frames');
console.log(`  → Undo: ${voh.canvas.pages.history.getUndoCount(canvas)}`);
await voh.canvas.waitForRender(canvas);
await attendre(1500);

const ru = mesurer('UNDO stress (500 obj)', () => voh.canvas.pages.history.undo(canvas));
resultats.push(ru);
await voh.canvas.waitForRender(canvas);
await attendre(1500);

const rr = mesurer('REDO stress (500 obj)', () => voh.canvas.pages.history.redo(canvas));
resultats.push(rr);
await voh.canvas.waitForRender(canvas);
await attendre(1000);

// ═══ RÉSUMÉ ═══
console.log('');
console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║   RÉSUMÉ DES MESURES                                       ║');
console.log('╚══════════════════════════════════════════════════════════════╝');
const phases = resultats.filter(r => !r.label.startsWith('UNDO') && !r.label.startsWith('REDO'));
const undos  = resultats.filter(r => r.label.startsWith('UNDO'));
const redos  = resultats.filter(r => r.label.startsWith('REDO'));
console.log('── Opérations principales ──');
for (const r of phases) console.log(`  ${r.label.padEnd(50)} ${r.duree.toFixed(3).padStart(10)} ms`);
if (undos.length > 0) {
    const t = undos.map(r => r.duree);
    console.log(`\n── UNDO (${undos.length}) ── Min: ${Math.min(...t).toFixed(3)}ms  Max: ${Math.max(...t).toFixed(3)}ms  Moy: ${(t.reduce((a,b)=>a+b,0)/t.length).toFixed(3)}ms  Total: ${t.reduce((a,b)=>a+b,0).toFixed(3)}ms`);
}
if (redos.length > 0) {
    const t = redos.map(r => r.duree);
    console.log(`── REDO (${redos.length}) ── Min: ${Math.min(...t).toFixed(3)}ms  Max: ${Math.max(...t).toFixed(3)}ms  Moy: ${(t.reduce((a,b)=>a+b,0)/t.length).toFixed(3)}ms  Total: ${t.reduce((a,b)=>a+b,0).toFixed(3)}ms`);
}
console.log('\n════════════════════════════════════════════════════');
console.log('  FIN DU BENCHMARK');
console.log('════════════════════════════════════════════════════');
