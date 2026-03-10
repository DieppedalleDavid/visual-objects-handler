/* ═══════════════════════════════════════════════════════════════════════════
   CORE-CANVAS.JS — Gestionnaire de canvas du moteur VOH v5

   Un canvas est une surface de travail positionnée à l'intérieur d'une zone.
   Chaque zone peut contenir 1 ou plusieurs canvas indépendants.
   Chaque canvas se comporte comme une fenêtre MDI (Multiple Document Interface).

   Un seul canvas est éditable (actif) à la fois dans toute l'instance VOH.
   Chaque canvas a sa propre sélection, ses objets, ses pages, son historique.

   Étape 1a — Fondation:
   - Création / suppression dans une zone
   - Position X, Y dans la zone
   - Taille (largeur, hauteur)
   - Nom personnalisable
   - Canvas actif (un seul à la fois)
   - Z-order par ordre de création
   - Verrouillage (le canvas, pas son contenu)
   - Visibilité
   - Opacité
   - Événements de base

   Licence: Open Source (licence à définir)
   Auteur: David Dieppedalle (ShadowStorm)
   ═══════════════════════════════════════════════════════════════════════════ */

'use strict';


/* ═══════════════════════════════════════════════════════════════════════════
   CONSTANTES — Valeurs par défaut pour un nouveau canvas
   ═══════════════════════════════════════════════════════════════════════════ */

/** Position X par défaut dans la zone (pixels). */
const CANVAS_DEFAULT_X = 50;

/** Position Y par défaut dans la zone (pixels). */
const CANVAS_DEFAULT_Y = 50;

/** Largeur par défaut (pixels). */
const CANVAS_DEFAULT_WIDTH = 800;

/** Hauteur par défaut (pixels). */
const CANVAS_DEFAULT_HEIGHT = 600;

/** Couleur de fond par défaut (CSS fallback avant init Pixi.js). */
const CANVAS_DEFAULT_BACKGROUND_COLOR = 'rgba(255, 255, 255, 1.0)';

/** Le canvas est déverrouillé par défaut. */
const CANVAS_DEFAULT_IS_LOCKED = false;

/** Le canvas est visible par défaut. */
const CANVAS_DEFAULT_IS_VISIBLE = true;

/** Opacité par défaut (1.0 = complètement opaque). */
const CANVAS_DEFAULT_OPACITY = 1.0;

/* ── Sélection : constantes migrées vers Core-CanvasSelection.js ── */


/* ═══════════════════════════════════════════════════════════════════════════
   CLASSE: CanvasManager

   Gère tous les canvas de l'instance VOH. Un canvas appartient à une zone.
   Le CanvasManager est global à l'instance (pas un par zone).
   ═══════════════════════════════════════════════════════════════════════════ */
class CanvasManager {

    /**
     * @param {VisualObjectsHandler} vohInstance — Référence à l'instance VOH parente.
     */
    constructor(vohInstance) {

        /** Référence à l'instance VOH parente. */
        this._voh = vohInstance;

        /** Map de tous les canvas: canvasId → canvasData. */
        this._canvases = new Map();

        /** Compteur d'IDs auto-incrémenté. */
        this._canvasIdCounter = 0;

        /** Compteur de z-order auto-incrémenté. */
        this._zOrderCounter = 0;

        /** ID du canvas actuellement actif (en édition), ou null. */
        this._activeCanvasId = null;

        /** Sous-module: gestionnaire du rectangle de sélection souris. */
        this._selectionManager = new CanvasSelectionManager(this);

        /** Sous-module: gestionnaire des pages par canvas. */
        this._pageManager = new CanvasPageManager(this);

        /** Sous-module: gestionnaire undo/redo par page. */
        this._historyManager = new CanvasHistoryManager(this);

        /** Sous-module: moteur de rendu Pixi.js. */
        this._renderEngine = new CanvasRenderEngine(this);
    }


    /* ══════════════════════════════════════════════════════════════
       MÉTHODE INTERNE: _emit
       Raccourci pour émettre un événement via l'EventEmitter global.
       ══════════════════════════════════════════════════════════════ */

    /**
     * Émet un événement via l'EventEmitter de l'instance VOH.
     * @param {string} eventName — Nom de l'événement (ex: 'canvas:created').
     * @param {Object} data — Données de l'événement.
     */
    _emit(eventName, data) {
        const eventEmitter = this._voh.getEventEmitter();
        if (eventEmitter) {
            eventEmitter.emit(eventName, data);
        }
    }


    /* ══════════════════════════════════════════════════════════════
       MÉTHODE INTERNE: _getCanvasData
       Vérifie qu'un canvas existe et retourne ses données.
       ══════════════════════════════════════════════════════════════ */

    /**
     * Retourne les données d'un canvas ou null si inexistant.
     * @param {number} canvasId — L'ID du canvas.
     * @param {string} callerName — Nom de la méthode appelante (pour le log d'erreur).
     * @returns {Object|null} Les données du canvas ou null.
     */
    _getCanvasData(canvasId, callerName) {
        const canvasData = this._canvases.get(canvasId);
        if (!canvasData) {
            console.warn(`[Canvas] ${callerName}: canvas ${canvasId} inexistant.`);
            return null;
        }
        return canvasData;
    }


    /* ══════════════════════════════════════════════════════════════
       MÉTHODE INTERNE: _applyCanvasPosition
       Applique la position X, Y sur l'élément DOM.
       ══════════════════════════════════════════════════════════════ */

    /**
     * @param {Object} canvasData — Les données du canvas.
     */
    _applyCanvasPosition(canvasData) {
        canvasData.element.style.left = canvasData.x + 'px';
        canvasData.element.style.top  = canvasData.y + 'px';
        /* Synchroniser la position dans le stage Pixi de la zone */
        this._renderEngine.updateCanvasPosition(canvasData);
    }


    /* ══════════════════════════════════════════════════════════════
       MÉTHODE INTERNE: _applyCanvasSize
       Applique la largeur et la hauteur sur l'élément DOM.
       ══════════════════════════════════════════════════════════════ */

    /**
     * @param {Object} canvasData — Les données du canvas.
     */
    _applyCanvasSize(canvasData) {
        canvasData.element.style.width  = canvasData.width  + 'px';
        canvasData.element.style.height = canvasData.height + 'px';
        /* Redimensionner le renderer Pixi.js si initialisé */
        this._renderEngine.resizeRenderer(canvasData, canvasData.width, canvasData.height);
    }


    /* ══════════════════════════════════════════════════════════════
       MÉTHODE INTERNE: _applyCanvasVisibility
       Applique la visibilité sur l'élément DOM.
       ══════════════════════════════════════════════════════════════ */

    /**
     * @param {Object} canvasData — Les données du canvas.
     */
    _applyCanvasVisibility(canvasData) {
        canvasData.element.style.display = canvasData.isVisible ? 'block' : 'none';
        /* Synchroniser la visibilité dans le stage Pixi de la zone */
        this._renderEngine.updateCanvasVisibility(canvasData);
    }


    /* ══════════════════════════════════════════════════════════════
       MÉTHODE INTERNE: _applyCanvasOpacity
       Applique l'opacité sur l'élément DOM.
       ══════════════════════════════════════════════════════════════ */

    /**
     * @param {Object} canvasData — Les données du canvas.
     */
    _applyCanvasOpacity(canvasData) {
        canvasData.element.style.opacity = canvasData.opacity;
        /* Synchroniser l'opacité dans le stage Pixi de la zone */
        this._renderEngine.updateCanvasOpacity(canvasData);
    }


    /* ══════════════════════════════════════════════════════════════
       MÉTHODE INTERNE: _applyCanvasZOrder
       Applique le z-order sur l'élément DOM (via z-index CSS).
       ══════════════════════════════════════════════════════════════ */

    /**
     * @param {Object} canvasData — Les données du canvas.
     */
    _applyCanvasZOrder(canvasData) {
        canvasData.element.style.zIndex = canvasData.zOrder;
        /* Synchroniser le z-order dans le stage Pixi de la zone */
        this._renderEngine.updateCanvasZOrder(canvasData);
    }


    /* ══════════════════════════════════════════════════════════════
       MÉTHODE INTERNE: _applyCanvasActiveStyle
       Applique un style visuel pour distinguer le canvas actif.
       ══════════════════════════════════════════════════════════════ */

    /**
     * @param {Object} canvasData — Les données du canvas.
     * @param {boolean} isActive — true si le canvas est actif.
     */
    _applyCanvasActiveStyle(canvasData, isActive) {
        /* Pas de bordure au niveau du canvas. La bordure est par page */
        /* (gérée par renderPageBorder dans Core-RenderEngine.js). */
    }


    /* ══════════════════════════════════════════════════════════════
       CRÉATION D'UN CANVAS
       ══════════════════════════════════════════════════════════════ */

    /**
     * Crée un nouveau canvas dans une zone.
     *
     * @param {number} zoneId — L'ID de la zone dans laquelle créer le canvas.
     * @param {Object} [params] — Paramètres de création.
     * @param {string}  [params.name]            — Nom du canvas.
     * @param {number}  [params.x]               — Position X dans la zone (px).
     * @param {number}  [params.y]               — Position Y dans la zone (px).
     * @param {number}  [params.width]           — Largeur (px).
     * @param {number}  [params.height]          — Hauteur (px).
     * @param {string}  [params.backgroundColor] — Couleur de fond CSS.
     * @param {boolean} [params.isLocked]        — Verrouillé (pas de déplacement/resize souris).
     * @param {boolean} [params.isVisible]       — Visible ou masqué.
     * @param {number}  [params.opacity]         — Opacité (0.0 à 1.0).
     * @param {boolean} [params.selectionEnabled]          — Sélection à la souris activée (défaut: false).
     * @param {string}  [params.selectionMouseButton]      — Bouton souris: 'left', 'middle', 'right' (défaut: 'left').
     * @param {string}  [params.selectionBackgroundColor] — Couleur de fond du rectangle de sélection.
     * @param {string}  [params.selectionBorderColor]     — Couleur de bordure du rectangle de sélection.
     * @param {number}  [params.selectionBorderThickness] — Épaisseur de bordure du rectangle (px).
     * @param {string}  [params.selectionBorderStyle]     — Style: 'solid', 'dashed', 'dotted'.
     * @returns {number} L'ID du canvas créé.
     */
    createCanvas(zoneId, params = {}) {

        /* ── Vérifier que la zone existe ── */
        const zoneManager = this._voh._zoneManager;
        if (!zoneManager || !zoneManager.zoneExists(zoneId)) {
            console.error(`[Canvas] createCanvas: zone ${zoneId} inexistante.`);
            return -1;
        }

        /* ── Générer l'ID ── */
        this._canvasIdCounter++;
        const canvasId = this._canvasIdCounter;

        /* ── Z-order (incrémenté à chaque création) ── */
        this._zOrderCounter++;
        const canvasZOrder = this._zOrderCounter;

        /* ── Nom par défaut ── */
        const canvasName = params.name !== undefined ? params.name : ('Canvas ' + canvasId);

        /* ── Créer l'élément DOM du canvas ── */
        const canvasElement = document.createElement('div');
        canvasElement.className = 'voh-canvas';
        canvasElement.dataset.vohCanvasId = canvasId;
        canvasElement.dataset.vohZoneId   = zoneId;

        /* ── Style de base ── */
        canvasElement.style.position        = 'absolute';
        canvasElement.style.overflow        = 'hidden';
        canvasElement.style.boxSizing       = 'border-box';
        canvasElement.style.backgroundColor = params.backgroundColor !== undefined
            ? params.backgroundColor
            : CANVAS_DEFAULT_BACKGROUND_COLOR;

        /* ── Objet de données du canvas ── */
        const canvasData = {
            id:     canvasId,
            zoneId: zoneId,
            name:   canvasName,

            /* Position dans la zone */
            x: params.x !== undefined ? params.x : CANVAS_DEFAULT_X,
            y: params.y !== undefined ? params.y : CANVAS_DEFAULT_Y,

            /* Dimensions */
            width:  params.width  !== undefined ? params.width  : CANVAS_DEFAULT_WIDTH,
            height: params.height !== undefined ? params.height : CANVAS_DEFAULT_HEIGHT,

            /* Fond (CSS fallback, rendu final par Pixi.js) */
            backgroundColor: params.backgroundColor !== undefined
                ? params.backgroundColor
                : CANVAS_DEFAULT_BACKGROUND_COLOR,

            /* État */
            isLocked:  params.isLocked  !== undefined ? params.isLocked  : CANVAS_DEFAULT_IS_LOCKED,
            isVisible: params.isVisible !== undefined ? params.isVisible : CANVAS_DEFAULT_IS_VISIBLE,
            opacity:   params.opacity   !== undefined ? params.opacity   : CANVAS_DEFAULT_OPACITY,

            /* Sélection : initialisée par le CanvasSelectionManager (voir ci-dessous) */

            /* Z-order */
            zOrder: canvasZOrder,

            /* Référence DOM */
            element: canvasElement
        };

        /* ── Initialiser les propriétés de sélection (délégué au CanvasSelectionManager) ── */
        this._selectionManager.initSelectionDefaults(canvasData, params);

        /* ── Stocker le canvas ── */
        this._canvases.set(canvasId, canvasData);

        /* ── Appliquer les propriétés visuelles ── */
        this._applyCanvasPosition(canvasData);
        this._applyCanvasSize(canvasData);
        this._applyCanvasVisibility(canvasData);
        this._applyCanvasOpacity(canvasData);
        this._applyCanvasZOrder(canvasData);

        /* ── Ajouter au conteneur de canvas de la zone ── */
        const zoneCanvasContainer = zoneManager.getZoneCanvasContainer(zoneId);
        zoneCanvasContainer.appendChild(canvasElement);

        /* ── Initialiser le rectangle de sélection (délégué au CanvasSelectionManager) ── */
        this._selectionManager.initSelectionRect(canvasData);
        this._selectionManager.initSelectionEvents(canvasData);

        /* ── Initialiser les pages (Page 1 créée automatiquement) ── */
        this._pageManager.initPages(canvasData);

        /* ── Initialiser le moteur de rendu Pixi.js (asynchrone, non bloquant) ── */
        /* L'init Pixi est async mais la création du canvas reste synchrone.      */
        /* Le rendu apparaît quelques ms après, invisible pour l'utilisateur.     */
        canvasData._rendererInitPromise = this._renderEngine.initRenderer(canvasData);

        /* ── Initialiser les événements d'interaction souris (délégué à l'ObjectInteractionManager) ── */
        const interactionManager = this._voh._objectInteractionManager;
        if (interactionManager) {
            interactionManager.initInteractionEvents(canvasData);
        }

        /* ── Si c'est le premier canvas de l'instance, l'activer ── */
        if (this._canvases.size === 1) {
            this.setActiveCanvas(canvasId);
        }

        console.log(`[Canvas] Créé — ID: ${canvasId} — Zone: ${zoneId} — Nom: ${canvasName}`);

        /* ── Émettre l'événement canvas:created ── */
        this._emit('canvas:created', { canvasId: canvasId, zoneId: zoneId, name: canvasName });

        return canvasId;
    }


    /* ══════════════════════════════════════════════════════════════
       SUPPRESSION D'UN CANVAS
       ══════════════════════════════════════════════════════════════ */

    /**
     * Supprime un canvas.
     * @param {number} canvasId — L'ID du canvas à supprimer.
     * @returns {boolean} true si supprimé, false sinon.
     */
    deleteCanvas(canvasId) {

        const canvasData = this._getCanvasData(canvasId, 'deleteCanvas');
        if (!canvasData) return false;

        const deletedZoneId = canvasData.zoneId;
        const deletedName   = canvasData.name;

        /* ── Supprimer tous les objets de ce canevas (cascade) ── */
        const objectManager = this._voh._objectManager;
        if (objectManager) {
            objectManager.deleteObjectsByCanvas(canvasId);
        }

        /* ── Retirer les listeners souris de sélection ── */
        this._selectionManager.destroySelectionEvents(canvasData);

        /* ── Retirer les listeners souris d'interaction ── */
        const interactionManagerDelete = this._voh._objectInteractionManager;
        if (interactionManagerDelete) {
            interactionManagerDelete.destroyInteractionEvents(canvasData);
        }

        /* ── Nettoyer la sélection d'objets de ce canevas ── */
        const objectSelectionManager = this._voh._objectSelectionManager;
        if (objectSelectionManager) {
            objectSelectionManager.destroyCanvasSelection(canvasId);
        }

        /* ── Détruire les pages ── */
        this._pageManager.destroyPages(canvasData);

        /* ── Détruire le renderer Pixi.js ── */
        this._renderEngine.destroyRenderer(canvasData);

        /* ── Retirer l'élément DOM ── */
        if (canvasData.element && canvasData.element.parentNode) {
            canvasData.element.parentNode.removeChild(canvasData.element);
        }

        /* ── Retirer de la Map ── */
        this._canvases.delete(canvasId);

        console.log(`[Canvas] Supprimé — ID: ${canvasId} — Nom: ${deletedName}`);

        /* ── Émettre l'événement canvas:deleted ── */
        this._emit('canvas:deleted', { canvasId: canvasId, zoneId: deletedZoneId, name: deletedName });

        /* ── Si le canvas supprimé était actif, réinitialiser l'actif (sans en activer un autre) ── */
        /* Comportement voulu: supprimer un canvas ne change pas l'état des autres.         */
        /* C'est à l'utilisateur d'activer un autre canvas si nécessaire.                  */
        if (this._activeCanvasId === canvasId) {
            this._activeCanvasId = null;
        }

        return true;
    }


    /* ══════════════════════════════════════════════════════════════
       CANVAS ACTIF
       ══════════════════════════════════════════════════════════════ */

    /**
     * Définit le canvas actif (en édition). Un seul à la fois.
     * @param {number} canvasId — L'ID du canvas à activer.
     * @returns {boolean} true si activé, false sinon.
     */
    setActiveCanvas(canvasId) {

        const canvasData = this._getCanvasData(canvasId, 'setActiveCanvas');
        if (!canvasData) return false;

        /* ── Si déjà actif, ne rien faire ── */
        if (this._activeCanvasId === canvasId) return true;

        const previousCanvasId = this._activeCanvasId;

        /* ── Désactiver le canvas précédent ── */
        if (previousCanvasId !== null) {
            const previousCanvasData = this._canvases.get(previousCanvasId);
            if (previousCanvasData) {
                this._applyCanvasActiveStyle(previousCanvasData, false);
                this._emit('canvas:deactivated', { canvasId: previousCanvasId });
            }
        }

        /* ── Activer le nouveau canvas ── */
        this._activeCanvasId = canvasId;
        this._applyCanvasActiveStyle(canvasData, true);

        /* ── Activer la zone parente si elle ne l'est pas déjà ── */
        const zoneManager = this._voh._zoneManager;
        if (zoneManager && zoneManager.getActiveZoneId() !== canvasData.zoneId) {
            zoneManager.setActiveZone(canvasData.zoneId);
        }

        /* ── Mise au premier plan automatique si l'option est activée sur la zone ── */
        if (zoneManager) {
            const bringToFront = zoneManager.getZoneBringCanvasToFrontOnActivation(canvasData.zoneId);
            if (bringToFront) {
                this.bringCanvasToFront(canvasId);
            }
        }

        console.log(`[Canvas] Activé — ID: ${canvasId} — Précédent: ${previousCanvasId}`);

        /* ── Émettre l'événement canvas:activated ── */
        this._emit('canvas:activated', { canvasId: canvasId, previousCanvasId: previousCanvasId });

        return true;
    }

    /**
     * Retourne l'ID du canvas actuellement actif, ou null.
     * @returns {number|null}
     */
    getActiveCanvasId() {
        return this._activeCanvasId;
    }


    /* ══════════════════════════════════════════════════════════════
       INFORMATIONS
       ══════════════════════════════════════════════════════════════ */

    /**
     * Retourne le nombre de canvas dans une zone, ou dans toute l'instance.
     * @param {number|null} [zoneId=null] — Si fourni, compte dans cette zone. Sinon, compte tout.
     * @returns {number}
     */
    getCanvasCount(zoneId = null) {
        if (zoneId === null) return this._canvases.size;
        let count = 0;
        for (const canvasData of this._canvases.values()) {
            if (canvasData.zoneId === zoneId) count++;
        }
        return count;
    }

    /**
     * Retourne la liste des IDs de canvas dans une zone, ou dans toute l'instance.
     * @param {number|null} [zoneId=null] — Si fourni, liste dans cette zone. Sinon, liste tout.
     * @returns {number[]}
     */
    getCanvasList(zoneId = null) {
        if (zoneId === null) return Array.from(this._canvases.keys());
        const result = [];
        for (const canvasData of this._canvases.values()) {
            if (canvasData.zoneId === zoneId) result.push(canvasData.id);
        }
        return result;
    }

    /**
     * Vérifie si un canvas existe.
     * @param {number} canvasId — L'ID du canvas.
     * @returns {boolean}
     */
    canvasExists(canvasId) {
        return this._canvases.has(canvasId);
    }

    /**
     * Retourne l'ID de la zone à laquelle appartient un canvas.
     * @param {number} canvasId — L'ID du canvas.
     * @returns {number|null} L'ID de la zone, ou null si inexistant.
     */
    getCanvasZoneId(canvasId) {
        const canvasData = this._getCanvasData(canvasId, 'getCanvasZoneId');
        if (!canvasData) return null;
        return canvasData.zoneId;
    }


    /* ══════════════════════════════════════════════════════════════
       NOM
       ══════════════════════════════════════════════════════════════ */

    /**
     * Définit le nom d'un canvas.
     * @param {number} canvasId — L'ID du canvas.
     * @param {string} name — Le nouveau nom.
     * @returns {boolean} true si réussi, false si canvas inexistant.
     */
    setCanvasName(canvasId, name) {
        const canvasData = this._getCanvasData(canvasId, 'setCanvasName');
        if (!canvasData) return false;
        canvasData.name = name;
        this._emit('canvas:nameChanged', { canvasId: canvasId, name: name });
        return true;
    }

    /**
     * Retourne le nom d'un canvas.
     * @param {number} canvasId — L'ID du canvas.
     * @returns {string|null}
     */
    getCanvasName(canvasId) {
        const canvasData = this._getCanvasData(canvasId, 'getCanvasName');
        if (!canvasData) return null;
        return canvasData.name;
    }


    /* ══════════════════════════════════════════════════════════════
       POSITION
       ══════════════════════════════════════════════════════════════ */

    /**
     * Définit la position X d'un canvas dans sa zone.
     * @param {number} canvasId — L'ID du canvas.
     * @param {number} x — Position X en pixels.
     * @returns {boolean} true si réussi, false si canvas inexistant.
     */
    setCanvasX(canvasId, x) {
        const canvasData = this._getCanvasData(canvasId, 'setCanvasX');
        if (!canvasData) return false;
        canvasData.x = x;
        this._applyCanvasPosition(canvasData);
        this._emit('canvas:moved', { canvasId: canvasId, x: canvasData.x, y: canvasData.y });
        return true;
    }

    /**
     * Retourne la position X d'un canvas.
     * @param {number} canvasId — L'ID du canvas.
     * @returns {number|null}
     */
    getCanvasX(canvasId) {
        const canvasData = this._getCanvasData(canvasId, 'getCanvasX');
        if (!canvasData) return null;
        return canvasData.x;
    }

    /**
     * Définit la position Y d'un canvas dans sa zone.
     * @param {number} canvasId — L'ID du canvas.
     * @param {number} y — Position Y en pixels.
     * @returns {boolean} true si réussi, false si canvas inexistant.
     */
    setCanvasY(canvasId, y) {
        const canvasData = this._getCanvasData(canvasId, 'setCanvasY');
        if (!canvasData) return false;
        canvasData.y = y;
        this._applyCanvasPosition(canvasData);
        this._emit('canvas:moved', { canvasId: canvasId, x: canvasData.x, y: canvasData.y });
        return true;
    }

    /**
     * Retourne la position Y d'un canvas.
     * @param {number} canvasId — L'ID du canvas.
     * @returns {number|null}
     */
    getCanvasY(canvasId) {
        const canvasData = this._getCanvasData(canvasId, 'getCanvasY');
        if (!canvasData) return null;
        return canvasData.y;
    }


    /* ══════════════════════════════════════════════════════════════
       DIMENSIONS
       ══════════════════════════════════════════════════════════════ */

    /**
     * Définit la largeur d'un canvas.
     * @param {number} canvasId — L'ID du canvas.
     * @param {number} width — Largeur en pixels.
     * @returns {boolean} true si réussi, false si canvas inexistant.
     */
    setCanvasWidth(canvasId, width) {
        const canvasData = this._getCanvasData(canvasId, 'setCanvasWidth');
        if (!canvasData) return false;
        canvasData.width = width;
        this._applyCanvasSize(canvasData);
        this._emit('canvas:resized', { canvasId: canvasId, width: canvasData.width, height: canvasData.height });
        return true;
    }

    /**
     * Retourne la largeur d'un canvas.
     * @param {number} canvasId — L'ID du canvas.
     * @returns {number|null}
     */
    getCanvasWidth(canvasId) {
        const canvasData = this._getCanvasData(canvasId, 'getCanvasWidth');
        if (!canvasData) return null;
        return canvasData.width;
    }

    /**
     * Définit la hauteur d'un canvas.
     * @param {number} canvasId — L'ID du canvas.
     * @param {number} height — Hauteur en pixels.
     * @returns {boolean} true si réussi, false si canvas inexistant.
     */
    setCanvasHeight(canvasId, height) {
        const canvasData = this._getCanvasData(canvasId, 'setCanvasHeight');
        if (!canvasData) return false;
        canvasData.height = height;
        this._applyCanvasSize(canvasData);
        this._emit('canvas:resized', { canvasId: canvasId, width: canvasData.width, height: canvasData.height });
        return true;
    }

    /**
     * Retourne la hauteur d'un canvas.
     * @param {number} canvasId — L'ID du canvas.
     * @returns {number|null}
     */
    getCanvasHeight(canvasId) {
        const canvasData = this._getCanvasData(canvasId, 'getCanvasHeight');
        if (!canvasData) return null;
        return canvasData.height;
    }


    /* ══════════════════════════════════════════════════════════════
       VERROUILLAGE
       ══════════════════════════════════════════════════════════════ */

    /**
     * Verrouille ou déverrouille un canvas.
     * Verrouillé = ne peut être ni déplacé, ni redimensionné par la souris.
     * Les objets à l'intérieur restent manipulables.
     * L'API peut toujours modifier la position/taille même si verrouillé.
     *
     * @param {number} canvasId — L'ID du canvas.
     * @param {boolean} isLocked — true pour verrouiller, false pour déverrouiller.
     * @returns {boolean} true si réussi, false si canvas inexistant.
     */
    setCanvasLocked(canvasId, isLocked) {
        const canvasData = this._getCanvasData(canvasId, 'setCanvasLocked');
        if (!canvasData) return false;

        /* Ne rien faire si la valeur est déjà la même */
        if (canvasData.isLocked === isLocked) return true;

        canvasData.isLocked = isLocked;

        if (isLocked) {
            this._emit('canvas:locked', { canvasId: canvasId });
        } else {
            this._emit('canvas:unlocked', { canvasId: canvasId });
        }
        return true;
    }

    /**
     * Retourne l'état de verrouillage d'un canvas.
     * @param {number} canvasId — L'ID du canvas.
     * @returns {boolean|null}
     */
    getCanvasLocked(canvasId) {
        const canvasData = this._getCanvasData(canvasId, 'getCanvasLocked');
        if (!canvasData) return null;
        return canvasData.isLocked;
    }


    /* ══════════════════════════════════════════════════════════════
       VISIBILITÉ
       ══════════════════════════════════════════════════════════════ */

    /**
     * Affiche ou masque un canvas.
     * Masqué = n'est pas rendu, ne reçoit pas d'événements souris.
     * Les données (objets, pages) restent en mémoire.
     *
     * @param {number} canvasId — L'ID du canvas.
     * @param {boolean} isVisible — true pour afficher, false pour masquer.
     * @returns {boolean} true si réussi, false si canvas inexistant.
     */
    setCanvasVisible(canvasId, isVisible) {
        const canvasData = this._getCanvasData(canvasId, 'setCanvasVisible');
        if (!canvasData) return false;

        /* Ne rien faire si la valeur est déjà la même */
        if (canvasData.isVisible === isVisible) return true;

        canvasData.isVisible = isVisible;
        this._applyCanvasVisibility(canvasData);

        if (isVisible) {
            this._emit('canvas:shown', { canvasId: canvasId });
        } else {
            this._emit('canvas:hidden', { canvasId: canvasId });
        }
        return true;
    }

    /**
     * Retourne la visibilité d'un canvas.
     * @param {number} canvasId — L'ID du canvas.
     * @returns {boolean|null}
     */
    getCanvasVisible(canvasId) {
        const canvasData = this._getCanvasData(canvasId, 'getCanvasVisible');
        if (!canvasData) return null;
        return canvasData.isVisible;
    }


    /* ══════════════════════════════════════════════════════════════
       COULEUR DE FOND
       ══════════════════════════════════════════════════════════════ */

    /**
     * Définit la couleur de fond d'un canvas.
     * Appliquée en CSS sur l'élément DOM du canvas.
     * @param {number} canvasId — L'ID du canvas.
     * @param {string} color — Couleur CSS (ex: 'rgba(255, 255, 255, 1.0)', '#ffffff').
     * @returns {boolean} true si réussi, false si canvas inexistant.
     */
    setCanvasBackgroundColor(canvasId, color) {
        const canvasData = this._getCanvasData(canvasId, 'setCanvasBackgroundColor');
        if (!canvasData) return false;
        canvasData.backgroundColor = color;
        canvasData.element.style.backgroundColor = color; /* CSS fallback */

        /* ── Mettre à jour la page active et re-rendre via Pixi ── */
        if (canvasData.activePageId !== null && canvasData.pages) {
            const pageData = canvasData.pages.get(canvasData.activePageId);
            if (pageData) pageData.backgroundColor = color;
        }
        this._renderEngine.renderPageBackground(canvasData);
        this._renderEngine.requestRender(canvasData);

        this._emit('canvas:backgroundColorChanged', { canvasId: canvasId, backgroundColor: color });
        return true;
    }

    /**
     * Retourne la couleur de fond d'un canvas.
     * @param {number} canvasId — L'ID du canvas.
     * @returns {string|null} La couleur CSS ou null si canvas inexistant.
     */
    getCanvasBackgroundColor(canvasId) {
        const canvasData = this._getCanvasData(canvasId, 'getCanvasBackgroundColor');
        if (!canvasData) return null;
        return canvasData.backgroundColor;
    }


    /* ══════════════════════════════════════════════════════════════
       OPACITÉ
       ══════════════════════════════════════════════════════════════ */

    /**
     * Définit l'opacité d'un canvas (0.0 = transparent, 1.0 = opaque).
     * @param {number} canvasId — L'ID du canvas.
     * @param {number} opacity — Opacité (0.0 à 1.0).
     * @returns {boolean} true si réussi, false si canvas inexistant.
     */
    setCanvasOpacity(canvasId, opacity) {
        const canvasData = this._getCanvasData(canvasId, 'setCanvasOpacity');
        if (!canvasData) return false;

        /* Borner entre 0.0 et 1.0 */
        opacity = Math.max(0.0, Math.min(1.0, opacity));

        canvasData.opacity = opacity;
        this._applyCanvasOpacity(canvasData);
        this._emit('canvas:opacityChanged', { canvasId: canvasId, opacity: opacity });
        return true;
    }

    /**
     * Retourne l'opacité d'un canvas.
     * @param {number} canvasId — L'ID du canvas.
     * @returns {number|null}
     */
    getCanvasOpacity(canvasId) {
        const canvasData = this._getCanvasData(canvasId, 'getCanvasOpacity');
        if (!canvasData) return null;
        return canvasData.opacity;
    }


    /* ══════════════════════════════════════════════════════════════
       Z-ORDER
       ══════════════════════════════════════════════════════════════ */

    /**
     * Place un canvas au premier plan (z-order le plus élevé).
     * @param {number} canvasId — L'ID du canvas.
     * @returns {boolean} true si réussi, false si canvas inexistant.
     */
    bringCanvasToFront(canvasId) {
        const canvasData = this._getCanvasData(canvasId, 'bringCanvasToFront');
        if (!canvasData) return false;

        /* Trouver le z-order maximum actuel */
        let maxZOrder = 0;
        for (const data of this._canvases.values()) {
            if (data.zOrder > maxZOrder) maxZOrder = data.zOrder;
        }

        /* Si déjà au premier plan, ne rien faire */
        if (canvasData.zOrder === maxZOrder) return true;

        canvasData.zOrder = maxZOrder + 1;
        this._applyCanvasZOrder(canvasData);
        this._emit('canvas:zOrderChanged', { canvasId: canvasId, zOrder: canvasData.zOrder });
        return true;
    }

    /**
     * Place un canvas en arrière-plan (z-order le plus bas).
     * @param {number} canvasId — L'ID du canvas.
     * @returns {boolean} true si réussi, false si canvas inexistant.
     */
    sendCanvasToBack(canvasId) {
        const canvasData = this._getCanvasData(canvasId, 'sendCanvasToBack');
        if (!canvasData) return false;

        /* Trouver le z-order minimum actuel */
        let minZOrder = Infinity;
        for (const data of this._canvases.values()) {
            if (data.zOrder < minZOrder) minZOrder = data.zOrder;
        }

        /* Si déjà en arrière-plan, ne rien faire */
        if (canvasData.zOrder === minZOrder) return true;

        canvasData.zOrder = minZOrder - 1;
        this._applyCanvasZOrder(canvasData);
        this._emit('canvas:zOrderChanged', { canvasId: canvasId, zOrder: canvasData.zOrder });
        return true;
    }

    /**
     * Monte un canvas d'un cran dans le z-order.
     * @param {number} canvasId — L'ID du canvas.
     * @returns {boolean} true si réussi, false si canvas inexistant.
     */
    moveCanvasUp(canvasId) {
        const canvasData = this._getCanvasData(canvasId, 'moveCanvasUp');
        if (!canvasData) return false;

        /* Trier tous les canvas par z-order croissant */
        const sortedCanvases = Array.from(this._canvases.values())
            .sort((a, b) => a.zOrder - b.zOrder);

        /* Trouver l'index du canvas courant */
        const currentIndex = sortedCanvases.findIndex(c => c.id === canvasId);

        /* Si déjà au sommet, ne rien faire */
        if (currentIndex >= sortedCanvases.length - 1) return true;

        /* Échanger les z-order avec le canvas juste au-dessus */
        const canvasAbove = sortedCanvases[currentIndex + 1];
        const tempZOrder = canvasData.zOrder;
        canvasData.zOrder = canvasAbove.zOrder;
        canvasAbove.zOrder = tempZOrder;

        this._applyCanvasZOrder(canvasData);
        this._applyCanvasZOrder(canvasAbove);

        this._emit('canvas:zOrderChanged', { canvasId: canvasId, zOrder: canvasData.zOrder });
        this._emit('canvas:zOrderChanged', { canvasId: canvasAbove.id, zOrder: canvasAbove.zOrder });
        return true;
    }

    /**
     * Descend un canvas d'un cran dans le z-order.
     * @param {number} canvasId — L'ID du canvas.
     * @returns {boolean} true si réussi, false si canvas inexistant.
     */
    moveCanvasDown(canvasId) {
        const canvasData = this._getCanvasData(canvasId, 'moveCanvasDown');
        if (!canvasData) return false;

        /* Trier tous les canvas par z-order croissant */
        const sortedCanvases = Array.from(this._canvases.values())
            .sort((a, b) => a.zOrder - b.zOrder);

        /* Trouver l'index du canvas courant */
        const currentIndex = sortedCanvases.findIndex(c => c.id === canvasId);

        /* Si déjà tout en bas, ne rien faire */
        if (currentIndex <= 0) return true;

        /* Échanger les z-order avec le canvas juste en-dessous */
        const canvasBelow = sortedCanvases[currentIndex - 1];
        const tempZOrder = canvasData.zOrder;
        canvasData.zOrder = canvasBelow.zOrder;
        canvasBelow.zOrder = tempZOrder;

        this._applyCanvasZOrder(canvasData);
        this._applyCanvasZOrder(canvasBelow);

        this._emit('canvas:zOrderChanged', { canvasId: canvasId, zOrder: canvasData.zOrder });
        this._emit('canvas:zOrderChanged', { canvasId: canvasBelow.id, zOrder: canvasBelow.zOrder });
        return true;
    }

    /**
     * Définit le z-order d'un canvas à une valeur précise.
     * Si un autre canvas de la même zone a déjà ce z-order,
     * tous les canvas ayant un z-order >= à la valeur demandée
     * sont décalés de +1 pour libérer la place.
     * @param {number} canvasId — L'ID du canvas.
     * @param {number} zOrder — La valeur de z-order souhaitée (nombre entier).
     * @returns {boolean} true si réussi, false si canvas inexistant.
     */
    setCanvasZOrder(canvasId, zOrder) {
        const canvasData = this._getCanvasData(canvasId, 'setCanvasZOrder');
        if (!canvasData) return false;

        /* Convertir en entier pour éviter les flottants */
        const newZOrder = Math.round(zOrder);

        /* Si la valeur est identique, ne rien faire */
        if (canvasData.zOrder === newZOrder) return true;

        /* Vérifier si un autre canvas de la même zone a déjà ce z-order */
        const conflictingCanvases = [];
        for (const [id, data] of this._canvases) {
            if (id !== canvasId && data.zoneId === canvasData.zoneId && data.zOrder >= newZOrder) {
                conflictingCanvases.push(data);
            }
        }

        /* Décaler les canvas en conflit vers le haut (+1) */
        if (conflictingCanvases.length > 0) {
            /* Trier par z-order décroissant pour décaler du plus haut vers le plus bas */
            conflictingCanvases.sort((a, b) => b.zOrder - a.zOrder);
            for (const conflicting of conflictingCanvases) {
                conflicting.zOrder += 1;
                this._applyCanvasZOrder(conflicting);
                this._emit('canvas:zOrderChanged', { canvasId: conflicting.id, zOrder: conflicting.zOrder });
            }
        }

        canvasData.zOrder = newZOrder;
        this._applyCanvasZOrder(canvasData);
        this._emit('canvas:zOrderChanged', { canvasId: canvasId, zOrder: canvasData.zOrder });
        return true;
    }

    /**
     * Retourne le z-order d'un canvas.
     * @param {number} canvasId — L'ID du canvas.
     * @returns {number|null}
     */
    getCanvasZOrder(canvasId) {
        const canvasData = this._getCanvasData(canvasId, 'getCanvasZOrder');
        if (!canvasData) return null;
        return canvasData.zOrder;
    }


    /* ══════════════════════════════════════════════════════════════
       RENDU — Wrappers vers le RenderEngine

       Ces méthodes résolvent canvasId → canvasData en interne
       et délèguent au RenderEngine.
       ══════════════════════════════════════════════════════════════ */

    /**
     * Attend que le rendu GPU soit terminé pour un canvas.
     * @param {number} canvasId — ID du canvas.
     * @returns {Promise<boolean>} — Résout à true quand le rendu est prêt, false si erreur.
     */
    waitForRender(canvasId) {
        const canvasData = this._getCanvasData(canvasId, 'waitForRender');
        if (!canvasData) return Promise.resolve(false);
        return this._renderEngine.waitForRender(canvasData);
    }

    /**
     * Retourne les statistiques de performance du rendu (min, max, moy, count, total).
     * @param {number} canvasId — ID du canvas.
     * @returns {Object|null} — Les stats, ou null si le canvas n'existe pas.
     */
    getRenderStats(canvasId) {
        const canvasData = this._getCanvasData(canvasId, 'getRenderStats');
        if (!canvasData) return null;
        return this._renderEngine.getRenderStats(canvasData);
    }

    /**
     * Retourne le temps du dernier rendu GPU en millisecondes.
     * @param {number} canvasId — ID du canvas.
     * @returns {number} — Le temps en ms, ou 0 si le canvas n'existe pas.
     */
    getLastRenderTime(canvasId) {
        const canvasData = this._getCanvasData(canvasId, 'getLastRenderTime');
        if (!canvasData) return 0;
        return this._renderEngine.getLastRenderTime(canvasData);
    }

    /**
     * Remet les compteurs de statistiques de rendu à zéro.
     * @param {number} canvasId — ID du canvas.
     */
    resetRenderStats(canvasId) {
        const canvasData = this._getCanvasData(canvasId, 'resetRenderStats');
        if (!canvasData) return;
        this._renderEngine.resetRenderStats(canvasData);
    }



    /* ══════════════════════════════════════════════════════════════
       SÉLECTION — Migrée vers Core-CanvasSelection.js
       Toutes les méthodes de sélection (activation, style du
       rectangle, simulation) sont dans CanvasSelectionManager.
       Le CanvasManager délègue via this._selectionManager.
       ══════════════════════════════════════════════════════════════ */


    /* ══════════════════════════════════════════════════════════════
       DESTRUCTION
       ══════════════════════════════════════════════════════════════ */

    /**
     * Détruit tous les canvas et libère les ressources.
     * Appelé par VisualObjectsHandler.destroy().
     */
    destroy() {

        /* ── Supprimer tous les éléments DOM et listeners ── */
        for (const canvasData of this._canvases.values()) {
            this._selectionManager.destroySelectionEvents(canvasData);
            /* Retirer les listeners d'interaction */
            const interactionManagerDestroy = this._voh._objectInteractionManager;
            if (interactionManagerDestroy) {
                interactionManagerDestroy.destroyInteractionEvents(canvasData);
            }
            this._pageManager.destroyPages(canvasData);
            this._renderEngine.destroyRenderer(canvasData);
            if (canvasData.element && canvasData.element.parentNode) {
                canvasData.element.parentNode.removeChild(canvasData.element);
            }
        }

        /* ── Vider la Map ── */
        this._canvases.clear();
        this._activeCanvasId = null;

        /* ── Détruire le gestionnaire d'historique ── */
        if (this._historyManager) {
            this._historyManager.destroy();
        }

        console.log('[Canvas] Tous les canvas détruits.');
    }
}


/* ═══════════════════════════════════════════════════════════════════════════
   EXPOSITION GLOBALE
   ═══════════════════════════════════════════════════════════════════════════ */
window.CanvasManager = CanvasManager;
