/* ═══════════════════════════════════════════════════════════════════════════
   CORE-CANVASPAGE.JS — Gestionnaire de pages par canvas

   Chaque canvas possède 1 ou plusieurs pages. Une page est une surface
   de contenu indépendante avec ses propres dimensions, fond, bordure,
   grille/snap, style de sélection souris, curseur et undo/redo.

   Règles fondamentales :
   - Page 1 créée automatiquement à la création du canvas
   - Impossible de supprimer la dernière page
   - Sans pageId = page active. Avec pageId = page ciblée
   - La sélection d'objets est vidée au changement de page

   Licence: Open Source (licence à définir)
   Auteur: David Dieppedalle (ShadowStorm)
   ═══════════════════════════════════════════════════════════════════════════ */

'use strict';


/* ═══════════════════════════════════════════════════════════════════════════
   CONSTANTES — Valeurs par défaut pour une nouvelle page
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── Dimensions ── */
const PAGE_DEFAULT_WIDTH  = 800;
const PAGE_DEFAULT_HEIGHT = 600;

/* ── Fond ── */
const PAGE_DEFAULT_BACKGROUND_COLOR         = 'rgba(255, 255, 255, 1.0)';
const PAGE_DEFAULT_BACKGROUND_IMAGE         = null;
const PAGE_DEFAULT_BACKGROUND_IMAGE_OPACITY = 1.0;

/* ── Bordure ── */
const PAGE_DEFAULT_BORDER_COLOR         = 'rgba(0, 0, 0, 0.2)';
const PAGE_DEFAULT_BORDER_THICKNESS     = 1;
const PAGE_DEFAULT_BORDER_STYLE         = 'solid';
const PAGE_DEFAULT_BORDER_CORNER_RADIUS = 0;
const PAGE_DEFAULT_BORDER_IS_VISIBLE    = false;

/** Styles de bordure valides pour une page. */
const PAGE_BORDER_STYLES_VALID = ['solid', 'dashed', 'dotted'];

/* ── Grille / Snap ── */
const PAGE_DEFAULT_GRID_CELL_WIDTH  = 25;
const PAGE_DEFAULT_GRID_CELL_HEIGHT = 25;
const PAGE_DEFAULT_GRID_COLOR       = 'rgba(0, 0, 0, 0.1)';
const PAGE_DEFAULT_GRID_OPACITY     = 1.0;
const PAGE_DEFAULT_GRID_THICKNESS   = 1;
const PAGE_DEFAULT_GRID_STYLE       = 'solid';
const PAGE_DEFAULT_GRID_IS_VISIBLE  = false;
const PAGE_DEFAULT_GRID_SNAP_ENABLED = false;

/** Styles de grille valides. */
const PAGE_GRID_STYLES_VALID = ['solid', 'dashed', 'dotted', 'dots'];

/* ── Sélection souris (rectangle de sélection) ── */
const PAGE_DEFAULT_SELECTION_ENABLED          = false;
const PAGE_DEFAULT_SELECTION_MOUSE_BUTTON     = 'left';
const PAGE_DEFAULT_SELECTION_BACKGROUND_COLOR = 'rgba(0, 120, 215, 0.15)';
const PAGE_DEFAULT_SELECTION_BORDER_COLOR     = 'rgba(0, 120, 215, 0.8)';
const PAGE_DEFAULT_SELECTION_BORDER_THICKNESS = 1;
const PAGE_DEFAULT_SELECTION_BORDER_STYLE     = 'solid';

/** Boutons souris valides pour la sélection. */
const PAGE_SELECTION_MOUSE_BUTTONS_VALID = ['left', 'middle', 'right'];

/* ── Curseur ── */
const PAGE_DEFAULT_CURSOR = 'default';


/* ═══════════════════════════════════════════════════════════════════════════
   CLASSE: CanvasPageManager

   Gère les pages de tous les canvas.
   Reçoit une référence vers le CanvasManager pour accéder aux données
   des canvas et émettre les événements.
   ═══════════════════════════════════════════════════════════════════════════ */
class CanvasPageManager {

    /**
     * Crée le gestionnaire de pages.
     * @param {CanvasManager} canvasManager — Référence vers le CanvasManager parent.
     */
    constructor(canvasManager) {
        this._canvasManager = canvasManager;
    }


    /* ══════════════════════════════════════════════════════════════
       MÉTHODES INTERNES
       ══════════════════════════════════════════════════════════════ */

    /** Raccourci vers _emit du CanvasManager. */
    _emit(eventName, data) {
        this._canvasManager._emit(eventName, data);
    }

    /** Raccourci vers _getCanvasData du CanvasManager. */
    _getCanvasData(canvasId, methodName) {
        return this._canvasManager._getCanvasData(canvasId, methodName);
    }

    /**
     * Résout les données de la page ciblée.
     * Sans pageId → page active du canvas. Avec pageId → page ciblée.
     * @param {number} canvasId   — L'ID du canvas.
     * @param {number} [pageId]   — L'ID de la page (optionnel, défaut = page active).
     * @param {string} methodName — Nom de la méthode appelante (pour les logs d'erreur).
     * @returns {{ canvasData: Object, pageData: Object }|null} Les données ou null si erreur.
     */
    _resolvePageData(canvasId, pageId, methodName) {

        const canvasData = this._getCanvasData(canvasId, methodName);
        if (!canvasData) return null;

        const targetPageId = (pageId !== undefined && pageId !== null)
            ? pageId
            : canvasData.activePageId;

        if (targetPageId === null) {
            console.error(`[Page] ${methodName}: aucune page active dans canvas ${canvasId}.`);
            return null;
        }

        const pageData = canvasData.pages.get(targetPageId);
        if (!pageData) {
            console.error(`[Page] ${methodName}: page ${targetPageId} inexistante dans canvas ${canvasId}.`);
            return null;
        }

        return { canvasData, pageData };
    }

    /**
     * Déclenche le re-rendu d'un aspect visuel si la page modifiée est la page active.
     * @param {Object} result      — Le résultat de _resolvePageData ({ canvasData, pageData }).
     * @param {string} renderMethod — Nom de la méthode de rendu ('renderPageBackground', 'renderPageBorder', 'renderPageGrid', 'renderPageDimensions').
     */
    _reRenderIfActivePage(result, renderMethod) {
        if (result.pageData.id !== result.canvasData.activePageId) return;
        const renderEngine = this._canvasManager._renderEngine;
        if (!renderEngine) return;
        renderEngine[renderMethod](result.canvasData);
        /* Pour les dimensions, la grille dépend de la taille → re-rendre aussi */
        if (renderMethod === 'renderPageDimensions') {
            renderEngine.renderPageGrid(result.canvasData);
        }
        renderEngine.requestRender(result.canvasData);
    }

    /**
     * Enregistre un changement de propriété dans l'historique undo/redo.
     * @param {Object} pageData — Les données de la page modifiée.
     * @param {string} propertyName — Nom de la propriété (ex: 'backgroundColor').
     * @param {*} oldValue — Ancienne valeur (avant modification).
     * @param {*} newValue — Nouvelle valeur (après modification).
     */
    _recordChange(pageData, propertyName, oldValue, newValue) {
        const historyManager = this._canvasManager._historyManager;
        if (historyManager) {
            historyManager.pushPagePropertyChange(pageData, propertyName, oldValue, newValue);
        }
    }


    /* ══════════════════════════════════════════════════════════════
       INITIALISATION — Données de page dans canvasData
       ══════════════════════════════════════════════════════════════ */

    /**
     * Initialise la structure de pages dans un canvasData fraîchement créé.
     * Crée automatiquement la Page 1.
     * Appelé par CanvasManager.createCanvas().
     * @param {Object} canvasData — L'objet de données du canvas.
     */
    initPages(canvasData) {

        /** Map de toutes les pages: pageId → pageData. */
        canvasData.pages = new Map();

        /** Liste ordonnée des IDs de pages (index = position). */
        canvasData.pageOrder = [];

        /** ID de la page actuellement active, ou null. */
        canvasData.activePageId = null;

        /** Compteur d'IDs de pages auto-incrémenté. */
        canvasData.pageIdCounter = 0;

        /* ── Créer la page 1 automatiquement ── */
        /* La première page hérite de la couleur de fond du canvas */
        this._createPage(canvasData, {
            name: 'Page 1',
            backgroundColor: canvasData.backgroundColor
        }, true);
    }

    /**
     * Crée une page dans un canvas.
     * Méthode interne utilisée par initPages() et add().
     * @param {Object}  canvasData — Les données du canvas.
     * @param {Object}  [params={}] — Paramètres optionnels de la page.
     * @param {boolean} [isInit=false] — true si c'est la création initiale (pas d'événement).
     * @returns {number} L'ID de la page créée.
     */
    _createPage(canvasData, params = {}, isInit = false) {

        canvasData.pageIdCounter++;
        const pageId   = canvasData.pageIdCounter;
        const canvasId = canvasData.id;
        const pageName = params.name !== undefined ? params.name : ('Page ' + pageId);

        /* ── Objet de données de la page ── */
        const pageData = {
            id:       pageId,
            canvasId: canvasId,
            name:     pageName,

            /* Dimensions */
            width:  params.width  !== undefined ? params.width  : PAGE_DEFAULT_WIDTH,
            height: params.height !== undefined ? params.height : PAGE_DEFAULT_HEIGHT,

            /* Fond */
            backgroundColor:        params.backgroundColor        !== undefined ? params.backgroundColor        : PAGE_DEFAULT_BACKGROUND_COLOR,
            backgroundImage:        params.backgroundImage        !== undefined ? params.backgroundImage        : PAGE_DEFAULT_BACKGROUND_IMAGE,
            backgroundImageOpacity: params.backgroundImageOpacity !== undefined ? params.backgroundImageOpacity : PAGE_DEFAULT_BACKGROUND_IMAGE_OPACITY,

            /* Bordure */
            borderColor:        params.borderColor        !== undefined ? params.borderColor        : PAGE_DEFAULT_BORDER_COLOR,
            borderThickness:    params.borderThickness    !== undefined ? params.borderThickness    : PAGE_DEFAULT_BORDER_THICKNESS,
            borderStyle:        params.borderStyle        !== undefined ? params.borderStyle        : PAGE_DEFAULT_BORDER_STYLE,
            borderCornerRadius: params.borderCornerRadius !== undefined ? params.borderCornerRadius : PAGE_DEFAULT_BORDER_CORNER_RADIUS,
            borderIsVisible:    params.borderIsVisible    !== undefined ? params.borderIsVisible    : PAGE_DEFAULT_BORDER_IS_VISIBLE,

            /* Grille / Snap */
            gridCellWidth:  params.gridCellWidth  !== undefined ? params.gridCellWidth  : PAGE_DEFAULT_GRID_CELL_WIDTH,
            gridCellHeight: params.gridCellHeight !== undefined ? params.gridCellHeight : PAGE_DEFAULT_GRID_CELL_HEIGHT,
            gridColor:      params.gridColor      !== undefined ? params.gridColor      : PAGE_DEFAULT_GRID_COLOR,
            gridOpacity:    params.gridOpacity    !== undefined ? params.gridOpacity    : PAGE_DEFAULT_GRID_OPACITY,
            gridThickness:  params.gridThickness  !== undefined ? params.gridThickness  : PAGE_DEFAULT_GRID_THICKNESS,
            gridStyle:      params.gridStyle      !== undefined ? params.gridStyle      : PAGE_DEFAULT_GRID_STYLE,
            gridIsVisible:  params.gridIsVisible  !== undefined ? params.gridIsVisible  : PAGE_DEFAULT_GRID_IS_VISIBLE,
            gridSnapEnabled: params.gridSnapEnabled !== undefined ? params.gridSnapEnabled : PAGE_DEFAULT_GRID_SNAP_ENABLED,

            /* Sélection souris */
            selectionEnabled:          params.selectionEnabled          !== undefined ? params.selectionEnabled          : PAGE_DEFAULT_SELECTION_ENABLED,
            selectionMouseButton:      params.selectionMouseButton      !== undefined ? params.selectionMouseButton      : PAGE_DEFAULT_SELECTION_MOUSE_BUTTON,
            selectionBackgroundColor:  params.selectionBackgroundColor  !== undefined ? params.selectionBackgroundColor  : PAGE_DEFAULT_SELECTION_BACKGROUND_COLOR,
            selectionBorderColor:      params.selectionBorderColor      !== undefined ? params.selectionBorderColor      : PAGE_DEFAULT_SELECTION_BORDER_COLOR,
            selectionBorderThickness:  params.selectionBorderThickness  !== undefined ? params.selectionBorderThickness  : PAGE_DEFAULT_SELECTION_BORDER_THICKNESS,
            selectionBorderStyle:      params.selectionBorderStyle      !== undefined ? params.selectionBorderStyle      : PAGE_DEFAULT_SELECTION_BORDER_STYLE,

            /* Curseur */
            cursor: params.cursor !== undefined ? params.cursor : PAGE_DEFAULT_CURSOR

            /* Note: l'historique undo/redo est initialisé après par CanvasHistoryManager */
        };

        /* ── Initialiser l'historique undo/redo (délégué au CanvasHistoryManager) ── */
        const historyManager = this._canvasManager._historyManager;
        if (historyManager) {
            historyManager.initHistory(pageData);
        }

        /* ── Stocker la page ── */
        canvasData.pages.set(pageId, pageData);
        canvasData.pageOrder.push(pageId);

        /* ── Activer si c'est la première page ── */
        if (canvasData.activePageId === null) {
            canvasData.activePageId = pageId;
        }

        if (!isInit) {
            console.log(`[Page] Créée — ID: ${pageId} — Canvas: ${canvasId} — Nom: ${pageName}`);
            this._emit('page:added', { canvasId, pageId, name: pageName });
        }

        return pageId;
    }


    /* ══════════════════════════════════════════════════════════════
       AJOUT / SUPPRESSION
       ══════════════════════════════════════════════════════════════ */

    /**
     * Ajoute une page à un canvas.
     * @param {number} canvasId    — L'ID du canvas.
     * @param {Object} [params={}] — Paramètres optionnels (name, width, height, etc.).
     * @returns {number} L'ID de la page créée, ou -1 si erreur.
     */
    addPage(canvasId, params = {}) {
        const canvasData = this._getCanvasData(canvasId, 'addPage');
        if (!canvasData) return -1;
        return this._createPage(canvasData, params);
    }

    /**
     * Supprime une page d'un canvas.
     * Impossible de supprimer la dernière page — il doit toujours en rester au moins une.
     * @param {number} canvasId — L'ID du canvas.
     * @param {number} pageId   — L'ID de la page à supprimer.
     * @returns {boolean} true si supprimée, false sinon.
     */
    removePage(canvasId, pageId) {

        const canvasData = this._getCanvasData(canvasId, 'removePage');
        if (!canvasData) return false;

        /* Vérifier que la page existe */
        if (!canvasData.pages.has(pageId)) {
            console.error(`[Page] removePage: page ${pageId} inexistante dans canvas ${canvasId}.`);
            return false;
        }

        /* Interdire la suppression de la dernière page */
        if (canvasData.pages.size <= 1) {
            console.warn(`[Page] removePage: impossible de supprimer la dernière page du canvas ${canvasId}.`);
            return false;
        }

        const deletedName = canvasData.pages.get(pageId).name;

        /* ── Retirer de l'ordre ── */
        const orderIndex = canvasData.pageOrder.indexOf(pageId);
        canvasData.pageOrder.splice(orderIndex, 1);

        /* ── Retirer de la Map ── */
        canvasData.pages.delete(pageId);

        /* ── Si la page supprimée était active, activer la précédente ou la première ── */
        if (canvasData.activePageId === pageId) {
            const newIndex = Math.min(orderIndex, canvasData.pageOrder.length - 1);
            this._activatePage(canvasData, canvasData.pageOrder[newIndex]);
        }

        console.log(`[Page] Supprimée — ID: ${pageId} — Canvas: ${canvasId} — Nom: ${deletedName}`);
        this._emit('page:removed', { canvasId, pageId, name: deletedName });
        return true;
    }


    /* ══════════════════════════════════════════════════════════════
       NAVIGATION
       ══════════════════════════════════════════════════════════════ */

    /**
     * Active une page dans un canvas (la rend courante).
     * @param {number} canvasId — L'ID du canvas.
     * @param {number} pageId   — L'ID de la page à activer.
     * @returns {boolean} true si réussi, false sinon.
     */
    setActivePage(canvasId, pageId) {
        const canvasData = this._getCanvasData(canvasId, 'setActivePage');
        if (!canvasData) return false;
        if (!canvasData.pages.has(pageId)) {
            console.error(`[Page] setActivePage: page ${pageId} inexistante dans canvas ${canvasId}.`);
            return false;
        }
        if (canvasData.activePageId === pageId) return true; /* déjà active */
        this._activatePage(canvasData, pageId);
        return true;
    }

    /**
     * Méthode interne pour activer une page (avec événement).
     * @param {Object} canvasData — Les données du canvas.
     * @param {number} pageId     — L'ID de la page à activer.
     */
    _activatePage(canvasData, pageId) {
        const previousPageId = canvasData.activePageId;
        const selectionManager = this._canvasManager._selectionManager;

        /* ── Sauvegarder les propriétés de sélection de l'ancienne page ── */
        if (selectionManager && previousPageId !== null) {
            const oldPageData = canvasData.pages.get(previousPageId);
            if (oldPageData) {
                selectionManager.syncSelectionToPage(canvasData, oldPageData);
            }
        }

        /* ── Changer la page active ── */
        canvasData.activePageId = pageId;

        /* ── Charger les propriétés de sélection de la nouvelle page ── */
        if (selectionManager) {
            const newPageData = canvasData.pages.get(pageId);
            if (newPageData) {
                selectionManager.syncSelectionFromPage(canvasData, newPageData);
            }
        }

        /* ── Vider la sélection d'objets (la sélection ne persiste pas entre pages) ── */
        const objectSelectionManager = this._canvasManager._voh._objectSelectionManager;
        if (objectSelectionManager) {
            objectSelectionManager.clearSelectionOnPageChange(canvasData.id);
        }

        /* ── Masquer les objets de l'ancienne page, afficher ceux de la nouvelle ── */
        const objectManager = this._canvasManager._voh._objectManager;
        if (objectManager) {
            objectManager._swapObjectsForPage(canvasData.id, pageId, previousPageId);
        }

        /* ── Re-rendre toutes les propriétés visuelles de la nouvelle page ── */
        const renderEngine = this._canvasManager._renderEngine;
        if (renderEngine) {
            renderEngine.renderAllPageVisuals(canvasData);
        }

        /* ── Reconstruire la grille spatiale pour la nouvelle page ── */
        const interactionManager = this._canvasManager._voh._objectInteractionManager;
        if (interactionManager) {
            interactionManager.rebuildSpatialGrid(canvasData.id);
        }

        this._emit('page:activated', { canvasId: canvasData.id, pageId, previousPageId });
    }

    /**
     * Retourne l'ID de la page active d'un canvas.
     * @param {number} canvasId — L'ID du canvas.
     * @returns {number|null} L'ID de la page active, ou null.
     */
    getActivePageId(canvasId) {
        const canvasData = this._getCanvasData(canvasId, 'getActivePageId');
        if (!canvasData) return null;
        return canvasData.activePageId;
    }

    /**
     * Active la page suivante (circulaire : dernière → première).
     * @param {number} canvasId — L'ID du canvas.
     * @returns {boolean} true si réussi, false sinon.
     */
    nextPage(canvasId) {
        const canvasData = this._getCanvasData(canvasId, 'nextPage');
        if (!canvasData || canvasData.pageOrder.length <= 1) return false;
        const currentIndex = canvasData.pageOrder.indexOf(canvasData.activePageId);
        const nextIndex    = (currentIndex + 1) % canvasData.pageOrder.length;
        this._activatePage(canvasData, canvasData.pageOrder[nextIndex]);
        return true;
    }

    /**
     * Active la page précédente (circulaire : première → dernière).
     * @param {number} canvasId — L'ID du canvas.
     * @returns {boolean} true si réussi, false sinon.
     */
    previousPage(canvasId) {
        const canvasData = this._getCanvasData(canvasId, 'previousPage');
        if (!canvasData || canvasData.pageOrder.length <= 1) return false;
        const currentIndex = canvasData.pageOrder.indexOf(canvasData.activePageId);
        const previousIndex = (currentIndex - 1 + canvasData.pageOrder.length) % canvasData.pageOrder.length;
        this._activatePage(canvasData, canvasData.pageOrder[previousIndex]);
        return true;
    }

    /**
     * Active la page à un index donné (0-based).
     * @param {number} canvasId — L'ID du canvas.
     * @param {number} index    — L'index de la page (0-based).
     * @returns {boolean} true si réussi, false sinon.
     */
    goToPage(canvasId, index) {
        const canvasData = this._getCanvasData(canvasId, 'goToPage');
        if (!canvasData) return false;
        if (index < 0 || index >= canvasData.pageOrder.length) {
            console.error(`[Page] goToPage: index ${index} hors limites (0-${canvasData.pageOrder.length - 1}).`);
            return false;
        }
        this._activatePage(canvasData, canvasData.pageOrder[index]);
        return true;
    }


    /* ══════════════════════════════════════════════════════════════
       INFORMATIONS
       ══════════════════════════════════════════════════════════════ */

    /**
     * Retourne le nombre de pages d'un canvas.
     * @param {number} canvasId — L'ID du canvas.
     * @returns {number} Le nombre de pages, ou 0 si canvas inexistant.
     */
    getPageCount(canvasId) {
        const canvasData = this._getCanvasData(canvasId, 'getPageCount');
        if (!canvasData) return 0;
        return canvasData.pages.size;
    }

    /**
     * Retourne la liste des pages d'un canvas (dans l'ordre).
     * @param {number} canvasId — L'ID du canvas.
     * @returns {Array<{id: number, name: string}>} La liste ordonnée.
     */
    getPageList(canvasId) {
        const canvasData = this._getCanvasData(canvasId, 'getPageList');
        if (!canvasData) return [];
        return canvasData.pageOrder.map(pageId => {
            const pageData = canvasData.pages.get(pageId);
            return { id: pageId, name: pageData.name };
        });
    }

    /**
     * Vérifie si une page existe dans un canvas.
     * @param {number} canvasId — L'ID du canvas.
     * @param {number} pageId   — L'ID de la page.
     * @returns {boolean} true si la page existe, false sinon.
     */
    pageExists(canvasId, pageId) {
        const canvasData = this._getCanvasData(canvasId, 'pageExists');
        if (!canvasData) return false;
        return canvasData.pages.has(pageId);
    }

    /**
     * Retourne l'index (0-based) d'une page dans l'ordre du canvas.
     * @param {number} canvasId — L'ID du canvas.
     * @param {number} pageId   — L'ID de la page.
     * @returns {number} L'index (0-based), ou -1 si page/canvas inexistant.
     */
    getPageIndex(canvasId, pageId) {
        const canvasData = this._getCanvasData(canvasId, 'getPageIndex');
        if (!canvasData) return -1;
        return canvasData.pageOrder.indexOf(pageId);
    }


    /* ══════════════════════════════════════════════════════════════
       NOM
       ══════════════════════════════════════════════════════════════ */

    /**
     * Définit le nom d'une page.
     * @param {number} canvasId — L'ID du canvas.
     * @param {number} pageId   — L'ID de la page.
     * @param {string} name     — Le nouveau nom.
     * @returns {boolean} true si réussi, false sinon.
     */
    setPageName(canvasId, pageId, name) {
        const result = this._resolvePageData(canvasId, pageId, 'setPageName');
        if (!result) return false;
        const _oldValue = result.pageData.name;
        result.pageData.name = name;
        this._recordChange(result.pageData, 'name', _oldValue, result.pageData.name);
        this._emit('page:renamed', { canvasId, pageId: result.pageData.id, name });
        return true;
    }

    /**
     * Retourne le nom d'une page.
     * @param {number} canvasId — L'ID du canvas.
     * @param {number} pageId   — L'ID de la page.
     * @returns {string|null} Le nom de la page, ou null si erreur.
     */
    getPageName(canvasId, pageId) {
        const result = this._resolvePageData(canvasId, pageId, 'getPageName');
        if (!result) return null;
        return result.pageData.name;
    }


    /* ══════════════════════════════════════════════════════════════
       ORDRE DES PAGES
       ══════════════════════════════════════════════════════════════ */

    /**
     * Monte une page d'un cran dans l'ordre.
     * @param {number} canvasId — L'ID du canvas.
     * @param {number} pageId   — L'ID de la page.
     * @returns {boolean} true si réussi, false sinon.
     */
    movePageUp(canvasId, pageId) {
        const canvasData = this._getCanvasData(canvasId, 'movePageUp');
        if (!canvasData) return false;
        const index = canvasData.pageOrder.indexOf(pageId);
        if (index <= 0) return false; /* déjà en premier ou introuvable */
        /* Échanger avec l'élément précédent */
        [canvasData.pageOrder[index - 1], canvasData.pageOrder[index]] =
            [canvasData.pageOrder[index], canvasData.pageOrder[index - 1]];
        this._emit('page:moved', { canvasId, pageId, index: index - 1 });
        return true;
    }

    /**
     * Descend une page d'un cran dans l'ordre.
     * @param {number} canvasId — L'ID du canvas.
     * @param {number} pageId   — L'ID de la page.
     * @returns {boolean} true si réussi, false sinon.
     */
    movePageDown(canvasId, pageId) {
        const canvasData = this._getCanvasData(canvasId, 'movePageDown');
        if (!canvasData) return false;
        const index = canvasData.pageOrder.indexOf(pageId);
        if (index < 0 || index >= canvasData.pageOrder.length - 1) return false;
        [canvasData.pageOrder[index], canvasData.pageOrder[index + 1]] =
            [canvasData.pageOrder[index + 1], canvasData.pageOrder[index]];
        this._emit('page:moved', { canvasId, pageId, index: index + 1 });
        return true;
    }

    /**
     * Déplace une page à un index précis dans l'ordre.
     * @param {number} canvasId    — L'ID du canvas.
     * @param {number} pageId      — L'ID de la page.
     * @param {number} targetIndex — L'index cible (0-based).
     * @returns {boolean} true si réussi, false sinon.
     */
    movePageTo(canvasId, pageId, targetIndex) {
        const canvasData = this._getCanvasData(canvasId, 'movePageTo');
        if (!canvasData) return false;
        const currentIndex = canvasData.pageOrder.indexOf(pageId);
        if (currentIndex < 0) return false;
        targetIndex = Math.max(0, Math.min(targetIndex, canvasData.pageOrder.length - 1));
        if (currentIndex === targetIndex) return true;
        /* Retirer puis insérer à la bonne position */
        canvasData.pageOrder.splice(currentIndex, 1);
        canvasData.pageOrder.splice(targetIndex, 0, pageId);
        this._emit('page:moved', { canvasId, pageId, index: targetIndex });
        return true;
    }


    /* ══════════════════════════════════════════════════════════════
       DUPLICATION
       ══════════════════════════════════════════════════════════════ */

    /**
     * Duplique une page (copie toutes les propriétés).
     * La page dupliquée est insérée juste après l'originale dans l'ordre.
     * @param {number} canvasId — L'ID du canvas.
     * @param {number} pageId   — L'ID de la page à dupliquer.
     * @returns {number} L'ID de la nouvelle page, ou -1 si erreur.
     */
    duplicatePage(canvasId, pageId) {

        const result = this._resolvePageData(canvasId, pageId, 'duplicatePage');
        if (!result) return -1;

        const source = result.pageData;
        const canvasData = result.canvasData;

        /* Copier toutes les propriétés (sauf id et name) */
        const params = {};
        for (const key of Object.keys(source)) {
            if (key !== 'id' && key !== 'canvasId' && key !== 'name') {
                params[key] = source[key];
            }
        }
        params.name = source.name + ' (copie)';

        /* Créer la page */
        const newPageId = this._createPage(canvasData, params);

        /* Insérer juste après l'originale dans l'ordre */
        canvasData.pageOrder.pop(); /* retirer de la fin (où _createPage l'a mis) */
        const sourceIndex = canvasData.pageOrder.indexOf(source.id);
        canvasData.pageOrder.splice(sourceIndex + 1, 0, newPageId);

        this._emit('page:duplicated', { canvasId, pageId: source.id, newPageId });
        return newPageId;
    }


    /* ══════════════════════════════════════════════════════════════
       EXPORT / IMPORT JSON
       ══════════════════════════════════════════════════════════════ */

    /**
     * Exporte une page en objet JSON sérialisable.
     * @param {number} canvasId — L'ID du canvas.
     * @param {number} pageId   — L'ID de la page.
     * @returns {Object|null} L'objet JSON, ou null si erreur.
     */
    exportPage(canvasId, pageId) {
        const result = this._resolvePageData(canvasId, pageId, 'exportPage');
        if (!result) return null;
        /* Copie superficielle (suffisante car toutes les valeurs sont des primitives) */
        const exported = Object.assign({}, result.pageData);
        delete exported.id;       /* l'ID sera régénéré à l'import */
        delete exported.canvasId; /* le canvas cible sera celui de l'import */
        return exported;
    }

    /**
     * Importe une page dans un canvas depuis un objet JSON.
     * @param {number} canvasId — L'ID du canvas cible.
     * @param {Object} data     — Les données JSON de la page.
     * @returns {number} L'ID de la page importée, ou -1 si erreur.
     */
    importPage(canvasId, data) {
        const canvasData = this._getCanvasData(canvasId, 'importPage');
        if (!canvasData) return -1;
        return this._createPage(canvasData, data);
    }


    /* ══════════════════════════════════════════════════════════════
       DIMENSIONS (par page)
       ══════════════════════════════════════════════════════════════ */

    setPageWidth(canvasId, width, pageId) {
        const result = this._resolvePageData(canvasId, pageId, 'setPageWidth');
        if (!result) return false;
        const _oldValue = result.pageData.width;
        result.pageData.width = width;
        this._recordChange(result.pageData, 'width', _oldValue, result.pageData.width);
        this._emit('page:resized', { canvasId, pageId: result.pageData.id, width, height: result.pageData.height });
        // this._reRenderIfActivePage(result, 'renderPageDimensions'); /* Désactivé — scroll par page à venir */
        return true;
    }

    /** Retourne width d'une page. */
    getPageWidth(canvasId, pageId) {
        const result = this._resolvePageData(canvasId, pageId, 'getPageWidth');
        return result ? result.pageData.width : null;
    }

    /** Définit height d'une page. */
    setPageHeight(canvasId, height, pageId) {
        const result = this._resolvePageData(canvasId, pageId, 'setPageHeight');
        if (!result) return false;
        const _oldValue = result.pageData.height;
        result.pageData.height = height;
        this._recordChange(result.pageData, 'height', _oldValue, result.pageData.height);
        this._emit('page:resized', { canvasId, pageId: result.pageData.id, width: result.pageData.width, height });
        // this._reRenderIfActivePage(result, 'renderPageDimensions'); /* Désactivé — scroll par page à venir */
        return true;
    }

    /** Retourne height d'une page. */
    getPageHeight(canvasId, pageId) {
        const result = this._resolvePageData(canvasId, pageId, 'getPageHeight');
        return result ? result.pageData.height : null;
    }


    /* ══════════════════════════════════════════════════════════════
       FOND (par page)
       ══════════════════════════════════════════════════════════════ */

    setPageBackgroundColor(canvasId, color, pageId) {
        const result = this._resolvePageData(canvasId, pageId, 'setPageBackgroundColor');
        if (!result) return false;
        const _oldValue = result.pageData.backgroundColor;
        result.pageData.backgroundColor = color;
        this._recordChange(result.pageData, 'backgroundColor', _oldValue, result.pageData.backgroundColor);
        this._emit('page:backgroundChanged', { canvasId, pageId: result.pageData.id, property: 'backgroundColor', value: color });
        this._reRenderIfActivePage(result, 'renderPageBackground');
        return true;
    }

    /** Retourne background color d'une page. */
    getPageBackgroundColor(canvasId, pageId) {
        const result = this._resolvePageData(canvasId, pageId, 'getPageBackgroundColor');
        return result ? result.pageData.backgroundColor : null;
    }

    /** Définit background image d'une page. */
    setPageBackgroundImage(canvasId, image, pageId) {
        const result = this._resolvePageData(canvasId, pageId, 'setPageBackgroundImage');
        if (!result) return false;
        const _oldValue = result.pageData.backgroundImage;
        result.pageData.backgroundImage = image;
        this._recordChange(result.pageData, 'backgroundImage', _oldValue, result.pageData.backgroundImage);
        this._emit('page:backgroundChanged', { canvasId, pageId: result.pageData.id, property: 'backgroundImage', value: image });
        this._reRenderIfActivePage(result, 'renderPageBackground');
        return true;
    }

    /** Retourne background image d'une page. */
    getPageBackgroundImage(canvasId, pageId) {
        const result = this._resolvePageData(canvasId, pageId, 'getPageBackgroundImage');
        return result ? result.pageData.backgroundImage : null;
    }

    /** Définit background image opacity d'une page. */
    setPageBackgroundImageOpacity(canvasId, opacity, pageId) {
        const result = this._resolvePageData(canvasId, pageId, 'setPageBackgroundImageOpacity');
        if (!result) return false;
        const _oldValue = result.pageData.backgroundImageOpacity;
        result.pageData.backgroundImageOpacity = Math.max(0, Math.min(1, opacity));
        this._recordChange(result.pageData, 'backgroundImageOpacity', _oldValue, result.pageData.backgroundImageOpacity);
        this._emit('page:backgroundChanged', { canvasId, pageId: result.pageData.id, property: 'backgroundImageOpacity', value: result.pageData.backgroundImageOpacity });
        this._reRenderIfActivePage(result, 'renderPageBackground');
        return true;
    }

    /** Retourne background image opacity d'une page. */
    getPageBackgroundImageOpacity(canvasId, pageId) {
        const result = this._resolvePageData(canvasId, pageId, 'getPageBackgroundImageOpacity');
        return result ? result.pageData.backgroundImageOpacity : null;
    }


    /* ══════════════════════════════════════════════════════════════
       BORDURE (par page)
       ══════════════════════════════════════════════════════════════ */

    setPageBorderColor(canvasId, color, pageId) {
        const result = this._resolvePageData(canvasId, pageId, 'setPageBorderColor');
        if (!result) return false;
        const _oldValue = result.pageData.borderColor;
        result.pageData.borderColor = color;
        this._recordChange(result.pageData, 'borderColor', _oldValue, result.pageData.borderColor);
        this._emit('page:borderChanged', { canvasId, pageId: result.pageData.id, property: 'borderColor', value: color });
        this._reRenderIfActivePage(result, 'renderPageBorder');
        return true;
    }

    /** Retourne border color d'une page. */
    getPageBorderColor(canvasId, pageId) {
        const result = this._resolvePageData(canvasId, pageId, 'getPageBorderColor');
        return result ? result.pageData.borderColor : null;
    }

    /** Définit border thickness d'une page. */
    setPageBorderThickness(canvasId, thickness, pageId) {
        const result = this._resolvePageData(canvasId, pageId, 'setPageBorderThickness');
        if (!result) return false;
        const _oldValue = result.pageData.borderThickness;
        result.pageData.borderThickness = Math.max(0, thickness);
        this._recordChange(result.pageData, 'borderThickness', _oldValue, result.pageData.borderThickness);
        this._emit('page:borderChanged', { canvasId, pageId: result.pageData.id, property: 'borderThickness', value: result.pageData.borderThickness });
        this._reRenderIfActivePage(result, 'renderPageBorder');
        return true;
    }

    /** Retourne border thickness d'une page. */
    getPageBorderThickness(canvasId, pageId) {
        const result = this._resolvePageData(canvasId, pageId, 'getPageBorderThickness');
        return result ? result.pageData.borderThickness : null;
    }

    /** Définit border style d'une page. */
    setPageBorderStyle(canvasId, style, pageId) {
        const result = this._resolvePageData(canvasId, pageId, 'setPageBorderStyle');
        if (!result) return false;
        if (!PAGE_BORDER_STYLES_VALID.includes(style)) {
            console.warn(`[Page] setPageBorderStyle: style '${style}' invalide. Valeurs: ${PAGE_BORDER_STYLES_VALID.join(', ')}.`);
            return false;
        }
        const _oldValue = result.pageData.borderStyle;
        result.pageData.borderStyle = style;
        this._recordChange(result.pageData, 'borderStyle', _oldValue, result.pageData.borderStyle);
        this._emit('page:borderChanged', { canvasId, pageId: result.pageData.id, property: 'borderStyle', value: style });
        this._reRenderIfActivePage(result, 'renderPageBorder');
        return true;
    }

    /** Retourne border style d'une page. */
    getPageBorderStyle(canvasId, pageId) {
        const result = this._resolvePageData(canvasId, pageId, 'getPageBorderStyle');
        return result ? result.pageData.borderStyle : null;
    }

    /** Définit border corner radius d'une page. */
    setPageBorderCornerRadius(canvasId, radius, pageId) {
        const result = this._resolvePageData(canvasId, pageId, 'setPageBorderCornerRadius');
        if (!result) return false;
        const _oldValue = result.pageData.borderCornerRadius;
        result.pageData.borderCornerRadius = Math.max(0, radius);
        this._recordChange(result.pageData, 'borderCornerRadius', _oldValue, result.pageData.borderCornerRadius);
        this._emit('page:borderChanged', { canvasId, pageId: result.pageData.id, property: 'borderCornerRadius', value: result.pageData.borderCornerRadius });
        this._reRenderIfActivePage(result, 'renderPageBorder');
        return true;
    }

    /** Retourne border corner radius d'une page. */
    getPageBorderCornerRadius(canvasId, pageId) {
        const result = this._resolvePageData(canvasId, pageId, 'getPageBorderCornerRadius');
        return result ? result.pageData.borderCornerRadius : null;
    }

    /** Définit border visible d'une page. */
    setPageBorderVisible(canvasId, visible, pageId) {
        const result = this._resolvePageData(canvasId, pageId, 'setPageBorderVisible');
        if (!result) return false;
        const _oldValue = result.pageData.borderIsVisible;
        result.pageData.borderIsVisible = !!visible;
        this._recordChange(result.pageData, 'borderIsVisible', _oldValue, result.pageData.borderIsVisible);
        this._emit('page:borderChanged', { canvasId, pageId: result.pageData.id, property: 'borderIsVisible', value: result.pageData.borderIsVisible });
        this._reRenderIfActivePage(result, 'renderPageBorder');
        return true;
    }

    /** Retourne border visible d'une page. */
    getPageBorderVisible(canvasId, pageId) {
        const result = this._resolvePageData(canvasId, pageId, 'getPageBorderVisible');
        return result ? result.pageData.borderIsVisible : null;
    }


    /* ══════════════════════════════════════════════════════════════
       GRILLE / SNAP (par page)
       ══════════════════════════════════════════════════════════════ */

    setPageGridCellWidth(canvasId, width, pageId) {
        const result = this._resolvePageData(canvasId, pageId, 'setPageGridCellWidth');
        if (!result) return false;
        const _oldValue = result.pageData.gridCellWidth;
        result.pageData.gridCellWidth = Math.max(1, width);
        this._recordChange(result.pageData, 'gridCellWidth', _oldValue, result.pageData.gridCellWidth);
        this._emit('page:gridChanged', { canvasId, pageId: result.pageData.id, property: 'gridCellWidth', value: result.pageData.gridCellWidth });
        this._reRenderIfActivePage(result, 'renderPageGrid');
        return true;
    }

    /** Retourne grid cell width d'une page. */
    getPageGridCellWidth(canvasId, pageId) {
        const result = this._resolvePageData(canvasId, pageId, 'getPageGridCellWidth');
        return result ? result.pageData.gridCellWidth : null;
    }

    /** Définit grid cell height d'une page. */
    setPageGridCellHeight(canvasId, height, pageId) {
        const result = this._resolvePageData(canvasId, pageId, 'setPageGridCellHeight');
        if (!result) return false;
        const _oldValue = result.pageData.gridCellHeight;
        result.pageData.gridCellHeight = Math.max(1, height);
        this._recordChange(result.pageData, 'gridCellHeight', _oldValue, result.pageData.gridCellHeight);
        this._emit('page:gridChanged', { canvasId, pageId: result.pageData.id, property: 'gridCellHeight', value: result.pageData.gridCellHeight });
        this._reRenderIfActivePage(result, 'renderPageGrid');
        return true;
    }

    /** Retourne grid cell height d'une page. */
    getPageGridCellHeight(canvasId, pageId) {
        const result = this._resolvePageData(canvasId, pageId, 'getPageGridCellHeight');
        return result ? result.pageData.gridCellHeight : null;
    }

    /** Définit grid color d'une page. */
    setPageGridColor(canvasId, color, pageId) {
        const result = this._resolvePageData(canvasId, pageId, 'setPageGridColor');
        if (!result) return false;
        const _oldValue = result.pageData.gridColor;
        result.pageData.gridColor = color;
        this._recordChange(result.pageData, 'gridColor', _oldValue, result.pageData.gridColor);
        this._emit('page:gridChanged', { canvasId, pageId: result.pageData.id, property: 'gridColor', value: color });
        this._reRenderIfActivePage(result, 'renderPageGrid');
        return true;
    }

    /** Retourne grid color d'une page. */
    getPageGridColor(canvasId, pageId) {
        const result = this._resolvePageData(canvasId, pageId, 'getPageGridColor');
        return result ? result.pageData.gridColor : null;
    }

    /** Définit grid opacity d'une page. */
    setPageGridOpacity(canvasId, opacity, pageId) {
        const result = this._resolvePageData(canvasId, pageId, 'setPageGridOpacity');
        if (!result) return false;
        const _oldValue = result.pageData.gridOpacity;
        result.pageData.gridOpacity = Math.max(0, Math.min(1, opacity));
        this._recordChange(result.pageData, 'gridOpacity', _oldValue, result.pageData.gridOpacity);
        this._emit('page:gridChanged', { canvasId, pageId: result.pageData.id, property: 'gridOpacity', value: result.pageData.gridOpacity });
        this._reRenderIfActivePage(result, 'renderPageGrid');
        return true;
    }

    /** Retourne grid opacity d'une page. */
    getPageGridOpacity(canvasId, pageId) {
        const result = this._resolvePageData(canvasId, pageId, 'getPageGridOpacity');
        return result ? result.pageData.gridOpacity : null;
    }

    /** Définit grid thickness d'une page. */
    setPageGridThickness(canvasId, thickness, pageId) {
        const result = this._resolvePageData(canvasId, pageId, 'setPageGridThickness');
        if (!result) return false;
        const _oldValue = result.pageData.gridThickness;
        result.pageData.gridThickness = Math.max(0, thickness);
        this._recordChange(result.pageData, 'gridThickness', _oldValue, result.pageData.gridThickness);
        this._emit('page:gridChanged', { canvasId, pageId: result.pageData.id, property: 'gridThickness', value: result.pageData.gridThickness });
        this._reRenderIfActivePage(result, 'renderPageGrid');
        return true;
    }

    /** Retourne grid thickness d'une page. */
    getPageGridThickness(canvasId, pageId) {
        const result = this._resolvePageData(canvasId, pageId, 'getPageGridThickness');
        return result ? result.pageData.gridThickness : null;
    }

    /** Définit grid style d'une page. */
    setPageGridStyle(canvasId, style, pageId) {
        const result = this._resolvePageData(canvasId, pageId, 'setPageGridStyle');
        if (!result) return false;
        if (!PAGE_GRID_STYLES_VALID.includes(style)) {
            console.warn(`[Page] setPageGridStyle: style '${style}' invalide. Valeurs: ${PAGE_GRID_STYLES_VALID.join(', ')}.`);
            return false;
        }
        const _oldValue = result.pageData.gridStyle;
        result.pageData.gridStyle = style;
        this._recordChange(result.pageData, 'gridStyle', _oldValue, result.pageData.gridStyle);
        this._emit('page:gridChanged', { canvasId, pageId: result.pageData.id, property: 'gridStyle', value: style });
        this._reRenderIfActivePage(result, 'renderPageGrid');
        return true;
    }

    /** Retourne grid style d'une page. */
    getPageGridStyle(canvasId, pageId) {
        const result = this._resolvePageData(canvasId, pageId, 'getPageGridStyle');
        return result ? result.pageData.gridStyle : null;
    }

    /** Définit grid visible d'une page. */
    setPageGridVisible(canvasId, visible, pageId) {
        const result = this._resolvePageData(canvasId, pageId, 'setPageGridVisible');
        if (!result) return false;
        const _oldValue = result.pageData.gridIsVisible;
        result.pageData.gridIsVisible = !!visible;
        this._recordChange(result.pageData, 'gridIsVisible', _oldValue, result.pageData.gridIsVisible);
        this._emit('page:gridChanged', { canvasId, pageId: result.pageData.id, property: 'gridIsVisible', value: visible });
        this._reRenderIfActivePage(result, 'renderPageGrid');
        return true;
    }

    /** Retourne grid visible d'une page. */
    getPageGridVisible(canvasId, pageId) {
        const result = this._resolvePageData(canvasId, pageId, 'getPageGridVisible');
        return result ? result.pageData.gridIsVisible : null;
    }

    /** Définit grid snap enabled d'une page. */
    setPageGridSnapEnabled(canvasId, enabled, pageId) {
        const result = this._resolvePageData(canvasId, pageId, 'setPageGridSnapEnabled');
        if (!result) return false;
        const _oldValue = result.pageData.gridSnapEnabled;
        result.pageData.gridSnapEnabled = !!enabled;
        this._recordChange(result.pageData, 'gridSnapEnabled', _oldValue, result.pageData.gridSnapEnabled);
        this._emit('page:gridChanged', { canvasId, pageId: result.pageData.id, property: 'gridSnapEnabled', value: enabled });
        return true;
    }

    /** Retourne grid snap enabled d'une page. */
    getPageGridSnapEnabled(canvasId, pageId) {
        const result = this._resolvePageData(canvasId, pageId, 'getPageGridSnapEnabled');
        return result ? result.pageData.gridSnapEnabled : null;
    }


    /* ══════════════════════════════════════════════════════════════
       SÉLECTION SOURIS (par page)
       Style et activation du rectangle de sélection à la souris.

       Les propriétés de sélection vivent en double :
       - Dans canvasData (le "live" = utilisé par le rectangle de sélection)
       - Dans pageData (la "sauvegarde" = restauré au changement de page)

       Quand on modifie via pages.selection et que la page ciblée est
       la page active, il faut AUSSI mettre à jour canvasData et le
       style visuel du rectangle pour garder la cohérence.
       ══════════════════════════════════════════════════════════════ */

    /**
     * Si la page modifiée est la page active, propage la propriété
     * de sélection vers canvasData et met à jour le style visuel.
     * @param {Object} canvasData   — Les données du canvas.
     * @param {Object} pageData     — La page modifiée.
     * @param {string} propertyName — Nom de la propriété (ex: 'selectionEnabled').
     * @param {*}      value        — La valeur à propager.
     * @private
     */
    _syncSelectionToCanvasIfActivePage(canvasData, pageData, propertyName, value) {
        if (pageData.id !== canvasData.activePageId) return;
        /* Mettre à jour canvasData (le "live") */
        canvasData[propertyName] = value;
        /* Mettre à jour le style visuel du rectangle de sélection */
        const selectionManager = this._canvasManager._selectionManager;
        if (selectionManager) {
            selectionManager._applyCanvasSelectionRectStyle(canvasData);
        }
    }

    setPageSelectionEnabled(canvasId, enabled, pageId) {
        const result = this._resolvePageData(canvasId, pageId, 'setPageSelectionEnabled');
        if (!result) return false;
        const _oldValue = result.pageData.selectionEnabled;
        result.pageData.selectionEnabled = !!enabled;
        this._recordChange(result.pageData, 'selectionEnabled', _oldValue, result.pageData.selectionEnabled);
        this._syncSelectionToCanvasIfActivePage(result.canvasData, result.pageData, 'selectionEnabled', result.pageData.selectionEnabled);
        this._emit('page:selectionStyleChanged', { canvasId, pageId: result.pageData.id, property: 'selectionEnabled', value: enabled });
        return true;
    }

    /** Retourne selection enabled d'une page. */
    getPageSelectionEnabled(canvasId, pageId) {
        const result = this._resolvePageData(canvasId, pageId, 'getPageSelectionEnabled');
        return result ? result.pageData.selectionEnabled : null;
    }

    /** Définit selection mouse button d'une page. */
    setPageSelectionMouseButton(canvasId, button, pageId) {
        const result = this._resolvePageData(canvasId, pageId, 'setPageSelectionMouseButton');
        if (!result) return false;
        if (!PAGE_SELECTION_MOUSE_BUTTONS_VALID.includes(button)) {
            console.warn(`[Page] setPageSelectionMouseButton: bouton '${button}' invalide. Valeurs: ${PAGE_SELECTION_MOUSE_BUTTONS_VALID.join(', ')}.`);
            return false;
        }
        const _oldValue = result.pageData.selectionMouseButton;
        result.pageData.selectionMouseButton = button;
        this._recordChange(result.pageData, 'selectionMouseButton', _oldValue, result.pageData.selectionMouseButton);
        this._syncSelectionToCanvasIfActivePage(result.canvasData, result.pageData, 'selectionMouseButton', button);
        this._emit('page:selectionStyleChanged', { canvasId, pageId: result.pageData.id, property: 'selectionMouseButton', value: button });
        return true;
    }

    /** Retourne selection mouse button d'une page. */
    getPageSelectionMouseButton(canvasId, pageId) {
        const result = this._resolvePageData(canvasId, pageId, 'getPageSelectionMouseButton');
        return result ? result.pageData.selectionMouseButton : null;
    }

    /** Définit selection background color d'une page. */
    setPageSelectionBackgroundColor(canvasId, color, pageId) {
        const result = this._resolvePageData(canvasId, pageId, 'setPageSelectionBackgroundColor');
        if (!result) return false;
        const _oldValue = result.pageData.selectionBackgroundColor;
        result.pageData.selectionBackgroundColor = color;
        this._recordChange(result.pageData, 'selectionBackgroundColor', _oldValue, result.pageData.selectionBackgroundColor);
        this._syncSelectionToCanvasIfActivePage(result.canvasData, result.pageData, 'selectionBackgroundColor', color);
        this._emit('page:selectionStyleChanged', { canvasId, pageId: result.pageData.id, property: 'selectionBackgroundColor', value: color });
        return true;
    }

    /** Retourne selection background color d'une page. */
    getPageSelectionBackgroundColor(canvasId, pageId) {
        const result = this._resolvePageData(canvasId, pageId, 'getPageSelectionBackgroundColor');
        return result ? result.pageData.selectionBackgroundColor : null;
    }

    /** Définit selection border color d'une page. */
    setPageSelectionBorderColor(canvasId, color, pageId) {
        const result = this._resolvePageData(canvasId, pageId, 'setPageSelectionBorderColor');
        if (!result) return false;
        const _oldValue = result.pageData.selectionBorderColor;
        result.pageData.selectionBorderColor = color;
        this._recordChange(result.pageData, 'selectionBorderColor', _oldValue, result.pageData.selectionBorderColor);
        this._syncSelectionToCanvasIfActivePage(result.canvasData, result.pageData, 'selectionBorderColor', color);
        this._emit('page:selectionStyleChanged', { canvasId, pageId: result.pageData.id, property: 'selectionBorderColor', value: color });
        return true;
    }

    /** Retourne selection border color d'une page. */
    getPageSelectionBorderColor(canvasId, pageId) {
        const result = this._resolvePageData(canvasId, pageId, 'getPageSelectionBorderColor');
        return result ? result.pageData.selectionBorderColor : null;
    }

    /** Définit selection border thickness d'une page. */
    setPageSelectionBorderThickness(canvasId, thickness, pageId) {
        const result = this._resolvePageData(canvasId, pageId, 'setPageSelectionBorderThickness');
        if (!result) return false;
        const _oldValue = result.pageData.selectionBorderThickness;
        result.pageData.selectionBorderThickness = Math.max(0, thickness);
        this._recordChange(result.pageData, 'selectionBorderThickness', _oldValue, result.pageData.selectionBorderThickness);
        this._syncSelectionToCanvasIfActivePage(result.canvasData, result.pageData, 'selectionBorderThickness', result.pageData.selectionBorderThickness);
        this._emit('page:selectionStyleChanged', { canvasId, pageId: result.pageData.id, property: 'selectionBorderThickness', value: result.pageData.selectionBorderThickness });
        return true;
    }

    /** Retourne selection border thickness d'une page. */
    getPageSelectionBorderThickness(canvasId, pageId) {
        const result = this._resolvePageData(canvasId, pageId, 'getPageSelectionBorderThickness');
        return result ? result.pageData.selectionBorderThickness : null;
    }

    /** Définit selection border style d'une page. */
    setPageSelectionBorderStyle(canvasId, style, pageId) {
        const result = this._resolvePageData(canvasId, pageId, 'setPageSelectionBorderStyle');
        if (!result) return false;
        if (!PAGE_BORDER_STYLES_VALID.includes(style)) {
            console.warn(`[Page] setPageSelectionBorderStyle: style '${style}' invalide. Valeurs: ${PAGE_BORDER_STYLES_VALID.join(', ')}.`);
            return false;
        }
        const _oldValue = result.pageData.selectionBorderStyle;
        result.pageData.selectionBorderStyle = style;
        this._recordChange(result.pageData, 'selectionBorderStyle', _oldValue, result.pageData.selectionBorderStyle);
        this._syncSelectionToCanvasIfActivePage(result.canvasData, result.pageData, 'selectionBorderStyle', style);
        this._emit('page:selectionStyleChanged', { canvasId, pageId: result.pageData.id, property: 'selectionBorderStyle', value: style });
        return true;
    }

    /** Retourne selection border style d'une page. */
    getPageSelectionBorderStyle(canvasId, pageId) {
        const result = this._resolvePageData(canvasId, pageId, 'getPageSelectionBorderStyle');
        return result ? result.pageData.selectionBorderStyle : null;
    }


    /* ══════════════════════════════════════════════════════════════
       CURSEUR (par page)
       ══════════════════════════════════════════════════════════════ */

    setPageCursor(canvasId, cursor, pageId) {
        const result = this._resolvePageData(canvasId, pageId, 'setPageCursor');
        if (!result) return false;
        const _oldValue = result.pageData.cursor;
        result.pageData.cursor = cursor;
        this._recordChange(result.pageData, 'cursor', _oldValue, result.pageData.cursor);
        this._emit('page:cursorChanged', { canvasId, pageId: result.pageData.id, cursor });
        return true;
    }

    /** Retourne cursor d'une page. */
    getPageCursor(canvasId, pageId) {
        const result = this._resolvePageData(canvasId, pageId, 'getPageCursor');
        return result ? result.pageData.cursor : null;
    }


    /* ══════════════════════════════════════════════════════════════
       DESTRUCTION
       ══════════════════════════════════════════════════════════════ */

    /**
     * Détruit toutes les pages d'un canvas.
     * Appelé par CanvasManager.deleteCanvas() ou CanvasManager.destroy().
     * @param {Object} canvasData — Les données du canvas.
     */
    destroyPages(canvasData) {
        canvasData.pages.clear();
        canvasData.pageOrder.length = 0;
        canvasData.activePageId = null;
    }
}


/* ═══════════════════════════════════════════════════════════════════════════
   EXPOSITION GLOBALE
   ═══════════════════════════════════════════════════════════════════════════ */
window.CanvasPageManager = CanvasPageManager;
