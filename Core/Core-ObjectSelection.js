/* ═══════════════════════════════════════════════════════════════════════════
   CORE-OBJECTSELECTION.JS — Gestionnaire de sélection d'objets

   Gère l'état de sélection des objets par canevas et le rendu visuel
   du contour de sélection (PIXI.Graphics dans le pixiContainer de l'objet).

   Le contour est dessiné DANS le container de l'objet (pas dans l'overlay),
   ce qui garantit que le z-order du contour suit celui de l'objet.
   Le contour suit automatiquement la position de l'objet sans hook
   supplémentaire (le container gère le positionnement).

   Apparence configurable par objet: couleur, épaisseur, style, marge.

   La sélection est par canevas (pas par page). Elle est vidée
   automatiquement au changement de page active.

   ══════════════════════════════════════════════════════════════════════════
   ÉVÉNEMENTS ÉMIS
   ══════════════════════════════════════════════════════════════════════════

   - selection:changed — { canvasId, selectedIds, addedIds, removedIds }
   - selection:cleared — { canvasId, previousIds }

   Licence: Open Source (licence à définir)
   Auteur: David Dieppedalle (ShadowStorm)
   ═══════════════════════════════════════════════════════════════════════════ */

'use strict';


/* ═══════════════════════════════════════════════════════════════════════════
   CLASSE: ObjectSelectionManager
   ═══════════════════════════════════════════════════════════════════════════ */
class ObjectSelectionManager {

    constructor(vohInstance) {
        this._voh = vohInstance;
        /** @type {Map<number, Set<number>>} canvasId → Set<objectId> */
        this._selectedObjects = new Map();
    }


    /* ══════════════════════════════════════════════════════════════
       RACCOURCIS INTERNES
       ══════════════════════════════════════════════════════════════ */

    _emit(eventName, data) {
        const eventEmitter = this._voh.getEventEmitter();
        if (eventEmitter) eventEmitter.emit(eventName, data);
    }

    _getObjectManager() { return this._voh._objectManager; }
    _getCanvasManager() { return this._voh._canvasManager; }

    _getOrCreateSet(canvasId) {
        let set = this._selectedObjects.get(canvasId);
        if (!set) { set = new Set(); this._selectedObjects.set(canvasId, set); }
        return set;
    }

    _getSet(canvasId) {
        return this._selectedObjects.get(canvasId) || null;
    }


    /* ══════════════════════════════════════════════════════════════
       VALIDATION
       ══════════════════════════════════════════════════════════════ */

    _validateObjectForSelection(canvasId, objectId, methodName) {
        const objectManager = this._getObjectManager();
        if (!objectManager) return null;

        const objectData = objectManager._objects.get(objectId);
        if (!objectData) { console.warn(`[ObjectSelection] ${methodName}: objet ${objectId} inexistant.`); return null; }
        if (objectData.canvasId !== canvasId) { console.warn(`[ObjectSelection] ${methodName}: objet ${objectId} n'appartient pas au canevas ${canvasId}.`); return null; }
        if (!objectData.isVisible) { console.warn(`[ObjectSelection] ${methodName}: objet ${objectId} est invisible.`); return null; }

        const canvasManager = this._getCanvasManager();
        if (canvasManager) {
            const canvasData = canvasManager._canvases.get(canvasId);
            if (canvasData && objectData.pageId !== canvasData.activePageId) {
                console.warn(`[ObjectSelection] ${methodName}: objet ${objectId} n'est pas sur la page active.`);
                return null;
            }
        }
        return objectData;
    }


    /* ══════════════════════════════════════════════════════════════
       RENDU VISUEL — Contour dans le pixiContainer de l'objet

       Le Graphics est ajouté comme enfant du pixiContainer de
       l'objet, positionné en coordonnées locales (relatives au
       coin haut-gauche de l'objet). La marge (offset) décale le
       contour vers l'extérieur avec des coordonnées négatives.

       Avantage: le contour suit la position ET le z-order de
       l'objet automatiquement.
       ══════════════════════════════════════════════════════════════ */

    /**
     * Crée ou met à jour le contour de sélection Pixi.js d'un objet.
     * Le Graphics est enfant du pixiContainer de l'objet (coordonnées locales).
     * @param {Object} objectData — Les données de l'objet.
     * @private
     */
    _createOrUpdateOutline(objectData) {

        if (!objectData.pixiContainer) return;

        /* ── Paramètres du contour ── */
        /* Note: ne PAS utiliser || car 0 est une valeur valide pour offset et thickness */
        const offset    = objectData.selectionBorderOffset    !== undefined ? objectData.selectionBorderOffset    : 0;
        const thickness = objectData.selectionBorderThickness !== undefined ? objectData.selectionBorderThickness : 1;
        const colorStr  = objectData.selectionBorderColor     || 'rgba(0, 120, 215, 0.9)';
        const style     = objectData.selectionBorderStyle     || 'solid';
        const parsed    = this._parseCssColor(colorStr);

        /* ── Rectangle en coordonnées locales (relatives au container de l'objet) ──
           Le stroke Pixi est dessiné CENTRÉ sur le tracé. Pour que le bord intérieur
           du stroke soit exactement à (offset) pixels de l'objet, on décale le tracé
           de (offset + thickness/2) vers l'extérieur.
           Résultat: la bordure est toujours entièrement À L'EXTÉRIEUR de l'objet.
           offset=0, thickness=1 → le bord intérieur du stroke touche l'objet. */
        const halfThick = thickness / 2;
        const rx = -(offset + halfThick);
        const ry = -(offset + halfThick);
        const rw = objectData.width  + (offset + halfThick) * 2;
        const rh = objectData.height + (offset + halfThick) * 2;

        let graphics = objectData._selectionGraphics;

        if (!graphics) {
            graphics = new PIXI.Graphics();
            graphics.label = 'selection_outline_' + objectData.id;
            objectData._selectionGraphics = graphics;
            objectData.pixiContainer.addChild(graphics);
        }

        /* ── Dessiner le contour ── */
        graphics.clear();

        if (style === 'solid') {
            /* ── Trait continu ── */
            graphics.rect(rx, ry, rw, rh);
            graphics.stroke({ width: thickness, color: parsed.color, alpha: parsed.alpha });

        } else if (style === 'dashed') {
            /* ── Tirets (segments de 8px avec espaces de 5px) ── */
            this._drawDashedRect(graphics, rx, ry, rw, rh, thickness, parsed.color, parsed.alpha, 8, 5);

        } else if (style === 'dotted') {
            /* ── Pointillés (segments de 2px avec espaces de 4px) ── */
            this._drawDashedRect(graphics, rx, ry, rw, rh, thickness, parsed.color, parsed.alpha, 2, 4);
        }

        /* ── Déclencher le rendu Pixi ── */
        this._requestRender(objectData);
    }

    /**
     * Dessine un rectangle en tirets ou pointillés via PIXI.Graphics.
     * @param {PIXI.Graphics} graphics — Le Graphics cible.
     * @param {number} x — Position X du rectangle.
     * @param {number} y — Position Y du rectangle.
     * @param {number} w — Largeur.
     * @param {number} h — Hauteur.
     * @param {number} thickness — Épaisseur du trait.
     * @param {number} color — Couleur hex (0xRRGGBB).
     * @param {number} alpha — Opacité (0-1).
     * @param {number} dashLength — Longueur de chaque tiret/point.
     * @param {number} gapLength — Longueur de chaque espace.
     * @private
     */
    _drawDashedRect(graphics, x, y, w, h, thickness, color, alpha, dashLength, gapLength) {

        const segments = [
            { x1: x,     y1: y,     x2: x + w, y2: y     }, /* haut    */
            { x1: x + w, y1: y,     x2: x + w, y2: y + h }, /* droite  */
            { x1: x + w, y1: y + h, x2: x,     y2: y + h }, /* bas     */
            { x1: x,     y1: y + h, x2: x,     y2: y     }  /* gauche  */
        ];

        for (let i = 0; i < segments.length; i++) {
            const seg = segments[i];
            const dx = seg.x2 - seg.x1;
            const dy = seg.y2 - seg.y1;
            const length = Math.sqrt(dx * dx + dy * dy);
            const ux = dx / length;
            const uy = dy / length;

            let pos = 0;
            let drawing = true;

            while (pos < length) {
                const segLen = drawing ? dashLength : gapLength;
                const end = Math.min(pos + segLen, length);

                if (drawing) {
                    const sx = seg.x1 + ux * pos;
                    const sy = seg.y1 + uy * pos;
                    const ex = seg.x1 + ux * end;
                    const ey = seg.y1 + uy * end;

                    graphics.moveTo(sx, sy);
                    graphics.lineTo(ex, ey);
                    graphics.stroke({ width: thickness, color: color, alpha: alpha });
                }

                pos = end;
                drawing = !drawing;
            }
        }
    }

    /**
     * Supprime le contour de sélection Pixi.js d'un objet.
     * @param {Object} objectData — Les données de l'objet.
     * @private
     */
    _removeOutline(objectData) {
        const graphics = objectData._selectionGraphics;
        if (!graphics) return;

        if (graphics.parent) {
            graphics.parent.removeChild(graphics);
        }
        graphics.destroy();
        objectData._selectionGraphics = null;

        this._requestRender(objectData);
    }

    /**
     * Met à jour le contour de sélection d'un objet.
     * Appelé par ObjectManager quand taille ou propriétés de sélection changent.
     * Note: pas besoin pour x/y car le contour est dans le pixiContainer.
     * @param {Object} objectData — Les données de l'objet.
     */
    updateSelectionOutline(objectData) {
        if (objectData._selectionGraphics) {
            this._createOrUpdateOutline(objectData);
        }
    }

    /**
     * Déclenche le rendu Pixi pour l'objet.
     * @param {Object} objectData — Les données de l'objet.
     * @private
     */
    _requestRender(objectData) {
        const canvasManager = this._getCanvasManager();
        if (!canvasManager) return;
        const canvasData = canvasManager._canvases.get(objectData.canvasId);
        if (canvasData) {
            const renderEngine = canvasManager._renderEngine;
            if (renderEngine) renderEngine.requestRender(canvasData);
        }
    }

    /**
     * Parse une couleur CSS → {color, alpha} pour Pixi.
     * @param {string} colorStr — Couleur CSS.
     * @returns {{ color: number, alpha: number }}
     * @private
     */
    _parseCssColor(colorStr) {
        const rgbaMatch = colorStr.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)/);
        if (rgbaMatch) {
            const r = parseInt(rgbaMatch[1]);
            const g = parseInt(rgbaMatch[2]);
            const b = parseInt(rgbaMatch[3]);
            const a = rgbaMatch[4] !== undefined ? parseFloat(rgbaMatch[4]) : 1.0;
            return { color: (r << 16) | (g << 8) | b, alpha: a };
        }
        const hexMatch = colorStr.match(/^#([0-9a-f]{3,8})$/i);
        if (hexMatch) {
            let hex = hexMatch[1];
            if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
            return { color: parseInt(hex.substring(0, 6), 16), alpha: 1.0 };
        }
        return { color: 0x0078d7, alpha: 0.9 };
    }


    /* ══════════════════════════════════════════════════════════════
       SÉLECTION — Méthodes publiques
       ══════════════════════════════════════════════════════════════ */

    select(canvasId, objectId) {
        const objectData = this._validateObjectForSelection(canvasId, objectId, 'select');
        if (!objectData) return false;
        const set = this._getOrCreateSet(canvasId);
        if (set.has(objectId)) return false;
        set.add(objectId);
        this._createOrUpdateOutline(objectData);
        this._emit('selection:changed', { canvasId: canvasId, selectedIds: Array.from(set), addedIds: [objectId], removedIds: [] });
        return true;
    }

    deselect(canvasId, objectId) {
        const set = this._getSet(canvasId);
        if (!set || !set.has(objectId)) return false;
        set.delete(objectId);
        const objectManager = this._getObjectManager();
        if (objectManager) {
            const objectData = objectManager._objects.get(objectId);
            if (objectData) this._removeOutline(objectData);
        }
        this._emit('selection:changed', { canvasId: canvasId, selectedIds: Array.from(set), addedIds: [], removedIds: [objectId] });
        return true;
    }

    toggle(canvasId, objectId) {
        const set = this._getSet(canvasId);
        return (set && set.has(objectId)) ? this.deselect(canvasId, objectId) : this.select(canvasId, objectId);
    }

    selectAll(canvasId) {
        const canvasManager = this._getCanvasManager();
        if (!canvasManager) return false;
        const canvasData = canvasManager._canvases.get(canvasId);
        if (!canvasData) return false;
        const objectManager = this._getObjectManager();
        if (!objectManager) return false;

        const activePageId = canvasData.activePageId;
        const set = this._getOrCreateSet(canvasId);
        const addedIds = [];

        for (const objectData of objectManager._objects.values()) {
            if (objectData.canvasId !== canvasId) continue;
            if (objectData.pageId !== activePageId) continue;
            if (!objectData.isVisible) continue;
            if (!set.has(objectData.id)) {
                set.add(objectData.id);
                addedIds.push(objectData.id);
                this._createOrUpdateOutline(objectData);
            }
        }

        if (addedIds.length === 0) return false;
        this._emit('selection:changed', { canvasId: canvasId, selectedIds: Array.from(set), addedIds: addedIds, removedIds: [] });
        return true;
    }

    deselectAll(canvasId) {
        const set = this._getSet(canvasId);
        if (!set || set.size === 0) return false;

        const previousIds = Array.from(set);
        const objectManager = this._getObjectManager();
        if (objectManager) {
            for (const objectId of previousIds) {
                const objectData = objectManager._objects.get(objectId);
                if (objectData) this._removeOutline(objectData);
            }
        }
        set.clear();

        this._emit('selection:changed', { canvasId: canvasId, selectedIds: [], addedIds: [], removedIds: previousIds });
        this._emit('selection:cleared', { canvasId: canvasId, previousIds: previousIds });
        return true;
    }

    selectOnly(canvasId, objectId) {
        const objectData = this._validateObjectForSelection(canvasId, objectId, 'selectOnly');
        if (!objectData) return false;
        const set = this._getOrCreateSet(canvasId);
        if (set.size === 1 && set.has(objectId)) return false;

        const removedIds = [];
        const objectManager = this._getObjectManager();
        for (const selectedId of set) {
            if (selectedId !== objectId) {
                removedIds.push(selectedId);
                if (objectManager) {
                    const otherData = objectManager._objects.get(selectedId);
                    if (otherData) this._removeOutline(otherData);
                }
            }
        }

        const wasAlreadySelected = set.has(objectId);
        set.clear();
        set.add(objectId);
        this._createOrUpdateOutline(objectData);

        this._emit('selection:changed', { canvasId: canvasId, selectedIds: [objectId], addedIds: wasAlreadySelected ? [] : [objectId], removedIds: removedIds });
        return true;
    }


    /* ══════════════════════════════════════════════════════════════
       INTERROGATION
       ══════════════════════════════════════════════════════════════ */

    getSelectedIds(canvasId)              { const s = this._getSet(canvasId); return s ? Array.from(s) : []; }
    getSelectedCount(canvasId)            { const s = this._getSet(canvasId); return s ? s.size : 0; }
    isSelected(canvasId, objectId)        { const s = this._getSet(canvasId); return s ? s.has(objectId) : false; }

    isSelectedById(objectId) {
        const objectManager = this._getObjectManager();
        if (!objectManager) return false;
        const objectData = objectManager._objects.get(objectId);
        if (!objectData) return false;
        return this.isSelected(objectData.canvasId, objectId);
    }


    /* ══════════════════════════════════════════════════════════════
       NETTOYAGE
       ══════════════════════════════════════════════════════════════ */

    removeObjectFromSelection(canvasId, objectId) {
        const set = this._getSet(canvasId);
        if (set) set.delete(objectId);
        const objectManager = this._getObjectManager();
        if (objectManager) {
            const objectData = objectManager._objects.get(objectId);
            if (objectData) this._removeOutline(objectData);
        }
    }

    clearSelectionOnPageChange(canvasId) { this.deselectAll(canvasId); }

    deselectOnVisibilityChange(canvasId, objectId) {
        const set = this._getSet(canvasId);
        if (!set || !set.has(objectId)) return;
        this.deselect(canvasId, objectId);
    }

    destroyCanvasSelection(canvasId) {
        const set = this._getSet(canvasId);
        if (set) {
            const objectManager = this._getObjectManager();
            if (objectManager) {
                for (const objectId of set) {
                    const objectData = objectManager._objects.get(objectId);
                    if (objectData) this._removeOutline(objectData);
                }
            }
        }
        this._selectedObjects.delete(canvasId);
    }

    destroy() {
        this._selectedObjects.clear();
        this._voh = null;
        console.log('[ObjectSelection] Détruit.');
    }
}


window.ObjectSelectionManager = ObjectSelectionManager;
