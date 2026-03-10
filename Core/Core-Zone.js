/* ═══════════════════════════════════════════════════════════════════════════
   CORE-ZONE.JS — Gestionnaire de zones

   Une zone est le conteneur de premier niveau dans VOH.
   Chaque zone contient un ou plusieurs canvas.
   Une seule zone est visible à la fois (show/hide du conteneur DOM).

   Propriétés d'une zone:
   - id (auto-incrémenté, lecture seule)
   - name (nom affiché)
   - background.color (couleur de fond)
   - background.image (URL ou data:URI de l'image de fond)
   - background.imageOpacity (opacité de l'image de fond, 0.0 à 1.0)
   - grid.width (largeur des cases de la grille)
   - grid.height (hauteur des cases de la grille)
   - grid.color (couleur des lignes de la grille)
   - grid.opacity (opacité de la grille, 0.0 à 1.0)
   - grid.isVisible (afficher ou masquer la grille)
   - viewport.scrollbarIsVisible (scrollbars auto ou masquées)
   - viewport.scrollX, scrollY (position du scroll)
   - viewport.zoom (niveau de zoom)
   - border.color (couleur de la bordure)
   - border.thickness (épaisseur de la bordure)
   - bringCanvasToFrontOnActivation (mise au premier plan auto du canvas activé)

   Licence: Open Source (licence à définir)
   Auteur: David Dieppedalle (ShadowStorm)
   ═══════════════════════════════════════════════════════════════════════════ */

'use strict';


/* ═══════════════════════════════════════════════════════════════════════════
   CONSTANTES
   ═══════════════════════════════════════════════════════════════════════════ */

/** Valeurs par défaut pour une zone nouvellement créée. */
const ZONE_DEFAULT_WIDTH                    = null;  /* null = 100% du conteneur */
const ZONE_DEFAULT_HEIGHT                   = null;  /* null = 100% du conteneur */
const ZONE_DEFAULT_BACKGROUND_COLOR         = 'rgba(83, 83, 83, 1.0)';
const ZONE_DEFAULT_BACKGROUND_IMAGE         = '';
const ZONE_DEFAULT_BACKGROUND_IMAGE_OPACITY = 1.0;
const ZONE_DEFAULT_GRID_WIDTH               = 25;
const ZONE_DEFAULT_GRID_HEIGHT              = 25;
const ZONE_DEFAULT_GRID_COLOR               = 'rgba(0, 0, 0, 1.0)';
const ZONE_DEFAULT_GRID_OPACITY             = 0.15;
const ZONE_DEFAULT_GRID_IS_VISIBLE          = false;
const ZONE_DEFAULT_SCROLLBAR_IS_VISIBLE     = true;  /* true = scrollbars auto, false = masquées */
const ZONE_DEFAULT_ZOOM                     = 1.0;   /* 1.0 = 100%, pas de zoom */
const ZONE_MIN_ZOOM                         = 0.1;   /* 10% minimum */
const ZONE_MAX_ZOOM                         = 5.0;   /* 500% maximum */
const ZONE_ZOOM_STEP                        = 0.1;   /* Palier de zoom (+/- 10%) */
const ZONE_DEFAULT_BORDER_COLOR             = 'rgba(0, 0, 0, 1.0)';
const ZONE_DEFAULT_BORDER_THICKNESS             = 1;
const ZONE_DEFAULT_BRING_CANVAS_TO_FRONT_ON_ACTIVATION = false; /* false = les z-orders ne changent pas à l'activation */


/* ═══════════════════════════════════════════════════════════════════════════
   CLASSE: ZoneManager

   Gère la collection de zones pour une instance de VisualObjectsHandler.
   ═══════════════════════════════════════════════════════════════════════════ */
class ZoneManager {

    /**
     * @param {VisualObjectsHandler} vohInstance — Référence à l'instance parente.
     */
    constructor(vohInstance) {

        /** Référence à l'instance VOH parente. */
        this._voh = vohInstance;

        /** Map des zones: clé = zoneId (number), valeur = objet zone. */
        this._zones = new Map();

        /** Compteur auto-incrémenté pour les IDs de zones. */
        this._zoneIdCounter = 0;

        /** ID de la zone actuellement active (visible). Null si aucune. */
        this._activeZoneId = null;

        /** Référence à l'EventEmitter de l'instance VOH. */
        this._eventEmitter = vohInstance.getEventEmitter();
    }


    /* ══════════════════════════════════════════════════════════════
       ÉMISSION D'ÉVÉNEMENTS (helper interne)
       ══════════════════════════════════════════════════════════════ */

    /**
     * Émet un événement via l'EventEmitter de l'instance VOH.
     * @param {string} eventName — Nom de l'événement (format domaine:action).
     * @param {Object} data — Données de l'événement.
     */
    _emit(eventName, data) {
        if (this._eventEmitter) {
            this._eventEmitter.emit(eventName, data);
        }
    }


    /* ══════════════════════════════════════════════════════════════
       MÉTHODE INTERNE: _getZoneData

       Résout un zoneId en objet de données.
       Affiche un avertissement si la zone n'existe pas.
       ══════════════════════════════════════════════════════════════ */

    /**
     * Résout un zoneId en objet de données.
     * @param {number} zoneId — L'ID de la zone.
     * @param {string} callerName — Nom de la méthode appelante (pour le warning).
     * @returns {Object|null} L'objet zone, ou null si inexistant.
     */
    _getZoneData(zoneId, callerName) {
        const zoneData = this._zones.get(zoneId);
        if (!zoneData) {
            console.warn(`[Zone] ${callerName}: zone ${zoneId} inexistante.`);
            return null;
        }
        return zoneData;
    }


    /* ══════════════════════════════════════════════════════════════
       CRÉATION / SUPPRESSION
       ══════════════════════════════════════════════════════════════ */

    /**
     * Crée une nouvelle zone.
     * @param {Object} [params] — Paramètres optionnels.
     * @param {string} [params.name] — Nom de la zone.
     * @param {number} [params.width] — Largeur en pixels (null = 100% du conteneur).
     * @param {number} [params.height] — Hauteur en pixels (null = 100% du conteneur).
     * @param {string} [params.backgroundColor] — Couleur de fond.
     * @param {string} [params.backgroundImage] — Image de fond (URL ou data:URI).
     * @param {number} [params.backgroundImageOpacity] — Opacité de l'image (0.0 à 1.0).
     * @param {number} [params.gridWidth] — Largeur des cases de la grille.
     * @param {number} [params.gridHeight] — Hauteur des cases de la grille.
     * @param {string} [params.gridColor] — Couleur de la grille.
     * @param {number} [params.gridOpacity] — Opacité de la grille (0.0 à 1.0).
     * @param {boolean} [params.gridIsVisible] — Afficher la grille.
     * @param {boolean} [params.scrollbarIsVisible] — Afficher les scrollbars.
     * @param {number} [params.zoom] — Niveau de zoom initial (1.0 = 100%).
     * @param {string} [params.borderColor] — Couleur de la bordure de zone.
     * @param {number} [params.borderThickness] — Épaisseur de la bordure en pixels.
     * @returns {number} L'ID de la zone créée.
     */
    createZone(params = {}) {

        /* ── Générer l'ID ── */
        this._zoneIdCounter++;
        const zoneId = this._zoneIdCounter;

        /* ── Nom par défaut ── */
        const zoneName = params.name !== undefined ? params.name : ('Zone ' + zoneId);

        /* ── Taille de la zone (null = 100% du conteneur) ── */
        const zoneWidth  = params.width  !== undefined ? params.width  : ZONE_DEFAULT_WIDTH;
        const zoneHeight = params.height !== undefined ? params.height : ZONE_DEFAULT_HEIGHT;

        /* ── Créer le conteneur DOM de la zone ── */
        const zoneElement = document.createElement('div');
        zoneElement.className = 'voh-zone';
        zoneElement.dataset.vohZoneId = zoneId;
        zoneElement.style.position = 'relative';
        zoneElement.style.width    = '100%';
        zoneElement.style.height   = '100%';
        if (zoneWidth  !== null) zoneElement.style.minWidth  = zoneWidth  + 'px';
        if (zoneHeight !== null) zoneElement.style.minHeight = zoneHeight + 'px';
        zoneElement.style.display         = 'none'; /* Masquée par défaut */
        zoneElement.style.overflow        = 'hidden';
        zoneElement.style.transformOrigin = '0 0'; /* Zoom depuis le coin haut-gauche */

        /* ── Couche image de fond (div séparé pour l'opacité indépendante) ── */
        const zoneBackgroundImageElement = document.createElement('div');
        zoneBackgroundImageElement.className = 'voh-zone-background-image';
        zoneBackgroundImageElement.style.position       = 'absolute';
        zoneBackgroundImageElement.style.top             = '0';
        zoneBackgroundImageElement.style.left            = '0';
        zoneBackgroundImageElement.style.width           = '100%';
        zoneBackgroundImageElement.style.height          = '100%';
        zoneBackgroundImageElement.style.pointerEvents   = 'none';
        zoneBackgroundImageElement.style.backgroundSize     = 'cover';
        zoneBackgroundImageElement.style.backgroundPosition = 'center';
        zoneBackgroundImageElement.style.backgroundRepeat   = 'no-repeat';
        zoneElement.appendChild(zoneBackgroundImageElement);

        /* ── Couche grille (canvas dédié pour le dessin de la grille) ── */
        const zoneGridCanvas = document.createElement('canvas');
        zoneGridCanvas.className = 'voh-zone-grid';
        zoneGridCanvas.style.position      = 'absolute';
        zoneGridCanvas.style.top           = '0';
        zoneGridCanvas.style.left          = '0';
        zoneGridCanvas.style.width         = '100%';
        zoneGridCanvas.style.height        = '100%';
        zoneGridCanvas.style.pointerEvents = 'none';
        zoneElement.appendChild(zoneGridCanvas);

        /* ── Conteneur pour les canvas VOH (Pixi.js) ── */
        const zoneCanvasContainer = document.createElement('div');
        zoneCanvasContainer.className = 'voh-zone-canvas-container';
        zoneCanvasContainer.style.position = 'absolute';
        zoneCanvasContainer.style.top      = '0';
        zoneCanvasContainer.style.left     = '0';
        zoneCanvasContainer.style.width    = '100%';
        zoneCanvasContainer.style.height   = '100%';
        zoneElement.appendChild(zoneCanvasContainer);

        /* ── Ajouter au conteneur principal ── */
        this._voh.getContainerElement().appendChild(zoneElement);

        /* ── Objet de données de la zone ── */
        const zoneData = {
            id:   zoneId,
            name: zoneName,

            /* Dimensions (null = 100% du conteneur) */
            width:  zoneWidth,
            height: zoneHeight,

            /* Fond */
            backgroundColor:        params.backgroundColor        !== undefined ? params.backgroundColor        : ZONE_DEFAULT_BACKGROUND_COLOR,
            backgroundImage:        params.backgroundImage        !== undefined ? params.backgroundImage        : ZONE_DEFAULT_BACKGROUND_IMAGE,
            backgroundImageOpacity: params.backgroundImageOpacity !== undefined ? params.backgroundImageOpacity : ZONE_DEFAULT_BACKGROUND_IMAGE_OPACITY,

            /* Grille */
            gridWidth:     params.gridWidth     !== undefined ? params.gridWidth     : ZONE_DEFAULT_GRID_WIDTH,
            gridHeight:    params.gridHeight    !== undefined ? params.gridHeight    : ZONE_DEFAULT_GRID_HEIGHT,
            gridColor:     params.gridColor     !== undefined ? params.gridColor     : ZONE_DEFAULT_GRID_COLOR,
            gridOpacity:   params.gridOpacity   !== undefined ? params.gridOpacity   : ZONE_DEFAULT_GRID_OPACITY,
            gridIsVisible: params.gridIsVisible !== undefined ? params.gridIsVisible : ZONE_DEFAULT_GRID_IS_VISIBLE,

            /* Viewport (scrollbars et position de la vue) */
            scrollbarIsVisible: params.scrollbarIsVisible !== undefined ? params.scrollbarIsVisible : ZONE_DEFAULT_SCROLLBAR_IS_VISIBLE,
            scrollX: 0,
            scrollY: 0,
            zoom: params.zoom !== undefined ? params.zoom : ZONE_DEFAULT_ZOOM,

            /* Bordure */
            borderColor: params.borderColor !== undefined ? params.borderColor : ZONE_DEFAULT_BORDER_COLOR,
            borderThickness: params.borderThickness !== undefined ? params.borderThickness : ZONE_DEFAULT_BORDER_THICKNESS,

            /* Comportement */
            bringCanvasToFrontOnActivation: params.bringCanvasToFrontOnActivation !== undefined ? params.bringCanvasToFrontOnActivation : ZONE_DEFAULT_BRING_CANVAS_TO_FRONT_ON_ACTIVATION,

            /* Références DOM */
            element:                zoneElement,
            backgroundImageElement: zoneBackgroundImageElement,
            gridCanvas:             zoneGridCanvas,
            canvasContainer:        zoneCanvasContainer
        };

        /* ── Stocker la zone ── */
        this._zones.set(zoneId, zoneData);

        /* ── Appliquer les propriétés visuelles ── */
        this._applyZoneBackground(zoneData);
        this._applyZoneBackgroundImage(zoneData);
        this._applyZoneBorder(zoneData);
        this._resizeZoneGridCanvas(zoneData);
        this._renderZoneGrid(zoneData);

        /* ── Initialiser le moteur de rendu Pixi.js pour cette zone (async) ── */
        /* UN seul PIXI.Application par zone = UN seul contexte WebGL.          */
        /* Les canevas de cette zone seront des Containers dans le même stage.  */
        const renderEngine = this._voh._canvasManager ? this._voh._canvasManager._renderEngine : null;
        if (renderEngine) {
            zoneData._rendererInitPromise = renderEngine.initZoneRenderer(zoneData);
        }

        /* ── Si c'est la première zone, l'activer automatiquement ── */
        if (this._zones.size === 1) {
            this.setActiveZone(zoneId);
        }

        /* ── Observer le redimensionnement pour redessiner la grille ── */
        zoneData._resizeObserver = new ResizeObserver(() => {
            this._resizeZoneGridCanvas(zoneData);
            this._renderZoneGrid(zoneData);
        });
        zoneData._resizeObserver.observe(zoneElement);

        console.log(`[Zone] Créée — ID: ${zoneId} — Nom: ${zoneName}`);

        /* ── Émettre l'événement zone:created ── */
        this._emit('zone:created', { zoneId: zoneId, name: zoneName });

        return zoneId;
    }


    /**
     * Supprime une zone.
     * @param {number} zoneId — L'ID de la zone à supprimer.
     * @param {Object} [options] — Options de suppression.
     * @param {boolean} [options.deleteCanvases=true] — true = supprime aussi les canvas de la zone
     *   dans le CanvasManager (libère la mémoire). false = les canvas restent en mémoire
     *   (utile pour une migration vers une autre zone avant suppression).
     * @returns {boolean} true si supprimée, false si échec.
     */
    deleteZone(zoneId, options = {}) {

        const zoneData = this._getZoneData(zoneId, 'deleteZone');
        if (!zoneData) return false;

        /* ── Option: supprimer les canvas associés (par défaut: oui) ── */
        const shouldDeleteCanvases = options.deleteCanvases !== undefined ? options.deleteCanvases : true;

        /* ── Supprimer les canvas de la zone dans le CanvasManager si demandé ── */
        if (shouldDeleteCanvases && this._voh._canvasManager) {
            const canvasManager = this._voh._canvasManager;
            const canvasIds = canvasManager.getCanvasList(zoneId);
            for (const canvasId of canvasIds) {
                canvasManager.deleteCanvas(canvasId);
            }
        }

        /* ── Mémoriser le nom avant suppression (pour l'événement) ── */
        const zoneName = zoneData.name;

        /* ── Arrêter l'observation du redimensionnement ── */
        if (zoneData._resizeObserver) {
            zoneData._resizeObserver.disconnect();
        }

        /* ── Détruire le renderer Pixi.js de la zone ── */
        const renderEngine = this._voh._canvasManager ? this._voh._canvasManager._renderEngine : null;
        if (renderEngine) {
            renderEngine.destroyZoneRenderer(zoneData);
        }

        /* ── Retirer du DOM ── */
        if (zoneData.element && zoneData.element.parentNode) {
            zoneData.element.parentNode.removeChild(zoneData.element);
        }

        /* ── Retirer de la collection ── */
        this._zones.delete(zoneId);

        /* ── Si c'était la zone active, activer la première disponible ── */
        if (this._activeZoneId === zoneId) {

            /* Forcer le navigateur à prendre en compte la suppression du DOM */
            const container = this._voh.getContainerElement();
            void container.offsetHeight;

            if (this._zones.size > 0) {
                /* setActiveZone() lira _activeZoneId pour le previousZoneId correct */
                const premiereZoneId = this._zones.keys().next().value;
                this.setActiveZone(premiereZoneId);
            } else {
                /* Plus aucune zone — réinitialiser */
                this._activeZoneId = null;
            }
        }

        console.log(`[Zone] Supprimée — ID: ${zoneId} — Zones restantes: ${this._zones.size}`);

        /* ── Émettre l'événement zone:deleted ── */
        this._emit('zone:deleted', { zoneId: zoneId, name: zoneName });

        return true;
    }


    /* ══════════════════════════════════════════════════════════════
       ZONE ACTIVE (VISIBILITÉ)
       ══════════════════════════════════════════════════════════════ */

    /**
     * Active une zone (la rend visible) et masque toutes les autres.
     * @param {number} zoneId — L'ID de la zone à activer.
     * @returns {boolean} true si activée, false si échec.
     */
    setActiveZone(zoneId) {

        const zoneData = this._getZoneData(zoneId, 'setActiveZone');
        if (!zoneData) return false;

        /* ── Sauvegarder l'ancienne zone active (pour l'événement) ── */
        const previousZoneId = this._activeZoneId;

        /* ── Sauvegarder la position de scroll de la zone sortante ── */
        const container = this._voh.getContainerElement();
        if (this._activeZoneId !== null) {
            const ancienneZone = this._zones.get(this._activeZoneId);
            if (ancienneZone) {
                ancienneZone.scrollX = container.scrollLeft;
                ancienneZone.scrollY = container.scrollTop;
            }
        }

        /* ── Masquer toutes les zones ── */
        for (const [, zone] of this._zones) {
            zone.element.style.display = 'none';
        }

        /* ── Afficher la zone demandée ── */
        zoneData.element.style.display = 'block';
        this._activeZoneId = zoneId;

        /* ── Appliquer le viewport de la zone entrante (zoom, scrollbars, scroll) ── */
        zoneData.element.style.zoom = zoneData.zoom;
        container.style.overflow = zoneData.scrollbarIsVisible ? 'auto' : 'hidden';
        container.scrollLeft = zoneData.scrollX;
        container.scrollTop  = zoneData.scrollY;

        /* ── Redimensionner et redessiner la grille (elle a pu changer de taille) ── */
        this._resizeZoneGridCanvas(zoneData);
        this._renderZoneGrid(zoneData);

        /* ── Émettre l'événement zone:activated ── */
        this._emit('zone:activated', { zoneId: zoneId, previousZoneId: previousZoneId });

        return true;
    }

    /**
     * Retourne l'ID de la zone actuellement active.
     * @returns {number|null} L'ID de la zone active, ou null si aucune.
     */
    getActiveZoneId() {
        return this._activeZoneId;
    }


    /* ══════════════════════════════════════════════════════════════
       INFORMATIONS
       ══════════════════════════════════════════════════════════════ */

    /**
     * Retourne le nombre de zones.
     * @returns {number}
     */
    getZoneCount() {
        return this._zones.size;
    }

    /**
     * Retourne la liste des IDs de toutes les zones.
     * @returns {number[]}
     */
    getZoneList() {
        return Array.from(this._zones.keys());
    }

    /**
     * Vérifie si une zone existe.
     * @param {number} zoneId — L'ID à vérifier.
     * @returns {boolean}
     */
    zoneExists(zoneId) {
        return this._zones.has(zoneId);
    }

    /**
     * Retourne le conteneur DOM des canvas d'une zone.
     * Utilisé par le CanvasManager pour y insérer les canvas Pixi.js.
     * @param {number} zoneId — L'ID de la zone.
     * @returns {HTMLElement|null}
     */
    getZoneCanvasContainer(zoneId) {
        const zoneData = this._getZoneData(zoneId, 'getZoneCanvasContainer');
        return zoneData ? zoneData.canvasContainer : null;
    }


    /* ══════════════════════════════════════════════════════════════
       PROPRIÉTÉS — DIMENSIONS
       ══════════════════════════════════════════════════════════════ */

    /**
     * Définit la largeur d'une zone en pixels (null = 100% du conteneur).
     * @param {number} zoneId
     * @param {number|null} width
     * @returns {boolean}
     */
    setZoneWidth(zoneId, width) {
        const zoneData = this._getZoneData(zoneId, 'setZoneWidth');
        if (!zoneData) return false;
        zoneData.width = width;
        zoneData.element.style.width    = '100%';
        zoneData.element.style.minWidth = width !== null ? (width + 'px') : '';
        this._resizeZoneGridCanvas(zoneData);
        this._renderZoneGrid(zoneData);
        this._emit('zone:resized', { zoneId: zoneId, width: zoneData.width, height: zoneData.height });
        return true;
    }

    /**
     * Retourne la largeur configurée d'une zone (null si 100%).
     * @param {number} zoneId
     * @returns {number|null}
     */
    getZoneWidth(zoneId) {
        const zoneData = this._getZoneData(zoneId, 'getZoneWidth');
        return zoneData ? zoneData.width : null;
    }

    /**
     * Définit la hauteur d'une zone en pixels (null = 100% du conteneur).
     * @param {number} zoneId
     * @param {number|null} height
     * @returns {boolean}
     */
    setZoneHeight(zoneId, height) {
        const zoneData = this._getZoneData(zoneId, 'setZoneHeight');
        if (!zoneData) return false;
        zoneData.height = height;
        zoneData.element.style.height    = '100%';
        zoneData.element.style.minHeight = height !== null ? (height + 'px') : '';
        this._resizeZoneGridCanvas(zoneData);
        this._renderZoneGrid(zoneData);
        this._emit('zone:resized', { zoneId: zoneId, width: zoneData.width, height: zoneData.height });
        return true;
    }

    /**
     * Retourne la hauteur configurée d'une zone (null si 100%).
     * @param {number} zoneId
     * @returns {number|null}
     */
    getZoneHeight(zoneId) {
        const zoneData = this._getZoneData(zoneId, 'getZoneHeight');
        return zoneData ? zoneData.height : null;
    }


    /* ══════════════════════════════════════════════════════════════
       PROPRIÉTÉS — NOM
       ══════════════════════════════════════════════════════════════ */

    /**
     * Définit le nom d'une zone.
     * @param {number} zoneId
     * @param {string} name
     * @returns {boolean}
     */
    setZoneName(zoneId, name) {
        const zoneData = this._getZoneData(zoneId, 'setZoneName');
        if (!zoneData) return false;
        zoneData.name = name;
        this._emit('zone:renamed', { zoneId: zoneId, name: name });
        return true;
    }

    /**
     * Retourne le nom d'une zone.
     * @param {number} zoneId
     * @returns {string|null}
     */
    getZoneName(zoneId) {
        const zoneData = this._getZoneData(zoneId, 'getZoneName');
        return zoneData ? zoneData.name : null;
    }


    /* ══════════════════════════════════════════════════════════════
       PROPRIÉTÉS — FOND
       ══════════════════════════════════════════════════════════════ */

    /**
     * Définit la couleur de fond d'une zone.
     * @param {number} zoneId
     * @param {string} color — Couleur CSS (ex: 'rgba(83, 83, 83, 1.0)', '#535353').
     * @returns {boolean}
     */
    setZoneBackgroundColor(zoneId, color) {
        const zoneData = this._getZoneData(zoneId, 'setZoneBackgroundColor');
        if (!zoneData) return false;
        zoneData.backgroundColor = color;
        this._applyZoneBackground(zoneData);
        this._emit('zone:backgroundChanged', { zoneId: zoneId, property: 'backgroundColor', value: color });
        return true;
    }

    /**
     * Retourne la couleur de fond d'une zone.
     * @param {number} zoneId
     * @returns {string|null}
     */
    getZoneBackgroundColor(zoneId) {
        const zoneData = this._getZoneData(zoneId, 'getZoneBackgroundColor');
        return zoneData ? zoneData.backgroundColor : null;
    }

    /**
     * Définit l'image de fond d'une zone.
     * @param {number} zoneId
     * @param {string} image — URL ou data:URI de l'image. Chaîne vide pour enlever.
     * @returns {boolean}
     */
    setZoneBackgroundImage(zoneId, image) {
        const zoneData = this._getZoneData(zoneId, 'setZoneBackgroundImage');
        if (!zoneData) return false;
        zoneData.backgroundImage = image;
        this._applyZoneBackgroundImage(zoneData);
        this._emit('zone:backgroundChanged', { zoneId: zoneId, property: 'backgroundImage', value: image });
        return true;
    }

    /**
     * Retourne l'URL de l'image de fond d'une zone.
     * @param {number} zoneId
     * @returns {string|null}
     */
    getZoneBackgroundImage(zoneId) {
        const zoneData = this._getZoneData(zoneId, 'getZoneBackgroundImage');
        return zoneData ? zoneData.backgroundImage : null;
    }

    /**
     * Définit l'opacité de l'image de fond d'une zone (0.0 à 1.0).
     * @param {number} zoneId
     * @param {number} opacity
     * @returns {boolean}
     */
    setZoneBackgroundImageOpacity(zoneId, opacity) {
        const zoneData = this._getZoneData(zoneId, 'setZoneBackgroundImageOpacity');
        if (!zoneData) return false;
        zoneData.backgroundImageOpacity = Math.max(0, Math.min(1, opacity));
        this._applyZoneBackgroundImage(zoneData);
        this._emit('zone:backgroundChanged', { zoneId: zoneId, property: 'backgroundImageOpacity', value: zoneData.backgroundImageOpacity });
        return true;
    }

    /**
     * Retourne l'opacité de l'image de fond d'une zone.
     * @param {number} zoneId
     * @returns {number|null}
     */
    getZoneBackgroundImageOpacity(zoneId) {
        const zoneData = this._getZoneData(zoneId, 'getZoneBackgroundImageOpacity');
        return zoneData ? zoneData.backgroundImageOpacity : null;
    }


    /* ══════════════════════════════════════════════════════════════
       PROPRIÉTÉS — GRILLE
       ══════════════════════════════════════════════════════════════ */

    /**
     * Définit la largeur des cases de la grille (en pixels, minimum 1).
     * @param {number} zoneId
     * @param {number} width
     * @returns {boolean}
     */
    setZoneGridWidth(zoneId, width) {
        const zoneData = this._getZoneData(zoneId, 'setZoneGridWidth');
        if (!zoneData) return false;
        zoneData.gridWidth = Math.max(1, width);
        this._renderZoneGrid(zoneData);
        this._emit('zone:gridChanged', { zoneId: zoneId, property: 'gridWidth', value: zoneData.gridWidth });
        return true;
    }

    /**
     * Retourne la largeur des cases de la grille.
     * @param {number} zoneId
     * @returns {number|null}
     */
    getZoneGridWidth(zoneId) {
        const zoneData = this._getZoneData(zoneId, 'getZoneGridWidth');
        return zoneData ? zoneData.gridWidth : null;
    }

    /**
     * Définit la hauteur des cases de la grille (en pixels, minimum 1).
     * @param {number} zoneId
     * @param {number} height
     * @returns {boolean}
     */
    setZoneGridHeight(zoneId, height) {
        const zoneData = this._getZoneData(zoneId, 'setZoneGridHeight');
        if (!zoneData) return false;
        zoneData.gridHeight = Math.max(1, height);
        this._renderZoneGrid(zoneData);
        this._emit('zone:gridChanged', { zoneId: zoneId, property: 'gridHeight', value: zoneData.gridHeight });
        return true;
    }

    /**
     * Retourne la hauteur des cases de la grille.
     * @param {number} zoneId
     * @returns {number|null}
     */
    getZoneGridHeight(zoneId) {
        const zoneData = this._getZoneData(zoneId, 'getZoneGridHeight');
        return zoneData ? zoneData.gridHeight : null;
    }

    /**
     * Définit la couleur des lignes de la grille.
     * @param {number} zoneId
     * @param {string} color — Couleur CSS.
     * @returns {boolean}
     */
    setZoneGridColor(zoneId, color) {
        const zoneData = this._getZoneData(zoneId, 'setZoneGridColor');
        if (!zoneData) return false;
        zoneData.gridColor = color;
        this._renderZoneGrid(zoneData);
        this._emit('zone:gridChanged', { zoneId: zoneId, property: 'gridColor', value: color });
        return true;
    }

    /**
     * Retourne la couleur des lignes de la grille.
     * @param {number} zoneId
     * @returns {string|null}
     */
    getZoneGridColor(zoneId) {
        const zoneData = this._getZoneData(zoneId, 'getZoneGridColor');
        return zoneData ? zoneData.gridColor : null;
    }

    /**
     * Définit l'opacité de la grille (0.0 = invisible, 1.0 = opaque).
     * @param {number} zoneId
     * @param {number} opacity
     * @returns {boolean}
     */
    setZoneGridOpacity(zoneId, opacity) {
        const zoneData = this._getZoneData(zoneId, 'setZoneGridOpacity');
        if (!zoneData) return false;
        zoneData.gridOpacity = Math.max(0, Math.min(1, opacity));
        this._renderZoneGrid(zoneData);
        this._emit('zone:gridChanged', { zoneId: zoneId, property: 'gridOpacity', value: zoneData.gridOpacity });
        return true;
    }

    /**
     * Retourne l'opacité de la grille.
     * @param {number} zoneId
     * @returns {number|null}
     */
    getZoneGridOpacity(zoneId) {
        const zoneData = this._getZoneData(zoneId, 'getZoneGridOpacity');
        return zoneData ? zoneData.gridOpacity : null;
    }

    /**
     * Affiche ou masque la grille de la zone.
     * @param {number} zoneId
     * @param {boolean} visible
     * @returns {boolean}
     */
    setZoneGridVisible(zoneId, visible) {
        const zoneData = this._getZoneData(zoneId, 'setZoneGridVisible');
        if (!zoneData) return false;
        zoneData.gridIsVisible = !!visible;
        this._renderZoneGrid(zoneData);
        this._emit('zone:gridChanged', { zoneId: zoneId, property: 'gridIsVisible', value: zoneData.gridIsVisible });
        return true;
    }

    /**
     * Retourne true si la grille est visible.
     * @param {number} zoneId
     * @returns {boolean|null}
     */
    getZoneGridVisible(zoneId) {
        const zoneData = this._getZoneData(zoneId, 'getZoneGridVisible');
        return zoneData ? zoneData.gridIsVisible : null;
    }


    /* ══════════════════════════════════════════════════════════════
       PROPRIÉTÉS — VIEWPORT (scrollbars et position de la vue)
       ══════════════════════════════════════════════════════════════ */

    /**
     * Définit la visibilité des scrollbars pour une zone.
     * true = scrollbars automatiques (overflow: auto).
     * false = masquées (overflow: hidden).
     * Appliqué immédiatement si c'est la zone active.
     * @param {number} zoneId
     * @param {boolean} visible
     * @returns {boolean}
     */
    setZoneScrollbarVisible(zoneId, visible) {
        const zoneData = this._getZoneData(zoneId, 'setZoneScrollbarVisible');
        if (!zoneData) return false;
        zoneData.scrollbarIsVisible = !!visible;

        /* Appliquer immédiatement si c'est la zone active */
        if (this._activeZoneId === zoneId) {
            this._voh.getContainerElement().style.overflow = visible ? 'auto' : 'hidden';
        }
        this._emit('zone:scrollbarVisibleChanged', { zoneId: zoneId, visible: zoneData.scrollbarIsVisible });
        return true;
    }

    /**
     * Retourne true si les scrollbars sont visibles.
     * @param {number} zoneId
     * @returns {boolean|null}
     */
    getZoneScrollbarVisible(zoneId) {
        const zoneData = this._getZoneData(zoneId, 'getZoneScrollbarVisible');
        return zoneData ? zoneData.scrollbarIsVisible : null;
    }

    /**
     * Définit la position horizontale du scroll.
     * Appliqué immédiatement si c'est la zone active.
     * @param {number} zoneId
     * @param {number} x — Position en pixels.
     * @returns {boolean}
     */
    setZoneScrollX(zoneId, x) {
        const zoneData = this._getZoneData(zoneId, 'setZoneScrollX');
        if (!zoneData) return false;
        zoneData.scrollX = Math.max(0, x);

        if (this._activeZoneId === zoneId) {
            this._voh.getContainerElement().scrollLeft = zoneData.scrollX;
        }
        this._emit('zone:scrollChanged', { zoneId: zoneId, scrollX: zoneData.scrollX, scrollY: zoneData.scrollY });
        return true;
    }

    /**
     * Retourne la position horizontale du scroll.
     * Si c'est la zone active, lit la vraie position depuis le DOM.
     * @param {number} zoneId
     * @returns {number|null}
     */
    getZoneScrollX(zoneId) {
        const zoneData = this._getZoneData(zoneId, 'getZoneScrollX');
        if (!zoneData) return null;

        if (this._activeZoneId === zoneId) {
            return this._voh.getContainerElement().scrollLeft;
        }
        return zoneData.scrollX;
    }

    /**
     * Définit la position verticale du scroll.
     * Appliqué immédiatement si c'est la zone active.
     * @param {number} zoneId
     * @param {number} y — Position en pixels.
     * @returns {boolean}
     */
    setZoneScrollY(zoneId, y) {
        const zoneData = this._getZoneData(zoneId, 'setZoneScrollY');
        if (!zoneData) return false;
        zoneData.scrollY = Math.max(0, y);

        if (this._activeZoneId === zoneId) {
            this._voh.getContainerElement().scrollTop = zoneData.scrollY;
        }
        this._emit('zone:scrollChanged', { zoneId: zoneId, scrollX: zoneData.scrollX, scrollY: zoneData.scrollY });
        return true;
    }

    /**
     * Retourne la position verticale du scroll.
     * Si c'est la zone active, lit la vraie position depuis le DOM.
     * @param {number} zoneId
     * @returns {number|null}
     */
    getZoneScrollY(zoneId) {
        const zoneData = this._getZoneData(zoneId, 'getZoneScrollY');
        if (!zoneData) return null;

        if (this._activeZoneId === zoneId) {
            return this._voh.getContainerElement().scrollTop;
        }
        return zoneData.scrollY;
    }

    /**
     * Centre la vue sur le contenu de la zone.
     * Le centrage place le milieu de la zone au milieu de la vue visible.
     * @param {number} zoneId
     * @returns {boolean}
     */
    scrollZoneToCenter(zoneId) {
        const zoneData = this._getZoneData(zoneId, 'scrollZoneToCenter');
        if (!zoneData) return false;

        const container = this._voh.getContainerElement();

        /* Calculer le centre de la zone */
        const contentWidth  = zoneData.element.scrollWidth;
        const contentHeight = zoneData.element.scrollHeight;
        const viewWidth     = container.clientWidth;
        const viewHeight    = container.clientHeight;

        const centerX = Math.max(0, (contentWidth  - viewWidth)  / 2);
        const centerY = Math.max(0, (contentHeight - viewHeight) / 2);

        zoneData.scrollX = centerX;
        zoneData.scrollY = centerY;

        if (this._activeZoneId === zoneId) {
            container.scrollLeft = centerX;
            container.scrollTop  = centerY;
        }
        this._emit('zone:scrollChanged', { zoneId: zoneId, scrollX: zoneData.scrollX, scrollY: zoneData.scrollY });
        return true;
    }


    /* ══════════════════════════════════════════════════════════════
       PROPRIÉTÉS — ZOOM
       ══════════════════════════════════════════════════════════════ */

    /**
     * Méthode interne: applique le zoom CSS et ajuste le scroll pour
     * que le point central de la vue reste au même endroit.
     * @param {Object} zoneData — Données de la zone.
     * @param {number} oldZoom — Ancien niveau de zoom.
     * @param {number} newZoom — Nouveau niveau de zoom.
     */
    _applyZoneZoomWithCenterPreservation(zoneData, oldZoom, newZoom) {
        const container = this._voh.getContainerElement();

        /* Calculer le point central actuel en coordonnées non-zoomées */
        const centerContentX = (container.scrollLeft + container.clientWidth  / 2) / oldZoom;
        const centerContentY = (container.scrollTop  + container.clientHeight / 2) / oldZoom;

        /* Appliquer le nouveau zoom CSS */
        zoneData.element.style.zoom = newZoom;

        /* Recalculer le scroll pour garder le même point central visible */
        const newScrollX = Math.max(0, centerContentX * newZoom - container.clientWidth  / 2);
        const newScrollY = Math.max(0, centerContentY * newZoom - container.clientHeight / 2);

        container.scrollLeft = newScrollX;
        container.scrollTop  = newScrollY;

        /* Mettre à jour les données sauvegardées */
        zoneData.scrollX = container.scrollLeft;
        zoneData.scrollY = container.scrollTop;
    }

    /**
     * Définit le niveau de zoom d'une zone.
     * Le zoom affecte tout le contenu de la zone (grille, canvas, objets).
     * La vue est ajustée pour préserver le point central visible.
     * Borné entre ZONE_MIN_ZOOM (0.1) et ZONE_MAX_ZOOM (5.0).
     * @param {number} zoneId
     * @param {number} level — Niveau de zoom (1.0 = 100%).
     * @returns {boolean}
     */
    setZoneZoom(zoneId, level) {
        const zoneData = this._getZoneData(zoneId, 'setZoneZoom');
        if (!zoneData) return false;

        const oldZoom = zoneData.zoom;
        const newZoom = Math.min(ZONE_MAX_ZOOM, Math.max(ZONE_MIN_ZOOM, level));
        zoneData.zoom = newZoom;

        if (this._activeZoneId === zoneId) {
            this._applyZoneZoomWithCenterPreservation(zoneData, oldZoom, newZoom);
        }
        this._emit('zone:zoomChanged', { zoneId: zoneId, zoom: newZoom, previousZoom: oldZoom });
        return true;
    }

    /**
     * Retourne le niveau de zoom actuel d'une zone.
     * @param {number} zoneId
     * @returns {number|null} — Niveau de zoom (1.0 = 100%) ou null.
     */
    getZoneZoom(zoneId) {
        const zoneData = this._getZoneData(zoneId, 'getZoneZoom');
        return zoneData ? zoneData.zoom : null;
    }

    /**
     * Augmente le zoom d'un palier (+10%).
     * @param {number} zoneId
     * @returns {boolean}
     */
    zoneZoomIn(zoneId) {
        const zoneData = this._getZoneData(zoneId, 'zoneZoomIn');
        if (!zoneData) return false;
        return this.setZoneZoom(zoneId, zoneData.zoom + ZONE_ZOOM_STEP);
    }

    /**
     * Diminue le zoom d'un palier (-10%).
     * @param {number} zoneId
     * @returns {boolean}
     */
    zoneZoomOut(zoneId) {
        const zoneData = this._getZoneData(zoneId, 'zoneZoomOut');
        if (!zoneData) return false;
        return this.setZoneZoom(zoneId, zoneData.zoom - ZONE_ZOOM_STEP);
    }

    /**
     * Remet le zoom à 1.0 (100%).
     * @param {number} zoneId
     * @returns {boolean}
     */
    resetZoneZoom(zoneId) {
        return this.setZoneZoom(zoneId, ZONE_DEFAULT_ZOOM);
    }


    /* ══════════════════════════════════════════════════════════════
       PROPRIÉTÉS — BORDURE
       ══════════════════════════════════════════════════════════════ */

    /**
     * Définit la couleur de la bordure de la zone.
     * @param {number} zoneId
     * @param {string} color — Couleur CSS.
     * @returns {boolean}
     */
    setZoneBorderColor(zoneId, color) {
        const zoneData = this._getZoneData(zoneId, 'setZoneBorderColor');
        if (!zoneData) return false;
        zoneData.borderColor = color;
        this._applyZoneBorder(zoneData);
        this._emit('zone:borderChanged', { zoneId: zoneId, property: 'borderColor', value: color });
        return true;
    }

    /**
     * Retourne la couleur de la bordure.
     * @param {number} zoneId
     * @returns {string|null}
     */
    getZoneBorderColor(zoneId) {
        const zoneData = this._getZoneData(zoneId, 'getZoneBorderColor');
        return zoneData ? zoneData.borderColor : null;
    }

    /**
     * Définit l'épaisseur de la bordure en pixels (0 = pas de bordure).
     * @param {number} zoneId
     * @param {number} width
     * @returns {boolean}
     */
    setZoneBorderThickness(zoneId, thickness) {
        const zoneData = this._getZoneData(zoneId, 'setZoneBorderThickness');
        if (!zoneData) return false;
        zoneData.borderThickness = thickness;
        this._applyZoneBorder(zoneData);
        this._emit('zone:borderChanged', { zoneId: zoneId, property: 'borderThickness', value: thickness });
        return true;
    }

    /**
     * Retourne l'épaisseur de la bordure en pixels.
     * @param {number} zoneId
     * @returns {number|null}
     */
    getZoneBorderThickness(zoneId) {
        const zoneData = this._getZoneData(zoneId, 'getZoneBorderThickness');
        return zoneData ? zoneData.borderThickness : null;
    }


    /* ══════════════════════════════════════════════════════════════
       COMPORTEMENT — ACTIVATION DES CANVAS
       ══════════════════════════════════════════════════════════════ */

    /**
     * Active ou désactive la mise au premier plan automatique du canvas à l'activation.
     * Si activé, activer un canvas le place automatiquement devant tous les autres (z-order max).
     * Si désactivé (par défaut), activer un canvas ne modifie pas les z-orders.
     * @param {number} zoneId — L'ID de la zone.
     * @param {boolean} enabled — true pour activer, false pour désactiver.
     * @returns {boolean} true si réussi, false si zone inexistante.
     */
    setZoneBringCanvasToFrontOnActivation(zoneId, enabled) {
        const zoneData = this._getZoneData(zoneId, 'setZoneBringCanvasToFrontOnActivation');
        if (!zoneData) return false;
        const booleanValue = !!enabled;
        if (zoneData.bringCanvasToFrontOnActivation === booleanValue) return true;
        zoneData.bringCanvasToFrontOnActivation = booleanValue;
        this._emit('zone:bringCanvasToFrontOnActivationChanged', { zoneId: zoneId, enabled: booleanValue });
        return true;
    }

    /**
     * Retourne l'état de l'option bringCanvasToFrontOnActivation.
     * @param {number} zoneId — L'ID de la zone.
     * @returns {boolean|null} true/false ou null si zone inexistante.
     */
    getZoneBringCanvasToFrontOnActivation(zoneId) {
        const zoneData = this._getZoneData(zoneId, 'getZoneBringCanvasToFrontOnActivation');
        return zoneData ? zoneData.bringCanvasToFrontOnActivation : null;
    }


    /* ══════════════════════════════════════════════════════════════
       RENDU INTERNE — FOND
       ══════════════════════════════════════════════════════════════ */

    /**
     * Applique la couleur de fond sur l'élément DOM de la zone.
     * @param {Object} zoneData — Données de la zone.
     */
    _applyZoneBackground(zoneData) {
        zoneData.element.style.backgroundColor = zoneData.backgroundColor;
    }

    /**
     * Applique l'image de fond et son opacité.
     * L'image est dans un div séparé pour contrôler l'opacité indépendamment.
     * @param {Object} zoneData — Données de la zone.
     */
    _applyZoneBackgroundImage(zoneData) {
        const imageElement = zoneData.backgroundImageElement;
        if (zoneData.backgroundImage) {
            imageElement.style.backgroundImage = 'url("' + zoneData.backgroundImage + '")';
            imageElement.style.opacity = zoneData.backgroundImageOpacity;
            imageElement.style.display = 'block';
        } else {
            imageElement.style.backgroundImage = 'none';
            imageElement.style.display = 'none';
        }
    }


    /* ══════════════════════════════════════════════════════════════
       RENDU INTERNE — BORDURE
       ══════════════════════════════════════════════════════════════ */

    /**
     * Applique la bordure sur l'élément DOM de la zone.
     * @param {Object} zoneData — Données de la zone.
     */
    _applyZoneBorder(zoneData) {
        const element = zoneData.element;
        if (zoneData.borderThickness > 0) {
            element.style.border = zoneData.borderThickness + 'px solid ' + zoneData.borderColor;
        } else {
            element.style.border = 'none';
        }
    }


    /* ══════════════════════════════════════════════════════════════
       RENDU INTERNE — GRILLE

       La grille est dessinée sur un canvas HTML5 dédié (Canvas2D),
       superposé à la zone. Ce canvas est séparé du rendu
       Pixi.js qui sera dans les canvas VOH.
       ══════════════════════════════════════════════════════════════ */

    /**
     * Synchronise la taille du canvas de grille avec le conteneur.
     * Gère la résolution HiDPI (Retina / écrans haute densité).
     * @param {Object} zoneData — Données de la zone.
     */
    _resizeZoneGridCanvas(zoneData) {
        const canvas       = zoneData.gridCanvas;
        const parentWidth  = zoneData.element.offsetWidth;
        const parentHeight = zoneData.element.offsetHeight;
        const dpr          = window.devicePixelRatio || 1;

        /* Résolution interne = taille CSS × devicePixelRatio pour la netteté */
        const targetWidth  = Math.floor(parentWidth * dpr);
        const targetHeight = Math.floor(parentHeight * dpr);

        if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
            canvas.width  = targetWidth;
            canvas.height = targetHeight;
            /* La taille d'affichage CSS reste en pixels logiques */
            canvas.style.width  = parentWidth  + 'px';
            canvas.style.height = parentHeight + 'px';
        }
    }

    /**
     * Dessine la grille de la zone sur son canvas dédié.
     * Utilise le demi-pixel (+ 0.5) pour des lignes nettes de 1px.
     * @param {Object} zoneData — Données de la zone.
     */
    _renderZoneGrid(zoneData) {

        const canvas  = zoneData.gridCanvas;
        const context = canvas.getContext('2d');
        const dpr     = window.devicePixelRatio || 1;

        /* Dimensions logiques (CSS) de la zone */
        const logicalWidth  = canvas.width  / dpr;
        const logicalHeight = canvas.height / dpr;

        /* ── Effacer le canvas de grille ── */
        context.clearRect(0, 0, canvas.width, canvas.height);

        /* ── Ne rien dessiner si la grille est masquée ── */
        if (!zoneData.gridIsVisible) return;

        /* ── Paramètres de la grille ── */
        const cellWidth   = zoneData.gridWidth;
        const cellHeight  = zoneData.gridHeight;
        const gridColor   = zoneData.gridColor;
        const gridOpacity = zoneData.gridOpacity;

        if (cellWidth < 1 || cellHeight < 1) return;

        /* ── Dessiner les lignes avec mise à l'échelle HiDPI ── */
        context.save();
        context.scale(dpr, dpr);
        context.globalAlpha  = gridOpacity;
        context.strokeStyle  = gridColor;
        context.lineWidth    = 1;

        /* Lignes verticales */
        context.beginPath();
        for (let x = cellWidth; x < logicalWidth; x += cellWidth) {
            const xPixel = Math.floor(x) + 0.5; /* Alignement demi-pixel pour netteté */
            context.moveTo(xPixel, 0);
            context.lineTo(xPixel, logicalHeight);
        }

        /* Lignes horizontales */
        for (let y = cellHeight; y < logicalHeight; y += cellHeight) {
            const yPixel = Math.floor(y) + 0.5;
            context.moveTo(0, yPixel);
            context.lineTo(logicalWidth, yPixel);
        }
        context.stroke();

        context.restore();
    }


    /* ══════════════════════════════════════════════════════════════
       DESTRUCTION
       ══════════════════════════════════════════════════════════════ */

    /**
     * Détruit toutes les zones et libère les ressources.
     */
    destroy() {
        for (const [, zoneData] of this._zones) {
            /* Arrêter l'observation du redimensionnement */
            if (zoneData._resizeObserver) {
                zoneData._resizeObserver.disconnect();
            }
            /* Retirer du DOM */
            if (zoneData.element && zoneData.element.parentNode) {
                zoneData.element.parentNode.removeChild(zoneData.element);
            }
        }
        this._zones.clear();
        this._activeZoneId = null;
        this._eventEmitter = null;
        console.log('[Zone] Toutes les zones détruites.');
    }
}


/* ═══════════════════════════════════════════════════════════════════════════
   EXPOSITION GLOBALE
   ═══════════════════════════════════════════════════════════════════════════ */
window.ZoneManager = ZoneManager;
