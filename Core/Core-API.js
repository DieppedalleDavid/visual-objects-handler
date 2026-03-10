/* ═══════════════════════════════════════════════════════════════════════════
   CORE-API.JS — API façade du moteur Visual Objects Handler

   Ce fichier construit les sous-objets de l'API publique (voh.zone,
   voh.canvas, voh.objects, etc.) à partir d'une instance VOH.

   Appelé par Core-Main.js dans la méthode init() de VisualObjectsHandler.

   Licence: Open Source (licence à définir)
   Auteur: David Dieppedalle (ShadowStorm)
   ═══════════════════════════════════════════════════════════════════════════ */

'use strict';


/* ═══════════════════════════════════════════════════════════════════════════
   MONTAGE DE L'API COMPLÈTE
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Monte l'API publique complète sur une instance VOH.
 * Appelé une seule fois dans init() de VisualObjectsHandler.
 * @param {VisualObjectsHandler} vohInstance — L'instance à enrichir.
 */
function _buildApi(vohInstance) {

    /* ── API Zone ── */
    vohInstance.zone = _buildZoneApi(vohInstance);

    /* ── Événements globaux (délégués à l'EventEmitter) ── */
    const eventEmitter = vohInstance.getEventEmitter();
    vohInstance.on   = (eventName, callback) => { eventEmitter.on(eventName, callback);   return vohInstance; };
    vohInstance.off  = (eventName, callback) => { eventEmitter.off(eventName, callback);  return vohInstance; };
    vohInstance.once = (eventName, callback) => { eventEmitter.once(eventName, callback); return vohInstance; };
    vohInstance.removeAllListeners = (eventName) => { eventEmitter.removeAllListeners(eventName); return vohInstance; };
    vohInstance.getListenerCount   = (eventName) => eventEmitter.getListenerCount(eventName);
    vohInstance.getEventNames      = ()          => eventEmitter.getEventNames();

    /* ── API Canvas ── */
    vohInstance.canvas = _buildCanvasApi(vohInstance);

    /* ── API Objects ── */
    vohInstance.objects = _buildObjectsApi(vohInstance);

    /* ── APIs futures ── */
    // vohInstance.clipboard   = _buildClipboardApi(vohInstance);   // Presse-papiers (à implémenter)
    // vohInstance.connections = _buildConnectionsApi(vohInstance); // Liaisons entre objets (à implémenter)

    /* ── Envelopper toutes les méthodes API pour le journal de diagnostic ── */
    if (typeof _diagnosticsWrapApiMethod === 'function') {
        _diagnosticsWrapAllMethods(vohInstance.zone, 'voh.zone', vohInstance);
        _diagnosticsWrapAllMethods(vohInstance.canvas, 'voh.canvas', vohInstance);
        _diagnosticsWrapAllMethods(vohInstance.objects, 'voh.objects', vohInstance);

        /* ── Envelopper les méthodes d'abonnement aux événements ── */
        vohInstance.on   = _diagnosticsWrapApiMethod('voh.on',   vohInstance.on,   vohInstance);
        vohInstance.off  = _diagnosticsWrapApiMethod('voh.off',  vohInstance.off,  vohInstance);
        vohInstance.once = _diagnosticsWrapApiMethod('voh.once', vohInstance.once, vohInstance);
        vohInstance.removeAllListeners = _diagnosticsWrapApiMethod('voh.removeAllListeners', vohInstance.removeAllListeners, vohInstance);
        vohInstance.getListenerCount   = _diagnosticsWrapApiMethod('voh.getListenerCount',   vohInstance.getListenerCount,   vohInstance);
        vohInstance.getEventNames      = _diagnosticsWrapApiMethod('voh.getEventNames',      vohInstance.getEventNames,      vohInstance);
    }

    console.log('[VOH] API montée sur l\'instance.');
}


/* ═══════════════════════════════════════════════════════════════════════════
   API ZONE — voh.zone.*

   Mappe les méthodes publiques du ZoneManager vers l'API.
   Exemple: voh.zone.create({...}) → ZoneManager.createZone({...})
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Construit l'objet API zone.
 * @param {VisualObjectsHandler} vohInstance
 * @returns {Object} L'objet API zone.
 */
function _buildZoneApi(vohInstance) {

    const zoneManager = vohInstance._zoneManager;

    return {

        /* ── Création / Suppression ── */
        create:  (params)  => zoneManager.createZone(params),
        delete:  (zoneId, options)  => zoneManager.deleteZone(zoneId, options),

        /* ── Zone active ── */
        setActive:   (zoneId) => zoneManager.setActiveZone(zoneId),
        getActiveId: ()       => zoneManager.getActiveZoneId(),

        /* ── Informations ── */
        getCount:          ()       => zoneManager.getZoneCount(),
        getList:           ()       => zoneManager.getZoneList(),
        exists:            (zoneId) => zoneManager.zoneExists(zoneId),
        getCanvasContainer:(zoneId) => zoneManager.getZoneCanvasContainer(zoneId),

        /* ── Nom ── */
        setName: (zoneId, name) => zoneManager.setZoneName(zoneId, name),
        getName: (zoneId)       => zoneManager.getZoneName(zoneId),

        /* ── Dimensions ── */
        setWidth:  (zoneId, width)  => zoneManager.setZoneWidth(zoneId, width),
        getWidth:  (zoneId)         => zoneManager.getZoneWidth(zoneId),
        setHeight: (zoneId, height) => zoneManager.setZoneHeight(zoneId, height),
        getHeight: (zoneId)         => zoneManager.getZoneHeight(zoneId),

        /* ── Fond ── */
        setBackgroundColor:        (zoneId, color)   => zoneManager.setZoneBackgroundColor(zoneId, color),
        getBackgroundColor:        (zoneId)          => zoneManager.getZoneBackgroundColor(zoneId),
        setBackgroundImage:        (zoneId, image)   => zoneManager.setZoneBackgroundImage(zoneId, image),
        getBackgroundImage:        (zoneId)          => zoneManager.getZoneBackgroundImage(zoneId),
        setBackgroundImageOpacity: (zoneId, opacity) => zoneManager.setZoneBackgroundImageOpacity(zoneId, opacity),
        getBackgroundImageOpacity: (zoneId)          => zoneManager.getZoneBackgroundImageOpacity(zoneId),

        /* ── Grille ── */
        setGridWidth:   (zoneId, width)   => zoneManager.setZoneGridWidth(zoneId, width),
        getGridWidth:   (zoneId)          => zoneManager.getZoneGridWidth(zoneId),
        setGridHeight:  (zoneId, height)  => zoneManager.setZoneGridHeight(zoneId, height),
        getGridHeight:  (zoneId)          => zoneManager.getZoneGridHeight(zoneId),
        setGridColor:   (zoneId, color)   => zoneManager.setZoneGridColor(zoneId, color),
        getGridColor:   (zoneId)          => zoneManager.getZoneGridColor(zoneId),
        setGridOpacity: (zoneId, opacity) => zoneManager.setZoneGridOpacity(zoneId, opacity),
        getGridOpacity: (zoneId)          => zoneManager.getZoneGridOpacity(zoneId),
        setGridVisible: (zoneId, visible) => zoneManager.setZoneGridVisible(zoneId, visible),
        getGridVisible: (zoneId)          => zoneManager.getZoneGridVisible(zoneId),

        /* ── Viewport (scrollbars et position) ── */
        setScrollbarVisible: (zoneId, visible) => zoneManager.setZoneScrollbarVisible(zoneId, visible),
        getScrollbarVisible: (zoneId)          => zoneManager.getZoneScrollbarVisible(zoneId),
        setScrollX:          (zoneId, x)       => zoneManager.setZoneScrollX(zoneId, x),
        getScrollX:          (zoneId)          => zoneManager.getZoneScrollX(zoneId),
        setScrollY:          (zoneId, y)       => zoneManager.setZoneScrollY(zoneId, y),
        getScrollY:          (zoneId)          => zoneManager.getZoneScrollY(zoneId),
        scrollToCenter:      (zoneId)          => zoneManager.scrollZoneToCenter(zoneId),

        /* ── Zoom ── */
        setZoom:   (zoneId, level) => zoneManager.setZoneZoom(zoneId, level),
        getZoom:   (zoneId)        => zoneManager.getZoneZoom(zoneId),
        zoomIn:    (zoneId)        => zoneManager.zoneZoomIn(zoneId),
        zoomOut:   (zoneId)        => zoneManager.zoneZoomOut(zoneId),
        resetZoom: (zoneId)        => zoneManager.resetZoneZoom(zoneId),

        /* ── Bordure ── */
        setBorderColor: (zoneId, color) => zoneManager.setZoneBorderColor(zoneId, color),
        getBorderColor: (zoneId)        => zoneManager.getZoneBorderColor(zoneId),
        setBorderThickness: (zoneId, width) => zoneManager.setZoneBorderThickness(zoneId, width),
        getBorderThickness: (zoneId)        => zoneManager.getZoneBorderThickness(zoneId),

        /* ── Comportement ── */
        setBringCanvasToFrontOnActivation: (zoneId, enabled) => zoneManager.setZoneBringCanvasToFrontOnActivation(zoneId, enabled),
        getBringCanvasToFrontOnActivation: (zoneId)          => zoneManager.getZoneBringCanvasToFrontOnActivation(zoneId)
    };
}


/* ═══════════════════════════════════════════════════════════════════════════
   API CANVAS — voh.canvas.*

   Mappe les méthodes publiques du CanvasManager vers l'API.
   Exemple: voh.canvas.create(zoneId, {...}) → CanvasManager.createCanvas(zoneId, {...})
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Construit l'objet API canvas.
 * @param {VisualObjectsHandler} vohInstance
 * @returns {Object} L'objet API canvas.
 */
function _buildCanvasApi(vohInstance) {

    const canvasManager    = vohInstance._canvasManager;
    const selectionManager = canvasManager._selectionManager;
    const pageManager      = canvasManager._pageManager;
    const historyManager   = canvasManager._historyManager;

    return {

        /* ── Création / Suppression ── */
        create: (zoneId, params) => canvasManager.createCanvas(zoneId, params),
        delete: (canvasId)       => canvasManager.deleteCanvas(canvasId),

        /* ── Canvas actif ── */
        setActive:   (canvasId) => canvasManager.setActiveCanvas(canvasId),
        getActiveId: ()         => canvasManager.getActiveCanvasId(),

        /* ── Informations ── */
        getCount:  (zoneId)   => canvasManager.getCanvasCount(zoneId),
        getList:   (zoneId)   => canvasManager.getCanvasList(zoneId),
        exists:    (canvasId) => canvasManager.canvasExists(canvasId),
        getZoneId: (canvasId) => canvasManager.getCanvasZoneId(canvasId),

        /* ── Nom ── */
        setName: (canvasId, name) => canvasManager.setCanvasName(canvasId, name),
        getName: (canvasId)       => canvasManager.getCanvasName(canvasId),

        /* ── Position ── */
        setX: (canvasId, x) => canvasManager.setCanvasX(canvasId, x),
        getX: (canvasId)    => canvasManager.getCanvasX(canvasId),
        setY: (canvasId, y) => canvasManager.setCanvasY(canvasId, y),
        getY: (canvasId)    => canvasManager.getCanvasY(canvasId),

        /* ── Dimensions ── */
        setWidth:  (canvasId, width)  => canvasManager.setCanvasWidth(canvasId, width),
        getWidth:  (canvasId)         => canvasManager.getCanvasWidth(canvasId),
        setHeight: (canvasId, height) => canvasManager.setCanvasHeight(canvasId, height),
        getHeight: (canvasId)         => canvasManager.getCanvasHeight(canvasId),

        /* ── Couleur de fond ── */
        setBackgroundColor: (canvasId, color) => canvasManager.setCanvasBackgroundColor(canvasId, color),
        getBackgroundColor: (canvasId)        => canvasManager.getCanvasBackgroundColor(canvasId),

        /* ── Verrouillage ── */
        setLocked: (canvasId, isLocked) => canvasManager.setCanvasLocked(canvasId, isLocked),
        getLocked: (canvasId)           => canvasManager.getCanvasLocked(canvasId),
        isLocked:  (canvasId)           => canvasManager.getCanvasLocked(canvasId),

        /* ── Visibilité ── */
        setVisible: (canvasId, isVisible) => canvasManager.setCanvasVisible(canvasId, isVisible),
        getVisible: (canvasId)            => canvasManager.getCanvasVisible(canvasId),
        isVisible:  (canvasId)            => canvasManager.getCanvasVisible(canvasId),

        /* ── Opacité ── */
        setOpacity: (canvasId, opacity) => canvasManager.setCanvasOpacity(canvasId, opacity),
        getOpacity: (canvasId)          => canvasManager.getCanvasOpacity(canvasId),

        /* ── Z-order ── */
        bringToFront: (canvasId) => canvasManager.bringCanvasToFront(canvasId),
        sendToBack:   (canvasId) => canvasManager.sendCanvasToBack(canvasId),
        moveUp:       (canvasId) => canvasManager.moveCanvasUp(canvasId),
        moveDown:     (canvasId) => canvasManager.moveCanvasDown(canvasId),
        setZOrder:    (canvasId, zOrder) => canvasManager.setCanvasZOrder(canvasId, zOrder),
        getZOrder:    (canvasId) => canvasManager.getCanvasZOrder(canvasId),

        /* ── Rendu ── */
        waitForRender:    (canvasId) => canvasManager.waitForRender(canvasId),
        getRenderStats:   (canvasId) => canvasManager.getRenderStats(canvasId),
        getLastRenderTime:(canvasId) => canvasManager.getLastRenderTime(canvasId),
        resetRenderStats: (canvasId) => canvasManager.resetRenderStats(canvasId),

        /* ── Sélection : apparence du rectangle de sélection (délégué au CanvasSelectionManager) ── */
        selection: {

            /* Activation de la sélection à la souris (défaut: false) */
            setEnabled:         (canvasId, enabled)   => selectionManager.setEnabled(canvasId, enabled),
            getEnabled:         (canvasId)             => selectionManager.getEnabled(canvasId),

            /* Bouton souris pour tracer le rectangle (défaut: 'left') */
            setMouseButton:     (canvasId, button)    => selectionManager.setMouseButton(canvasId, button),
            getMouseButton:     (canvasId)             => selectionManager.getMouseButton(canvasId),

            /* Couleur de fond du rectangle de sélection */
            setBackgroundColor: (canvasId, color)     => selectionManager.setBackgroundColor(canvasId, color),
            getBackgroundColor: (canvasId)             => selectionManager.getBackgroundColor(canvasId),

            /* Couleur de bordure du rectangle de sélection */
            setBorderColor:     (canvasId, color)     => selectionManager.setBorderColor(canvasId, color),
            getBorderColor:     (canvasId)             => selectionManager.getBorderColor(canvasId),

            /* Épaisseur de la bordure du rectangle de sélection */
            setBorderThickness: (canvasId, thickness) => selectionManager.setBorderThickness(canvasId, thickness),
            getBorderThickness: (canvasId)             => selectionManager.getBorderThickness(canvasId),

            /* Style de la bordure du rectangle de sélection: 'solid', 'dashed', 'dotted' */
            setBorderStyle:     (canvasId, style)     => selectionManager.setBorderStyle(canvasId, style),
            getBorderStyle:     (canvasId)             => selectionManager.getBorderStyle(canvasId),

            /* Simulation programmatique d'un tracé de rectangle de sélection */
            simulate:           (canvasId, x1, y1, x2, y2, options) => selectionManager.simulate(canvasId, x1, y1, x2, y2, options),
            cancelSimulation:   (canvasId)             => selectionManager.cancelSimulation(canvasId)
        },

        /* ── Historique (raccourci sur la page active du canvas) ── */
        /* Équivalent à voh.canvas.pages.history mais sans avoir à passer pageId. */
        /* Pour cibler une page spécifique, utiliser voh.canvas.pages.history.*    */
        history: {
            undo:         (canvasId)                       => historyManager.undo(canvasId),
            redo:         (canvasId)                       => historyManager.redo(canvasId),
            canUndo:      (canvasId)                       => historyManager.canUndo(canvasId),
            canRedo:      (canvasId)                       => historyManager.canRedo(canvasId),
            getUndoCount: (canvasId)                       => historyManager.getUndoCount(canvasId),
            getRedoCount: (canvasId)                       => historyManager.getRedoCount(canvasId),
            clear:        (canvasId)                       => historyManager.clear(canvasId),
            setMaxLevel:  (canvasId, maxLevel)             => historyManager.setMaxLevel(canvasId, maxLevel),
            getMaxLevel:  (canvasId)                       => historyManager.getMaxLevel(canvasId),
            pause:        (canvasId)                       => historyManager.pauseHistory(canvasId),
            resume:       (canvasId, description)          => historyManager.resumeHistory(canvasId, undefined, description)
        },

        /* ── Pages (par canvas) — délégué au CanvasPageManager ── */
        pages: {

            /* Ajout / Suppression */
            add:    (canvasId, params)   => pageManager.addPage(canvasId, params),
            remove: (canvasId, pageId)   => pageManager.removePage(canvasId, pageId),

            /* Navigation */
            setActive:  (canvasId, pageId) => pageManager.setActivePage(canvasId, pageId),
            getActiveId:(canvasId)         => pageManager.getActivePageId(canvasId),
            next:       (canvasId)         => pageManager.nextPage(canvasId),
            previous:   (canvasId)         => pageManager.previousPage(canvasId),
            goTo:       (canvasId, index)  => pageManager.goToPage(canvasId, index),

            /* Informations */
            getCount: (canvasId)          => pageManager.getPageCount(canvasId),
            getList:  (canvasId)          => pageManager.getPageList(canvasId),
            exists:   (canvasId, pageId)  => pageManager.pageExists(canvasId, pageId),
            getIndex: (canvasId, pageId)  => pageManager.getPageIndex(canvasId, pageId),

            /* Nom */
            setName: (canvasId, pageId, name) => pageManager.setPageName(canvasId, pageId, name),
            getName: (canvasId, pageId)       => pageManager.getPageName(canvasId, pageId),

            /* Ordre */
            moveUp:   (canvasId, pageId)          => pageManager.movePageUp(canvasId, pageId),
            moveDown: (canvasId, pageId)          => pageManager.movePageDown(canvasId, pageId),
            moveTo:   (canvasId, pageId, index)   => pageManager.movePageTo(canvasId, pageId, index),

            /* Duplication */
            duplicate: (canvasId, pageId)         => pageManager.duplicatePage(canvasId, pageId),

            /* Export / Import */
            export: (canvasId, pageId)            => pageManager.exportPage(canvasId, pageId),
            import: (canvasId, data)              => pageManager.importPage(canvasId, data),

            /* ── Sous-objet: dimensions par page ── */
            dimensions: {
                setWidth:  (canvasId, width, pageId)  => pageManager.setPageWidth(canvasId, width, pageId),
                getWidth:  (canvasId, pageId)          => pageManager.getPageWidth(canvasId, pageId),
                setHeight: (canvasId, height, pageId)  => pageManager.setPageHeight(canvasId, height, pageId),
                getHeight: (canvasId, pageId)          => pageManager.getPageHeight(canvasId, pageId)
            },

            /* ── Sous-objet: fond par page ── */
            background: {
                setColor:        (canvasId, color, pageId)   => pageManager.setPageBackgroundColor(canvasId, color, pageId),
                getColor:        (canvasId, pageId)          => pageManager.getPageBackgroundColor(canvasId, pageId),
                setImage:        (canvasId, image, pageId)   => pageManager.setPageBackgroundImage(canvasId, image, pageId),
                getImage:        (canvasId, pageId)          => pageManager.getPageBackgroundImage(canvasId, pageId),
                setImageOpacity: (canvasId, opacity, pageId) => pageManager.setPageBackgroundImageOpacity(canvasId, opacity, pageId),
                getImageOpacity: (canvasId, pageId)          => pageManager.getPageBackgroundImageOpacity(canvasId, pageId)
            },

            /* ── Sous-objet: bordure par page ── */
            border: {
                setColor:        (canvasId, color, pageId)     => pageManager.setPageBorderColor(canvasId, color, pageId),
                getColor:        (canvasId, pageId)            => pageManager.getPageBorderColor(canvasId, pageId),
                setThickness:    (canvasId, thickness, pageId) => pageManager.setPageBorderThickness(canvasId, thickness, pageId),
                getThickness:    (canvasId, pageId)            => pageManager.getPageBorderThickness(canvasId, pageId),
                setStyle:        (canvasId, style, pageId)     => pageManager.setPageBorderStyle(canvasId, style, pageId),
                getStyle:        (canvasId, pageId)            => pageManager.getPageBorderStyle(canvasId, pageId),
                setCornerRadius: (canvasId, radius, pageId)    => pageManager.setPageBorderCornerRadius(canvasId, radius, pageId),
                getCornerRadius: (canvasId, pageId)            => pageManager.getPageBorderCornerRadius(canvasId, pageId),
                setVisible:      (canvasId, visible, pageId)  => pageManager.setPageBorderVisible(canvasId, visible, pageId),
                getVisible:      (canvasId, pageId)            => pageManager.getPageBorderVisible(canvasId, pageId)
            },

            /* ── Sous-objet: grille/snap par page ── */
            grid: {
                setCellWidth:   (canvasId, width, pageId)     => pageManager.setPageGridCellWidth(canvasId, width, pageId),
                getCellWidth:   (canvasId, pageId)            => pageManager.getPageGridCellWidth(canvasId, pageId),
                setCellHeight:  (canvasId, height, pageId)    => pageManager.setPageGridCellHeight(canvasId, height, pageId),
                getCellHeight:  (canvasId, pageId)            => pageManager.getPageGridCellHeight(canvasId, pageId),
                setColor:       (canvasId, color, pageId)     => pageManager.setPageGridColor(canvasId, color, pageId),
                getColor:       (canvasId, pageId)            => pageManager.getPageGridColor(canvasId, pageId),
                setOpacity:     (canvasId, opacity, pageId)   => pageManager.setPageGridOpacity(canvasId, opacity, pageId),
                getOpacity:     (canvasId, pageId)            => pageManager.getPageGridOpacity(canvasId, pageId),
                setThickness:   (canvasId, thickness, pageId) => pageManager.setPageGridThickness(canvasId, thickness, pageId),
                getThickness:   (canvasId, pageId)            => pageManager.getPageGridThickness(canvasId, pageId),
                setStyle:       (canvasId, style, pageId)     => pageManager.setPageGridStyle(canvasId, style, pageId),
                getStyle:       (canvasId, pageId)            => pageManager.getPageGridStyle(canvasId, pageId),
                setVisible:     (canvasId, visible, pageId)   => pageManager.setPageGridVisible(canvasId, visible, pageId),
                getVisible:     (canvasId, pageId)            => pageManager.getPageGridVisible(canvasId, pageId),
                setSnapEnabled: (canvasId, enabled, pageId)   => pageManager.setPageGridSnapEnabled(canvasId, enabled, pageId),
                getSnapEnabled: (canvasId, pageId)            => pageManager.getPageGridSnapEnabled(canvasId, pageId)
            },

            /* ── Sous-objet: sélection souris par page ── */
            selection: {
                setEnabled:          (canvasId, enabled, pageId)   => pageManager.setPageSelectionEnabled(canvasId, enabled, pageId),
                getEnabled:          (canvasId, pageId)            => pageManager.getPageSelectionEnabled(canvasId, pageId),
                setMouseButton:      (canvasId, button, pageId)    => pageManager.setPageSelectionMouseButton(canvasId, button, pageId),
                getMouseButton:      (canvasId, pageId)            => pageManager.getPageSelectionMouseButton(canvasId, pageId),
                setBackgroundColor:  (canvasId, color, pageId)     => pageManager.setPageSelectionBackgroundColor(canvasId, color, pageId),
                getBackgroundColor:  (canvasId, pageId)            => pageManager.getPageSelectionBackgroundColor(canvasId, pageId),
                setBorderColor:      (canvasId, color, pageId)     => pageManager.setPageSelectionBorderColor(canvasId, color, pageId),
                getBorderColor:      (canvasId, pageId)            => pageManager.getPageSelectionBorderColor(canvasId, pageId),
                setBorderThickness:  (canvasId, thickness, pageId) => pageManager.setPageSelectionBorderThickness(canvasId, thickness, pageId),
                getBorderThickness:  (canvasId, pageId)            => pageManager.getPageSelectionBorderThickness(canvasId, pageId),
                setBorderStyle:      (canvasId, style, pageId)     => pageManager.setPageSelectionBorderStyle(canvasId, style, pageId),
                getBorderStyle:      (canvasId, pageId)            => pageManager.getPageSelectionBorderStyle(canvasId, pageId)
            },

            /* ── Sous-objet: curseur par page ── */
            cursor: {
                set: (canvasId, cursor, pageId) => pageManager.setPageCursor(canvasId, cursor, pageId),
                get: (canvasId, pageId)         => pageManager.getPageCursor(canvasId, pageId)
            },

            /* ── Sous-objet: undo/redo par page (délégué au CanvasHistoryManager) ── */
            history: {
                undo:         (canvasId, pageId)              => historyManager.undo(canvasId, pageId),
                redo:         (canvasId, pageId)              => historyManager.redo(canvasId, pageId),
                canUndo:      (canvasId, pageId)              => historyManager.canUndo(canvasId, pageId),
                canRedo:      (canvasId, pageId)              => historyManager.canRedo(canvasId, pageId),
                getUndoCount: (canvasId, pageId)              => historyManager.getUndoCount(canvasId, pageId),
                getRedoCount: (canvasId, pageId)              => historyManager.getRedoCount(canvasId, pageId),
                clear:        (canvasId, pageId)              => historyManager.clear(canvasId, pageId),
                setMaxLevel:  (canvasId, maxLevel, pageId)    => historyManager.setMaxLevel(canvasId, maxLevel, pageId),
                getMaxLevel:  (canvasId, pageId)              => historyManager.getMaxLevel(canvasId, pageId),
                pause:        (canvasId, pageId)              => historyManager.pauseHistory(canvasId, pageId),
                resume:       (canvasId, pageId, description) => historyManager.resumeHistory(canvasId, pageId, description)
            }
        }
    };
}


/* ═══════════════════════════════════════════════════════════════════════════
   API OBJECTS — voh.objects.*

   Mappe les méthodes publiques de l'ObjectManager vers l'API.
   Exemple: voh.objects.create(canvasId, {...}) → ObjectManager.createObject(canvasId, {...})
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Construit l'objet API objects.
 * @param {VisualObjectsHandler} vohInstance
 * @returns {Object} L'objet API objects.
 */
function _buildObjectsApi(vohInstance) {

    const objectManager    = vohInstance._objectManager;
    const selectionManager = vohInstance._objectSelectionManager;

    return {

        /* ── Création / Suppression ── */
        create: (canvasId, params) => objectManager.createObject(canvasId, params),
        delete: (objectId)         => objectManager.deleteObject(objectId),

        /* ── Informations ── */
        getCount:    (canvasId) => objectManager.getObjectCount(canvasId),
        getList:     (canvasId) => objectManager.getObjectList(canvasId),
        exists:      (objectId) => objectManager.objectExists(objectId),
        getCanvasId: (objectId) => objectManager.getObjectCanvasId(objectId),
        getPageId:   (objectId) => objectManager.getObjectPageId(objectId),

        /* ── Nom ── */
        setName: (objectId, name) => objectManager.setObjectName(objectId, name),
        getName: (objectId)       => objectManager.getObjectName(objectId),

        /* ── Position ── */
        setX: (objectId, x) => objectManager.setObjectX(objectId, x),
        getX: (objectId)    => objectManager.getObjectX(objectId),
        setY: (objectId, y) => objectManager.setObjectY(objectId, y),
        getY: (objectId)    => objectManager.getObjectY(objectId),

        /* ── Dimensions ── */
        setWidth:  (objectId, width)  => objectManager.setObjectWidth(objectId, width),
        getWidth:  (objectId)         => objectManager.getObjectWidth(objectId),
        setHeight: (objectId, height) => objectManager.setObjectHeight(objectId, height),
        getHeight: (objectId)         => objectManager.getObjectHeight(objectId),

        /* ── Verrouillage ── */
        setLocked: (objectId, isLocked) => objectManager.setObjectLocked(objectId, isLocked),
        getLocked: (objectId)           => objectManager.getObjectLocked(objectId),
        isLocked:  (objectId)           => objectManager.getObjectLocked(objectId),

        /* ── Visibilité ── */
        setVisible: (objectId, isVisible) => objectManager.setObjectVisible(objectId, isVisible),
        getVisible: (objectId)            => objectManager.getObjectVisible(objectId),
        isVisible:  (objectId)            => objectManager.getObjectVisible(objectId),

        /* ── Opacité ── */
        setOpacity: (objectId, opacity) => objectManager.setObjectOpacity(objectId, opacity),
        getOpacity: (objectId)          => objectManager.getObjectOpacity(objectId),

        /* ── Couleur de fond (rendu par défaut) ── */
        setBackgroundColor: (objectId, color) => objectManager.setObjectBackgroundColor(objectId, color),
        getBackgroundColor: (objectId)        => objectManager.getObjectBackgroundColor(objectId),

        /* ── Callback de dessin personnalisé ── */
        setDrawingCallback: (objectId, callback) => objectManager.setObjectDrawingCallback(objectId, callback),
        getDrawingCallback: (objectId)           => objectManager.getObjectDrawingCallback(objectId),
        redraw:          (objectId)           => objectManager.redrawObject(objectId),

        /* ── Z-order ── */
        bringToFront: (objectId) => objectManager.bringObjectToFront(objectId),
        sendToBack:   (objectId) => objectManager.sendObjectToBack(objectId),
        moveUp:       (objectId) => objectManager.moveObjectUp(objectId),
        moveDown:     (objectId) => objectManager.moveObjectDown(objectId),
        setZOrder:    (objectId, zOrder) => objectManager.setObjectZOrder(objectId, zOrder),
        getZOrder:    (objectId) => objectManager.getObjectZOrder(objectId),

        /* ── Curseur au survol ── */
        setCursor: (objectId, cursor) => objectManager.setObjectCursor(objectId, cursor),
        getCursor: (objectId)         => objectManager.getObjectCursor(objectId),

        /* ── Drag souris ── */
        setMouseDragEnabled:         (objectId, isEnabled) => objectManager.setObjectMouseDragEnabled(objectId, isEnabled),
        getMouseDragEnabled:         (objectId)            => objectManager.getObjectMouseDragEnabled(objectId),
        setMouseDragButton:          (objectId, button)    => objectManager.setObjectMouseDragButton(objectId, button),
        getMouseDragButton:          (objectId)            => objectManager.getObjectMouseDragButton(objectId),
        setMouseDragMode:            (objectId, mode)      => objectManager.setObjectMouseDragMode(objectId, mode),
        getMouseDragMode:            (objectId)            => objectManager.getObjectMouseDragMode(objectId),
        setMouseDragOffsetX:         (objectId, value)     => objectManager.setObjectMouseDragOffsetX(objectId, value),
        getMouseDragOffsetX:         (objectId)            => objectManager.getObjectMouseDragOffsetX(objectId),
        setMouseDragOffsetY:         (objectId, value)     => objectManager.setObjectMouseDragOffsetY(objectId, value),
        getMouseDragOffsetY:         (objectId)            => objectManager.getObjectMouseDragOffsetY(objectId),
        setMouseDragPreviewCallback: (objectId, callback)  => objectManager.setObjectMouseDragPreviewCallback(objectId, callback),
        getMouseDragPreviewCallback: (objectId)            => objectManager.getObjectMouseDragPreviewCallback(objectId),
        setMouseDragMultiMode:            (objectId, mode)      => objectManager.setObjectMouseDragMultiMode(objectId, mode),
        getMouseDragMultiMode:            (objectId)            => objectManager.getObjectMouseDragMultiMode(objectId),
        setMouseDragMultiPreviewCallback: (objectId, callback)  => objectManager.setObjectMouseDragMultiPreviewCallback(objectId, callback),
        getMouseDragMultiPreviewCallback: (objectId)            => objectManager.getObjectMouseDragMultiPreviewCallback(objectId),

        /* ── Contour de sélection (apparence par objet) ── */
        setSelectionBorderColor:     (objectId, color)     => objectManager.setObjectSelectionBorderColor(objectId, color),
        getSelectionBorderColor:     (objectId)            => objectManager.getObjectSelectionBorderColor(objectId),
        setSelectionBorderThickness: (objectId, thickness) => objectManager.setObjectSelectionBorderThickness(objectId, thickness),
        getSelectionBorderThickness: (objectId)            => objectManager.getObjectSelectionBorderThickness(objectId),
        setSelectionBorderOffset:    (objectId, offset)    => objectManager.setObjectSelectionBorderOffset(objectId, offset),
        getSelectionBorderOffset:    (objectId)            => objectManager.getObjectSelectionBorderOffset(objectId),
        setSelectionBorderStyle:     (objectId, style)     => objectManager.setObjectSelectionBorderStyle(objectId, style),
        getSelectionBorderStyle:     (objectId)            => objectManager.getObjectSelectionBorderStyle(objectId),
        setSelectionMode:            (objectId, mode)      => objectManager.setObjectSelectionMode(objectId, mode),
        getSelectionMode:            (objectId)            => objectManager.getObjectSelectionMode(objectId),

        /* ── Sélection (raccourci) ── */
        isSelected: (objectId) => selectionManager.isSelectedById(objectId),

        /* ── Hit-test (recherche d'objet sous un point) ── */
        hitTest: (canvasId, x, y) => {
            const interactionManager = vohInstance._objectInteractionManager;
            if (!interactionManager) return null;
            const objectData = interactionManager.hitTest(canvasId, x, y);
            return objectData ? objectData.id : null;
        },

        /* ── Sous-objet: sélection d'objets (par canevas) ── */
        selection: {
            select:           (canvasId, objectId) => selectionManager.select(canvasId, objectId),
            deselect:         (canvasId, objectId) => selectionManager.deselect(canvasId, objectId),
            toggle:           (canvasId, objectId) => selectionManager.toggle(canvasId, objectId),
            selectOnly:       (canvasId, objectId) => selectionManager.selectOnly(canvasId, objectId),
            selectAll:        (canvasId)           => selectionManager.selectAll(canvasId),
            deselectAll:      (canvasId)           => selectionManager.deselectAll(canvasId),
            getSelectedIds:   (canvasId)           => selectionManager.getSelectedIds(canvasId),
            getSelectedCount: (canvasId)           => selectionManager.getSelectedCount(canvasId),
            isSelected:       (canvasId, objectId) => selectionManager.isSelected(canvasId, objectId)
        }
    };
}


/* ═══════════════════════════════════════════════════════════════════════════
   HELPER: Wrapping récursif des méthodes API pour le diagnostic

   Parcourt un objet API et enveloppe chaque fonction pour loguer
   les appels dans le DiagnosticsManager.
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Enveloppe récursivement toutes les fonctions d'un objet API.
 * @param {Object} apiObject — L'objet API à parcourir (ex: voh.zone).
 * @param {string} pathPrefix — Le chemin de base (ex: 'voh.zone').
 * @param {VisualObjectsHandler} vohInstance — L'instance VOH.
 */
function _diagnosticsWrapAllMethods(apiObject, pathPrefix, vohInstance) {
    for (const key in apiObject) {
        if (!apiObject.hasOwnProperty(key)) continue;
        const value = apiObject[key];
        if (typeof value === 'function') {
            /* Envelopper la fonction */
            apiObject[key] = _diagnosticsWrapApiMethod(pathPrefix + '.' + key, value, vohInstance);
        } else if (typeof value === 'object' && value !== null) {
            /* Parcourir les sous-objets (ex: voh.canvas.selection) */
            _diagnosticsWrapAllMethods(value, pathPrefix + '.' + key, vohInstance);
        }
    }
}


/* ═══════════════════════════════════════════════════════════════════════════
   EXPOSITION GLOBALE
   ═══════════════════════════════════════════════════════════════════════════ */
window._buildApi = _buildApi;
