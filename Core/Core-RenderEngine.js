/* ═══════════════════════════════════════════════════════════════════════════
   CORE-RENDERENGINE.JS — Moteur de rendu Pixi.js

   Gère le rendu GPU (WebGL) via Pixi.js v8.

   ══════════════════════════════════════════════════════════════════════════
   ARCHITECTURE — UN SEUL contexte WebGL par zone

   Chaque zone possède UN seul PIXI.Application (= un seul contexte WebGL).
   Les navigateurs limitent les contextes WebGL actifs à ~16 simultanés.
   Avec cette architecture, même 100 canevas dans une zone = 1 seul contexte.

   Chaque canevas VOH est un PIXI.Container positionné dans le stage
   de la zone, avec un masque rectangulaire pour le clipping:

   Zone (1 PIXI.Application, 1 <canvas> WebGL)
     └─ stage (sortableChildren = true pour le z-order des canevas)
          ├─ canvasRootContainer_1 (position x,y + masque w×h)
          │    ├─ backgroundRect     (PIXI.Graphics: fond coloré)
          │    ├─ backgroundImageLayer
          │    ├─ gridLayer
          │    ├─ objectsLayer       (sortableChildren = true)
          │    └─ overlayLayer
          ├─ canvasRootContainer_2
          └─ canvasRootContainer_N

   Les divs CSS des canevas restent pour les événements souris
   (pointer-events), mais ne contiennent plus de <canvas> WebGL.

   ══════════════════════════════════════════════════════════════════════════
   MODE DE RENDU

   - Statique par défaut (ticker arrêté, 0 CPU/GPU quand rien ne bouge)
   - Rendu manuel via requestRender() quand une propriété change
   - Un seul render() par zone dessine TOUS les canevas d'un coup
   - Les requestRender sont coalescés par requestAnimationFrame

   Licence: Open Source (licence à définir)
   Auteur: David Dieppedalle (ShadowStorm)
   ═══════════════════════════════════════════════════════════════════════════ */

'use strict';


/* ═══════════════════════════════════════════════════════════════════════════
   CLASSE: CanvasRenderEngine
   ═══════════════════════════════════════════════════════════════════════════ */
class CanvasRenderEngine {

    /**
     * @param {CanvasManager} canvasManager — Référence vers le CanvasManager parent.
     */
    constructor(canvasManager) {
        this._canvasManager = canvasManager;
    }


    /* ══════════════════════════════════════════════════════════════
       HELPER — Récupérer le zoneData d'un canvasData
       ══════════════════════════════════════════════════════════════ */

    _getZoneData(canvasData) {
        const zoneManager = this._canvasManager._voh._zoneManager;
        if (!zoneManager) return null;
        return zoneManager._zones.get(canvasData.zoneId) || null;
    }


    /* ══════════════════════════════════════════════════════════════
       INITIALISATION — Pixi.js par ZONE (1 seul contexte WebGL)
       Appelé dans ZoneManager.createZone().
       ══════════════════════════════════════════════════════════════ */

    /**
     * Initialise le moteur de rendu Pixi.js pour une zone.
     * Crée UN seul <canvas> HTML WebGL qui couvre toute la zone.
     * ASYNCHRONE — Pixi.js v8 requiert une initialisation async.
     * @param {Object} zoneData — Les données de la zone.
     * @returns {Promise<void>}
     */
    async initZoneRenderer(zoneData) {

        if (typeof PIXI === 'undefined') {
            console.warn('[Render] Pixi.js non disponible.');
            return;
        }

        /* ── Dimensions du renderer ── */
        const rendererWidth  = zoneData.width  || zoneData.element.offsetWidth  || 1500;
        const rendererHeight = zoneData.height || zoneData.element.offsetHeight || 1000;

        /* ── Créer l'élément <canvas> HTML WebGL ── */
        const htmlCanvas = document.createElement('canvas');
        htmlCanvas.className = 'voh-pixi-zone-canvas';
        htmlCanvas.style.position       = 'absolute';
        htmlCanvas.style.top            = '0';
        htmlCanvas.style.left           = '0';
        htmlCanvas.style.width          = rendererWidth + 'px';
        htmlCanvas.style.height         = rendererHeight + 'px';
        htmlCanvas.style.pointerEvents  = 'none';

        /* Insérer en premier enfant du conteneur de canevas */
        const canvasContainer = zoneData.canvasContainer;
        canvasContainer.insertBefore(htmlCanvas, canvasContainer.firstChild);

        /* ── Créer l'Application Pixi.js ── */
        const pixiApp = new PIXI.Application();

        try {
            await pixiApp.init({
                canvas:          htmlCanvas,
                width:           rendererWidth,
                height:          rendererHeight,
                backgroundAlpha: 0,          /* Fond transparent — le fond de zone est en CSS */
                antialias:       true,
                resolution:      window.devicePixelRatio || 1,
                autoDensity:     true
            });
        } catch (error) {
            console.error('[Render] Erreur init Pixi.js zone:', error);
            canvasContainer.removeChild(htmlCanvas);
            return;
        }

        /* ── Arrêter le ticker (mode statique) ── */
        pixiApp.ticker.stop();

        /* ── Activer le tri par zIndex sur le stage (z-order des canevas) ── */
        pixiApp.stage.sortableChildren = true;

        /* ── Stocker les références ── */
        zoneData.pixiApp        = pixiApp;
        zoneData.pixiHtmlCanvas = htmlCanvas;

        pixiApp.render();

        console.log('[Render] Pixi.js initialisé — Zone: ' + zoneData.id + ' (' + rendererWidth + '×' + rendererHeight + ')');
    }


    /* ══════════════════════════════════════════════════════════════
       INITIALISATION — Containers Pixi par CANEVAS
       Appelé dans CanvasManager.createCanvas().
       Crée un groupe de PIXI.Container dans le stage de la zone.
       ══════════════════════════════════════════════════════════════ */

    /**
     * Initialise les containers Pixi.js pour un canevas.
     * @param {Object} canvasData — Les données du canevas VOH.
     * @returns {Promise<void>}
     */
    async initRenderer(canvasData) {

        const zoneData = this._getZoneData(canvasData);
        if (!zoneData) return;

        /* Attendre que le pixiApp de la zone soit prêt */
        if (zoneData._rendererInitPromise) {
            await zoneData._rendererInitPromise;
        }

        const pixiApp = zoneData.pixiApp;
        if (!pixiApp) return;

        /* ── rootContainer positionné dans le stage ── */
        const rootContainer = new PIXI.Container();
        rootContainer.label = 'canvas_' + canvasData.id;
        rootContainer.position.set(canvasData.x, canvasData.y);
        rootContainer.zIndex = canvasData.zOrder;

        /* ── Masque rectangulaire pour le clipping ── */
        const mask = new PIXI.Graphics();
        mask.rect(0, 0, canvasData.width, canvasData.height);
        mask.fill({ color: 0xffffff });
        rootContainer.addChild(mask);
        rootContainer.mask = mask;

        /* ── Couche 1: fond coloré ── */
        const backgroundRect = new PIXI.Graphics();
        backgroundRect.label = 'backgroundRect';
        rootContainer.addChild(backgroundRect);

        /* ── Couche 2: image de fond (futur) ── */
        const backgroundImageLayer = new PIXI.Container();
        backgroundImageLayer.label = 'backgroundImageLayer';
        rootContainer.addChild(backgroundImageLayer);

        /* ── Couche 3: grille ── */
        const gridLayer = new PIXI.Container();
        gridLayer.label = 'gridLayer';
        rootContainer.addChild(gridLayer);

        /* ── Couche 4: objets (tri par zIndex) ── */
        const objectsLayer = new PIXI.Container();
        objectsLayer.label = 'objectsLayer';
        objectsLayer.sortableChildren = true;
        rootContainer.addChild(objectsLayer);

        /* ── Couche 5: overlay ── */
        const overlayLayer = new PIXI.Container();
        overlayLayer.label = 'overlayLayer';
        rootContainer.addChild(overlayLayer);

        /* ── Ajouter au stage de la zone ── */
        pixiApp.stage.addChild(rootContainer);

        /* ── Stocker les références ── */
        canvasData.pixiReady               = true;
        canvasData.pixiRootContainer       = rootContainer;
        canvasData.pixiMask                = mask;
        canvasData.pixiBackgroundRect      = backgroundRect;
        canvasData.pixiBackgroundImageLayer = backgroundImageLayer;
        canvasData.pixiGridLayer           = gridLayer;
        canvasData.pixiObjectsLayer        = objectsLayer;
        canvasData.pixiOverlayLayer        = overlayLayer;

        /* ── Fond CSS transparent (c'est Pixi qui gère le fond maintenant) ── */
        canvasData.element.style.backgroundColor = 'transparent';

        /* ── Premier rendu des propriétés visuelles ── */
        this.renderAllPageVisuals(canvasData);

        /* ── Rattacher les objets créés avant l'init ── */
        const objectManager = this._canvasManager._voh ? this._canvasManager._voh._objectManager : null;
        if (objectManager) {
            for (const objectData of objectManager._objects.values()) {
                if (objectData.canvasId === canvasData.id && objectData.pixiContainer) {
                    if (!objectData.pixiContainer.parent) {
                        objectsLayer.addChild(objectData.pixiContainer);
                        if (objectData.pageId !== canvasData.activePageId) {
                            objectData.pixiContainer.visible = false;
                        }
                    }
                }
            }
            this.forceRender(canvasData);
        }

        console.log('[Render] Containers Pixi.js créés — Canvas: ' + canvasData.id + ' (' + canvasData.width + '×' + canvasData.height + ')');
    }


    /* ══════════════════════════════════════════════════════════════
       RENDU — Fond de la page active
       ══════════════════════════════════════════════════════════════ */

    renderPageBackground(canvasData) {

        if (!canvasData.pixiReady || !canvasData.pixiBackgroundRect) return;

        let backgroundColor = 'rgba(255, 255, 255, 1.0)';
        if (canvasData.activePageId !== null && canvasData.pages) {
            const pageData = canvasData.pages.get(canvasData.activePageId);
            if (pageData) backgroundColor = pageData.backgroundColor;
        }

        try {
            const rect = canvasData.pixiBackgroundRect;
            rect.clear();
            rect.rect(0, 0, canvasData.width, canvasData.height);
            rect.fill({ color: new PIXI.Color(backgroundColor) });
        } catch (error) {
            console.warn('[Render] Erreur couleur de fond:', error);
        }
    }


    /* ══════════════════════════════════════════════════════════════
       RENDU — Grille de la page active
       ══════════════════════════════════════════════════════════════ */

    renderPageGrid(canvasData) {

        if (!canvasData.pixiReady || !canvasData.pixiGridLayer) return;

        canvasData.pixiGridLayer.removeChildren();

        if (canvasData.activePageId === null || !canvasData.pages) return;
        const pageData = canvasData.pages.get(canvasData.activePageId);
        if (!pageData || !pageData.gridIsVisible) return;

        const cellWidth   = pageData.gridCellWidth;
        const cellHeight  = pageData.gridCellHeight;
        const gridWidth   = canvasData.width;
        const gridHeight  = canvasData.height;
        const gridColor   = pageData.gridColor;
        const gridOpacity = pageData.gridOpacity;
        const gridThickness = pageData.gridThickness;
        const gridStyle   = pageData.gridStyle;

        if (cellWidth < 2 || cellHeight < 2) return;

        let pixiColor;
        try { pixiColor = new PIXI.Color(gridColor); }
        catch (e) { pixiColor = new PIXI.Color('rgba(0, 0, 0, 0.1)'); }

        if (gridStyle === 'dots') {
            const dots = new PIXI.Graphics();
            const dotRadius = Math.max(1, gridThickness * 0.6);
            for (let x = cellWidth; x < gridWidth; x += cellWidth) {
                for (let y = cellHeight; y < gridHeight; y += cellHeight) {
                    dots.circle(x, y, dotRadius);
                }
            }
            dots.fill({ color: pixiColor, alpha: gridOpacity });
            canvasData.pixiGridLayer.addChild(dots);
            return;
        }

        const lines = new PIXI.Graphics();
        for (let x = cellWidth; x < gridWidth; x += cellWidth) {
            this._drawGridLine(lines, x, 0, x, gridHeight, gridThickness, pixiColor, gridOpacity, gridStyle);
        }
        for (let y = cellHeight; y < gridHeight; y += cellHeight) {
            this._drawGridLine(lines, 0, y, gridWidth, y, gridThickness, pixiColor, gridOpacity, gridStyle);
        }
        canvasData.pixiGridLayer.addChild(lines);
    }

    _drawGridLine(graphics, x1, y1, x2, y2, thickness, color, alpha, style) {

        if (style === 'solid') {
            graphics.moveTo(x1, y1);
            graphics.lineTo(x2, y2);
            graphics.stroke({ width: thickness, color: color, alpha: alpha });
            return;
        }

        const dx = x2 - x1;
        const dy = y2 - y1;
        const length = Math.sqrt(dx * dx + dy * dy);
        if (length === 0) return;

        const ux = dx / length;
        const uy = dy / length;

        let dashLength, gapLength;
        if (style === 'dashed') { dashLength = 6; gapLength = 4; }
        else { dashLength = 1; gapLength = 3; }

        let distance = 0;
        while (distance < length) {
            const segStart = distance;
            const segEnd   = Math.min(distance + dashLength, length);
            graphics.moveTo(x1 + ux * segStart, y1 + uy * segStart);
            graphics.lineTo(x1 + ux * segEnd,   y1 + uy * segEnd);
            distance = segEnd + gapLength;
        }
        graphics.stroke({ width: thickness, color: color, alpha: alpha });
    }


    /* ══════════════════════════════════════════════════════════════
       RENDU — Bordure de la page active (div CSS enfant)
       ══════════════════════════════════════════════════════════════ */

    renderPageBorder(canvasData) {

        if (!canvasData.element) return;
        if (canvasData.activePageId === null || !canvasData.pages) return;

        const pageData = canvasData.pages.get(canvasData.activePageId);
        if (!pageData) return;

        canvasData.element.style.borderRadius = pageData.borderIsVisible && pageData.borderCornerRadius > 0
            ? pageData.borderCornerRadius + 'px' : '0';

        if (!canvasData._borderOverlay) {
            const overlay = document.createElement('div');
            overlay.className = 'voh-border-overlay';
            overlay.style.position       = 'absolute';
            overlay.style.top            = '0';
            overlay.style.left           = '0';
            overlay.style.width          = '100%';
            overlay.style.height         = '100%';
            overlay.style.pointerEvents  = 'none';
            overlay.style.boxSizing      = 'border-box';
            overlay.style.zIndex         = '999999';
            canvasData.element.appendChild(overlay);
            canvasData._borderOverlay = overlay;
        }

        const overlay   = canvasData._borderOverlay;
        const thickness = pageData.borderThickness;

        if (pageData.borderIsVisible && thickness > 0) {
            overlay.style.borderColor  = pageData.borderColor;
            overlay.style.borderWidth  = thickness + 'px';
            overlay.style.borderStyle  = pageData.borderStyle;
            overlay.style.borderRadius = pageData.borderCornerRadius > 0
                ? pageData.borderCornerRadius + 'px' : '0';
            overlay.style.display = 'block';
        } else {
            overlay.style.display = 'none';
        }
    }


    /* ══════════════════════════════════════════════════════════════
       RENDU — Dimensions de la page active (désactivé)
       ══════════════════════════════════════════════════════════════ */

    renderPageDimensions(canvasData) {
        /* DÉSACTIVÉ — scroll par page à implémenter plus tard. */
    }


    /* ══════════════════════════════════════════════════════════════
       RENDU — Toutes les propriétés visuelles d'un coup
       ══════════════════════════════════════════════════════════════ */

    renderAllPageVisuals(canvasData) {
        this.renderPageBackground(canvasData);
        this.renderPageBorder(canvasData);
        this.renderPageGrid(canvasData);
        this.forceRender(canvasData);
    }


    /* ══════════════════════════════════════════════════════════════
       RENDU — Demande de rendu manuel
       Rend la zone entière (tous les canevas d'un coup).
       ══════════════════════════════════════════════════════════════ */

    _updateRenderStats(zoneData, elapsed) {
        zoneData._renderLastTime  = elapsed;
        zoneData._renderCount     = (zoneData._renderCount || 0) + 1;
        zoneData._renderTotalTime = (zoneData._renderTotalTime || 0) + elapsed;
        if (elapsed > (zoneData._renderMaxTime || 0)) zoneData._renderMaxTime = elapsed;
        if (zoneData._renderMinTime === undefined || elapsed < zoneData._renderMinTime) zoneData._renderMinTime = elapsed;
    }

    requestRender(canvasData) {

        const zoneData = this._getZoneData(canvasData);
        if (!zoneData || !zoneData.pixiApp) return;

        if (zoneData._renderPending) return;

        zoneData._renderPending = true;
        const self = this;
        requestAnimationFrame(() => {
            zoneData._renderPending = false;
            if (zoneData.pixiApp) {
                try {
                    const start = performance.now();
                    zoneData.pixiApp.render();
                    self._updateRenderStats(zoneData, performance.now() - start);
                } catch (error) {
                    console.warn('[Render] Erreur de rendu:', error);
                }
            }
        });
    }

    forceRender(canvasData) {

        const zoneData = this._getZoneData(canvasData);
        if (!zoneData || !zoneData.pixiApp) return;

        zoneData._renderPending = false;

        try {
            const start = performance.now();
            zoneData.pixiApp.render();
            this._updateRenderStats(zoneData, performance.now() - start);
        } catch (error) {
            console.warn('[Render] Erreur de rendu:', error);
        }
    }

    waitForRender(canvasData) {

        const self = this;

        return new Promise((resolve) => {
            function waitForReady() {
                const zoneData = self._getZoneData(canvasData);
                if (!zoneData) { resolve(false); return; }

                if (zoneData.pixiApp && canvasData.pixiReady) {
                    self.forceRender(canvasData);
                    requestAnimationFrame(() => {
                        requestAnimationFrame(() => { resolve(true); });
                    });
                } else {
                    requestAnimationFrame(waitForReady);
                }
            }
            waitForReady();
        });
    }


    /* ══════════════════════════════════════════════════════════════
       STATISTIQUES DE RENDU (par zone)
       ══════════════════════════════════════════════════════════════ */

    getRenderStats(canvasData) {
        const zoneData = this._getZoneData(canvasData);
        if (!zoneData) return { lastTime: 0, minTime: 0, maxTime: 0, averageTime: 0, count: 0, totalTime: 0 };
        const count = zoneData._renderCount || 0;
        return {
            lastTime:    zoneData._renderLastTime  || 0,
            minTime:     zoneData._renderMinTime   || 0,
            maxTime:     zoneData._renderMaxTime   || 0,
            averageTime: count > 0 ? (zoneData._renderTotalTime || 0) / count : 0,
            count:       count,
            totalTime:   zoneData._renderTotalTime || 0
        };
    }

    getLastRenderTime(canvasData) {
        const zoneData = this._getZoneData(canvasData);
        return zoneData ? (zoneData._renderLastTime || 0) : 0;
    }

    resetRenderStats(canvasData) {
        const zoneData = this._getZoneData(canvasData);
        if (!zoneData) return;
        zoneData._renderLastTime  = 0;
        zoneData._renderMinTime   = undefined;
        zoneData._renderMaxTime   = 0;
        zoneData._renderCount     = 0;
        zoneData._renderTotalTime = 0;
    }


    /* ══════════════════════════════════════════════════════════════
       POSITIONNEMENT ET REDIMENSIONNEMENT
       ══════════════════════════════════════════════════════════════ */

    updateCanvasPosition(canvasData) {
        if (!canvasData.pixiRootContainer) return;
        canvasData.pixiRootContainer.position.set(canvasData.x, canvasData.y);
    }

    resizeRenderer(canvasData, width, height) {
        if (canvasData.pixiMask) {
            canvasData.pixiMask.clear();
            canvasData.pixiMask.rect(0, 0, width, height);
            canvasData.pixiMask.fill({ color: 0xffffff });
        }
        this.renderPageBackground(canvasData);
        this.forceRender(canvasData);
    }

    resizeZoneRenderer(zoneData, width, height) {
        if (!zoneData.pixiApp) return;
        try {
            zoneData.pixiApp.renderer.resize(width, height);
            if (zoneData.pixiHtmlCanvas) {
                zoneData.pixiHtmlCanvas.style.width  = width + 'px';
                zoneData.pixiHtmlCanvas.style.height = height + 'px';
            }
        } catch (error) {
            console.warn('[Render] Erreur resize zone:', error);
        }
    }

    updateCanvasVisibility(canvasData) {
        if (!canvasData.pixiRootContainer) return;
        canvasData.pixiRootContainer.visible = canvasData.isVisible;
    }

    updateCanvasOpacity(canvasData) {
        if (!canvasData.pixiRootContainer) return;
        canvasData.pixiRootContainer.alpha = canvasData.opacity;
    }

    updateCanvasZOrder(canvasData) {
        if (!canvasData.pixiRootContainer) return;
        canvasData.pixiRootContainer.zIndex = canvasData.zOrder;
    }


    /* ══════════════════════════════════════════════════════════════
       DESTRUCTION — Containers d'un canevas
       ══════════════════════════════════════════════════════════════ */

    destroyRenderer(canvasData) {

        if (canvasData.pixiRootContainer) {
            if (canvasData.pixiRootContainer.parent) {
                canvasData.pixiRootContainer.parent.removeChild(canvasData.pixiRootContainer);
            }
            try {
                canvasData.pixiRootContainer.destroy({ children: true });
            } catch (error) {
                console.warn('[Render] Erreur destruction containers:', error);
            }
        }

        if (canvasData._borderOverlay && canvasData._borderOverlay.parentNode) {
            canvasData._borderOverlay.parentNode.removeChild(canvasData._borderOverlay);
        }
        canvasData._borderOverlay          = null;
        canvasData.pixiReady               = false;
        canvasData.pixiRootContainer       = null;
        canvasData.pixiMask                = null;
        canvasData.pixiBackgroundRect      = null;
        canvasData.pixiBackgroundImageLayer = null;
        canvasData.pixiGridLayer           = null;
        canvasData.pixiObjectsLayer        = null;
        canvasData.pixiOverlayLayer        = null;

        console.log('[Render] Containers détruits — Canvas: ' + canvasData.id);
    }


    /* ══════════════════════════════════════════════════════════════
       DESTRUCTION — Renderer de la zone entière
       ══════════════════════════════════════════════════════════════ */

    destroyZoneRenderer(zoneData) {

        if (!zoneData.pixiApp) return;

        try {
            zoneData.pixiApp.destroy(true, { children: true, texture: true });
        } catch (error) {
            console.warn('[Render] Erreur destruction zone renderer:', error);
        }

        if (zoneData.pixiHtmlCanvas && zoneData.pixiHtmlCanvas.parentNode) {
            zoneData.pixiHtmlCanvas.parentNode.removeChild(zoneData.pixiHtmlCanvas);
        }

        zoneData.pixiApp        = null;
        zoneData.pixiHtmlCanvas = null;

        console.log('[Render] Pixi.js détruit — Zone: ' + zoneData.id);
    }
}


/* ═══════════════════════════════════════════════════════════════════════════
   EXPOSITION GLOBALE
   ═══════════════════════════════════════════════════════════════════════════ */
window.CanvasRenderEngine = CanvasRenderEngine;
