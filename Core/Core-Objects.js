/* ═══════════════════════════════════════════════════════════════════════════
   CORE-OBJECTS.JS — Gestionnaire d'objets du moteur VOH v5

   Un objet est une forme visuelle positionnée sur un canevas.
   Chaque canevas peut contenir 0 ou plusieurs objets indépendants.
   Les objets sont rendus sous forme de rectangles (par défaut gris clair).

   L'apparence peut être entièrement personnalisée via un callback de
   dessin (drawingCallback), comme SetObjectDrawingCallback() dans
   Editors Factory. Ce callback reçoit un contexte Canvas 2D et les
   dimensions de l'objet, puis dessine ce qu'il veut.

   Étape 1 — Objets nus (fondation):
   - Création / suppression sur un canevas
   - Nom personnalisable
   - Position X, Y sur le canevas
   - Dimensions (largeur, hauteur)
   - Z-order (couche d'affichage)
   - Verrouillage
   - Visibilité
   - Opacité
   - Callback de dessin personnalisé
   - Événements de base

   Licence: Open Source (licence à définir)
   Auteur: David Dieppedalle (ShadowStorm)
   ═══════════════════════════════════════════════════════════════════════════ */

'use strict';


/* ═══════════════════════════════════════════════════════════════════════════
   CONSTANTES — Valeurs par défaut pour un nouvel objet
   ═══════════════════════════════════════════════════════════════════════════ */

/** Position X par défaut sur le canevas (pixels). */
const OBJECT_DEFAULT_X = 50;

/** Position Y par défaut sur le canevas (pixels). */
const OBJECT_DEFAULT_Y = 50;

/** Largeur par défaut (pixels). */
const OBJECT_DEFAULT_WIDTH = 150;

/** Hauteur par défaut (pixels). */
const OBJECT_DEFAULT_HEIGHT = 100;

/** Couleur de fond par défaut — rectangle gris clair ("objet nu"). */
const OBJECT_DEFAULT_BACKGROUND_COLOR = 'rgba(200, 200, 200, 1.0)';

/** L'objet est déverrouillé par défaut. */
const OBJECT_DEFAULT_IS_LOCKED = false;

/** L'objet est visible par défaut. */
const OBJECT_DEFAULT_IS_VISIBLE = true;

/** Opacité par défaut (1.0 = complètement opaque). */
const OBJECT_DEFAULT_OPACITY = 1.0;

/** Taille minimum d'un objet en pixels (largeur et hauteur). */
const OBJECT_MINIMUM_SIZE = 5;

/** Couleur par défaut du contour de sélection d'un objet. */
const OBJECT_DEFAULT_SELECTION_BORDER_COLOR = 'rgba(0, 120, 215, 0.9)';

/** Épaisseur par défaut du contour de sélection (pixels). */
const OBJECT_DEFAULT_SELECTION_BORDER_THICKNESS = 1;

/** Marge entre l'objet et le contour de sélection (pixels). 0 = collé à l'extérieur. Négatif = par-dessus l'objet. */
const OBJECT_DEFAULT_SELECTION_BORDER_OFFSET = 0;

/** Style du contour de sélection par défaut ('solid', 'dashed', 'dotted'). */
const OBJECT_DEFAULT_SELECTION_BORDER_STYLE = 'solid';

/** Styles de contour de sélection valides. */
const OBJECT_SELECTION_BORDER_STYLES_VALID = ['solid', 'dashed', 'dotted'];

/**
 * Mode de sélection par rectangle par défaut pour un objet.
 * 'enclosed' (défaut) = l'objet doit être entièrement dans le rectangle.
 * 'intersect' = l'objet est sélectionné dès qu'il touche le rectangle (même partiellement).
 * 'enclosed'  = l'objet doit être entièrement contenu dans le rectangle.
 */
const OBJECT_DEFAULT_SELECTION_MODE = 'enclosed';

/** Modes de sélection valides pour un objet. */
const OBJECT_SELECTION_MODES_VALID = ['intersect', 'enclosed'];


/* ═══════════════════════════════════════════════════════════════════════════
   CLASSE: ObjectManager

   Gère tous les objets de l'instance VOH. Un objet appartient à un canevas.
   L'ObjectManager est global à l'instance (pas un par canevas).
   ═══════════════════════════════════════════════════════════════════════════ */
class ObjectManager {

    /**
     * @param {VisualObjectsHandler} vohInstance — Référence à l'instance VOH parente.
     */
    constructor(vohInstance) {

        /** Référence à l'instance VOH parente. */
        this._voh = vohInstance;

        /** Map de tous les objets: objectId → objectData. */
        this._objects = new Map();

        /** Compteur d'IDs auto-incrémenté. */
        this._objectIdCounter = 0;

        /** Compteur de z-order auto-incrémenté (global à tous les canevas). */
        this._zOrderCounter = 0;

        /**
         * Pool d'objets détachés — réutilisés par undo/redo au lieu de détruire/recréer.
         * Quand un objet est "supprimé" par l'historique (undo create / redo delete),
         * ses ressources Pixi.js (Container, Sprite, texture, canvas offscreen) sont
         * détachées du layer mais gardées en mémoire dans ce pool.
         * Quand l'objet est "recréé" par l'historique (redo create / undo delete),
         * les ressources sont récupérées du pool → zéro allocation, zéro GC.
         * @type {Map<number, Object>} objectId → { pixiContainer, _pixiGraphics, _pixiSprite, _offscreenCanvas, _offscreenContext }
         */
        this._detachedObjects = new Map();

        /* ── Enregistrer les types d'actions d'historique pour les objets ── */
        this._registerHistoryActionTypes();
    }


    /* ══════════════════════════════════════════════════════════════
       MÉTHODE INTERNE: _emit
       Raccourci pour émettre un événement via l'EventEmitter global.
       ══════════════════════════════════════════════════════════════ */

    /**
     * Émet un événement via l'EventEmitter de l'instance VOH.
     * @param {string} eventName — Nom de l'événement (ex: 'object:created').
     * @param {Object} data — Données de l'événement.
     */
    _emit(eventName, data) {
        const eventEmitter = this._voh.getEventEmitter();
        if (eventEmitter) {
            eventEmitter.emit(eventName, data);
        }
    }

    /**
     * Déclenche un rendu Pixi.js manuel (mode statique, ticker arrêté).
     * Appelé après chaque modification visuelle d'un objet.
     * @param {Object} canvasData — Les données du canvas (si disponible).
     * @private
     */
    _requestRender(canvasData) {
        if (!canvasData) return;
        const renderEngine = this._voh._canvasManager ? this._voh._canvasManager._renderEngine : null;
        if (renderEngine) {
            renderEngine.requestRender(canvasData);
        }
    }

    /**
     * Retourne le canvasData d'un objet (pour requestRender).
     * @param {Object} objectData — Les données de l'objet.
     * @returns {Object|null} Le canvasData ou null.
     * @private
     */
    _getCanvasDataForObject(objectData) {
        const canvasManager = this._voh._canvasManager;
        if (!canvasManager) return null;
        return canvasManager._canvases.get(objectData.canvasId) || null;
    }


    /* ══════════════════════════════════════════════════════════════
       HISTORIQUE — Branchement sur le système undo/redo

       Les types d'actions sont enregistrés dans le dispatcher
       central de CanvasHistoryManager via registerActionType().
       Les setters appellent _recordObjectChange() pour enregistrer
       chaque modification dans l'historique de la page.
       ══════════════════════════════════════════════════════════════ */

    /**
     * Retourne l'ObjectInteractionManager, ou null s'il n'est pas disponible.
     * @returns {ObjectInteractionManager|null}
     * @private
     */
    _getInteractionManager() {
        return this._voh._objectInteractionManager || null;
    }

    /**
     * Retourne le HistoryManager, ou null s'il n'est pas disponible.
     * @returns {CanvasHistoryManager|null}
     * @private
     */
    _getHistoryManager() {
        const canvasManager = this._voh._canvasManager;
        return canvasManager ? canvasManager._historyManager : null;
    }

    /**
     * Retourne le pageData de la page à laquelle appartient un objet.
     * @param {Object} objectData — Les données de l'objet.
     * @returns {Object|null} Le pageData, ou null.
     * @private
     */
    _getObjectPageData(objectData) {
        const canvasManager = this._voh._canvasManager;
        if (!canvasManager) return null;
        const canvasData = canvasManager._canvases.get(objectData.canvasId);
        if (!canvasData || !canvasData.pages) return null;
        return canvasData.pages.get(objectData.pageId) || null;
    }

    /**
     * Enregistre un changement de propriété d'objet dans l'historique.
     * @param {Object} objectData   — Les données de l'objet modifié.
     * @param {string} propertyName — Nom de la propriété (ex: 'x', 'width').
     * @param {*}      oldValue     — Ancienne valeur.
     * @param {*}      newValue     — Nouvelle valeur.
     * @private
     */
    _recordObjectChange(objectData, propertyName, oldValue, newValue) {
        if (oldValue === newValue) return;
        const historyManager = this._getHistoryManager();
        if (!historyManager) return;
        const pageData = this._getObjectPageData(objectData);
        if (!pageData) return;

        historyManager.pushAction(pageData, {
            type:        'objectPropertyChange',
            description: `Objet ${objectData.id} ${propertyName}: ${oldValue} → ${newValue}`,
            data: {
                objectId: objectData.id,
                property: propertyName,
                from:     oldValue,
                to:       newValue
            }
        }, objectData.id + ':' + propertyName);
    }

    /**
     * Enregistre les types d'actions d'historique pour les objets.
     * Appelé par le constructeur.
     * @private
     */
    _registerHistoryActionTypes() {
        const historyManager = this._getHistoryManager();
        if (!historyManager) return;

        const objectManager = this;

        /* ── objectPropertyChange : modification d'une propriété d'objet ── */
        /* data = { objectId, property, from, to }                          */
        historyManager.registerActionType('objectPropertyChange', {
            apply: (context, data) => {
                objectManager._historyApplyProperty(data.objectId, data.property, data.to);
            },
            reverse: (context, data) => {
                objectManager._historyApplyProperty(data.objectId, data.property, data.from);
            }
        });

        /* ── objectCreate : création d'un objet ── */
        /* data = { objectId, canvasId, config }     */
        historyManager.registerActionType('objectCreate', {
            apply: (context, data) => {
                /* Refaire la création : recréer l'objet avec la même config */
                objectManager._historyRecreateObject(data.config);
            },
            reverse: (context, data) => {
                /* Annuler la création : supprimer l'objet du DOM et de la Map */
                objectManager._historyRemoveObject(data.objectId);
            },
            cleanup: (data) => {
                /* Action éjectée : détruire les ressources Pixi si l'objet est dans le pool */
                objectManager._destroyPooledObject(data.objectId);
            }
        });

        /* ── objectDelete : suppression d'un objet ── */
        /* data = { objectId, canvasId, config }        */
        historyManager.registerActionType('objectDelete', {
            apply: (context, data) => {
                /* Refaire la suppression : supprimer l'objet */
                objectManager._historyRemoveObject(data.objectId);
            },
            reverse: (context, data) => {
                /* Annuler la suppression : recréer l'objet */
                objectManager._historyRecreateObject(data.config);
            },
            cleanup: (data) => {
                /* Action éjectée : détruire les ressources Pixi si l'objet est dans le pool */
                objectManager._destroyPooledObject(data.objectId);
            }
        });
    }

    /**
     * Applique une valeur de propriété sur un objet et met à jour le rendu.
     * Utilisé par les handlers d'historique (undo/redo).
     * @param {number} objectId    — L'ID de l'objet.
     * @param {string} propertyName — Nom de la propriété.
     * @param {*}      value       — La valeur à appliquer.
     * @private
     */
    _historyApplyProperty(objectId, propertyName, value) {
        const objectData = this._objects.get(objectId);
        if (!objectData) return;

        objectData[propertyName] = value;

        /* ── Mettre à jour le rendu selon la propriété ── */
        switch (propertyName) {
            case 'x':
            case 'y':
                this._applyObjectPosition(objectData);
                /* Mettre à jour la grille spatiale (hit-test souris) */
                { const im = this._getInteractionManager();
                  if (im) im.spatialGridUpdateObject(objectData); }
                break;
            case 'width':
            case 'height':
                this._applyObjectSize(objectData);
                this._renderObject(objectData);
                /* Mettre à jour la grille spatiale (hit-test souris) */
                { const im = this._getInteractionManager();
                  if (im) im.spatialGridUpdateObject(objectData); }
                break;
            case 'isVisible':
                this._applyObjectVisibility(objectData);
                /* Mettre à jour la grille spatiale (insert/remove selon visibilité) */
                { const im = this._getInteractionManager();
                  if (im) im.spatialGridUpdateObjectVisibility(objectData, value); }
                break;
            case 'opacity':
                this._applyObjectOpacity(objectData);
                break;
            case 'zOrder':
                this._applyObjectZOrder(objectData);
                break;
            case 'backgroundColor':
                if (!objectData.drawingCallback) {
                    this._renderObject(objectData);
                }
                break;
            case 'drawingCallback':
                this._renderObject(objectData);
                break;
            case 'mouseDragPreviewCallback':
            case 'mouseDragMultiMode':
            case 'mouseDragMultiPreviewCallback':
                /* Pas de rendu visuel — le changement prend effet au prochain drag */
                break;
            case 'selectionBorderColor':
            case 'selectionBorderThickness':
            case 'selectionBorderOffset':
            case 'selectionBorderStyle':
                /* Mettre à jour le contour de sélection si l'objet est sélectionné */
                this._updateSelectionOutlineIfSelected(objectData);
                break;
            /* name, isLocked, cursor, mouseDragEnabled, mouseDragButton,
               mouseDragMode, mouseDragOffsetX, mouseDragOffsetY,
               selectionMode → pas de rendu visuel */
        }

        /* ── Déclencher le rendu Pixi.js ── */
        const canvasData = this._getCanvasDataForObject(objectData);
        this._requestRender(canvasData);
    }

    /**
     * Recrée un objet à partir de sa config sauvegardée (undo delete / redo create).
     * @param {Object} config — La config complète de l'objet.
     * @private
     */
    _historyRecreateObject(config) {
        const canvasManager = this._voh._canvasManager;
        if (!canvasManager) return;
        const canvasData = canvasManager._canvases.get(config.canvasId);
        if (!canvasData) return;

        /* ── Chercher dans le pool d'objets détachés ── */
        const cached = this._detachedObjects.get(config.id);

        let objectData;

        if (cached) {

            /* ══════════════════════════════════════════════════
               RÉUTILISATION DEPUIS LE POOL — zéro allocation
               Le container, sprite, texture et canvas offscreen
               sont récupérés tels quels. On met juste à jour
               les propriétés et on rattache au layer.
               ══════════════════════════════════════════════════ */

            this._detachedObjects.delete(config.id);

            objectData = {
                id:              config.id,
                canvasId:        config.canvasId,
                pageId:          config.pageId,
                name:            config.name,
                x:               config.x,
                y:               config.y,
                width:           config.width,
                height:          config.height,
                backgroundColor: config.backgroundColor,
                isLocked:        config.isLocked,
                isVisible:       config.isVisible,
                opacity:         config.opacity,
                zOrder:          config.zOrder,
                drawingCallback: config.drawingCallback || null,
                cursor:          config.cursor || null,
                mouseDragEnabled:         config.mouseDragEnabled         !== undefined ? config.mouseDragEnabled         : false,
                mouseDragButton:          config.mouseDragButton          !== undefined ? config.mouseDragButton          : 'left',
                mouseDragMode:            config.mouseDragMode            !== undefined ? config.mouseDragMode            : 'direct',
                mouseDragOffsetX:         config.mouseDragOffsetX         !== undefined ? config.mouseDragOffsetX         : 0,
                mouseDragOffsetY:         config.mouseDragOffsetY         !== undefined ? config.mouseDragOffsetY         : 0,
                mouseDragPreviewCallback: config.mouseDragPreviewCallback !== undefined ? config.mouseDragPreviewCallback : null,
                pixiContainer:    cached.pixiContainer,
                _pixiGraphics:    cached._pixiGraphics,
                _pixiSprite:      cached._pixiSprite,
                _offscreenCanvas: cached._offscreenCanvas,
                _offscreenContext: cached._offscreenContext
            };

        } else {

            /* ══════════════════════════════════════════════════
               CRÉATION COMPLÈTE — pas dans le pool, on crée tout
               ══════════════════════════════════════════════════ */

            const pixiContainer = new PIXI.Container();
            pixiContainer.label = 'object_' + config.id;

            objectData = {
                id:              config.id,
                canvasId:        config.canvasId,
                pageId:          config.pageId,
                name:            config.name,
                x:               config.x,
                y:               config.y,
                width:           config.width,
                height:          config.height,
                backgroundColor: config.backgroundColor,
                isLocked:        config.isLocked,
                isVisible:       config.isVisible,
                opacity:         config.opacity,
                zOrder:          config.zOrder,
                drawingCallback: config.drawingCallback || null,
                cursor:          config.cursor || null,
                mouseDragEnabled:         config.mouseDragEnabled         !== undefined ? config.mouseDragEnabled         : false,
                mouseDragButton:          config.mouseDragButton          !== undefined ? config.mouseDragButton          : 'left',
                mouseDragMode:            config.mouseDragMode            !== undefined ? config.mouseDragMode            : 'direct',
                mouseDragOffsetX:         config.mouseDragOffsetX         !== undefined ? config.mouseDragOffsetX         : 0,
                mouseDragOffsetY:         config.mouseDragOffsetY         !== undefined ? config.mouseDragOffsetY         : 0,
                mouseDragPreviewCallback: config.mouseDragPreviewCallback !== undefined ? config.mouseDragPreviewCallback : null,
                pixiContainer:   pixiContainer
            };
        }

        /* ── Stocker et appliquer les propriétés visuelles ── */
        this._objects.set(config.id, objectData);
        this._applyObjectPosition(objectData);
        this._applyObjectVisibility(objectData);
        this._applyObjectOpacity(objectData);
        this._applyObjectZOrder(objectData);
        this._renderObject(objectData);

        /* ── Rattacher au layer objets de Pixi.js ── */
        if (canvasData.pixiObjectsLayer && objectData.pixiContainer) {
            if (!objectData.pixiContainer.parent) {
                canvasData.pixiObjectsLayer.addChild(objectData.pixiContainer);
            }
        }

        /* ── Masquer si pas sur la page active ── */
        if (canvasData.activePageId !== config.pageId) {
            objectData.pixiContainer.visible = false;
        }

        /* ── Insérer dans la grille spatiale (pour le hit-test souris) ── */
        const interactionManager = this._getInteractionManager();
        if (interactionManager) {
            interactionManager.spatialGridInsertObject(objectData);
        }

        /* ── Mettre à jour le compteur d'IDs si nécessaire ── */
        if (config.id >= this._objectIdCounter) {
            this._objectIdCounter = config.id;
        }

        /* ── Déclencher le rendu ── */
        this._requestRender(canvasData);
    }

    /**
     * Supprime un objet du DOM et de la Map (undo create / redo delete).
     * @param {number} objectId — L'ID de l'objet.
     * @private
     */
    _historyRemoveObject(objectId) {
        const objectData = this._objects.get(objectId);
        if (!objectData) return;

        /* ── Capturer la référence au canvas AVANT la suppression ── */
        const canvasData = this._getCanvasDataForObject(objectData);

        /* ── Détacher du layer (NE PAS détruire — garder pour redo) ── */
        if (objectData.pixiContainer && objectData.pixiContainer.parent) {
            objectData.pixiContainer.parent.removeChild(objectData.pixiContainer);
        }

        /* ── Stocker les ressources Pixi dans le pool pour réutilisation ── */
        this._detachedObjects.set(objectId, {
            pixiContainer:    objectData.pixiContainer,
            _pixiGraphics:    objectData._pixiGraphics    || null,
            _pixiSprite:      objectData._pixiSprite      || null,
            _offscreenCanvas: objectData._offscreenCanvas || null,
            _offscreenContext: objectData._offscreenContext || null
        });

        /* ── Retirer de la grille spatiale (hit-test souris) ── */
        const interactionManager = this._getInteractionManager();
        if (interactionManager) {
            interactionManager.spatialGridRemoveObject(objectId);
        }

        /* ── Retirer de la Map des objets actifs ── */
        this._objects.delete(objectId);

        /* ── Déclencher le rendu ── */
        this._requestRender(canvasData);
    }

    /**
     * Détruit définitivement les ressources Pixi d'un objet dans le pool.
     * Appelé quand une action d'historique référençant cet objet est éjectée
     * des piles (nouvelle branche, overflow maxLevel, clear, destroy).
     * Si l'objet n'est pas dans le pool, ne fait rien.
     * @param {number} objectId — L'ID de l'objet.
     * @private
     */
    _destroyPooledObject(objectId) {
        const cached = this._detachedObjects.get(objectId);
        if (!cached) return;

        /* ── Détruire les ressources Pixi ── */
        if (cached._pixiSprite && cached._pixiSprite.texture) {
            cached._pixiSprite.texture.destroy(true);
        }
        if (cached.pixiContainer) {
            if (cached.pixiContainer.parent) {
                cached.pixiContainer.parent.removeChild(cached.pixiContainer);
            }
            cached.pixiContainer.destroy({ children: true });
        }

        /* ── Retirer du pool ── */
        this._detachedObjects.delete(objectId);
    }

    /**
     * Capture la config complète d'un objet pour la sauvegarder dans l'historique.
     * Utilisé avant la suppression et après la création.
     * @param {Object} objectData — Les données de l'objet.
     * @returns {Object} La config sérialisable (sans DOM).
     * @private
     */
    _captureObjectConfig(objectData) {
        return {
            id:              objectData.id,
            canvasId:        objectData.canvasId,
            pageId:          objectData.pageId,
            name:            objectData.name,
            x:               objectData.x,
            y:               objectData.y,
            width:           objectData.width,
            height:          objectData.height,
            backgroundColor: objectData.backgroundColor,
            isLocked:        objectData.isLocked,
            isVisible:       objectData.isVisible,
            opacity:         objectData.opacity,
            zOrder:          objectData.zOrder,
            drawingCallback: objectData.drawingCallback,
            cursor:          objectData.cursor,
            mouseDragEnabled:         objectData.mouseDragEnabled,
            mouseDragButton:          objectData.mouseDragButton,
            mouseDragMode:            objectData.mouseDragMode,
            mouseDragOffsetX:         objectData.mouseDragOffsetX,
            mouseDragOffsetY:         objectData.mouseDragOffsetY,
            mouseDragPreviewCallback: objectData.mouseDragPreviewCallback,
            mouseDragMultiMode:            objectData.mouseDragMultiMode,
            mouseDragMultiPreviewCallback: objectData.mouseDragMultiPreviewCallback,
            selectionBorderColor:          objectData.selectionBorderColor,
            selectionBorderThickness:      objectData.selectionBorderThickness,
            selectionBorderOffset:         objectData.selectionBorderOffset,
            selectionBorderStyle:          objectData.selectionBorderStyle,
            selectionMode:                 objectData.selectionMode
        };
    }


    /* ══════════════════════════════════════════════════════════════
       MÉTHODE INTERNE: _getObjectData
       Vérifie qu'un objet existe et retourne ses données.
       ══════════════════════════════════════════════════════════════ */

    /**
     * Retourne les données d'un objet ou null si inexistant.
     * @param {number} objectId — L'ID de l'objet.
     * @param {string} callerName — Nom de la méthode appelante (pour le log d'erreur).
     * @returns {Object|null} Les données de l'objet ou null.
     */
    _getObjectData(objectId, callerName) {
        const objectData = this._objects.get(objectId);
        if (!objectData) {
            console.warn(`[Objects] ${callerName}: objet ${objectId} inexistant.`);
            return null;
        }
        return objectData;
    }


    /* ══════════════════════════════════════════════════════════════
       MÉTHODES INTERNES: _apply*
       Appliquent les propriétés visuelles sur les éléments DOM.
       ══════════════════════════════════════════════════════════════ */

    /**
     * Applique la position X, Y sur le Container Pixi.js de l'objet.
     * @param {Object} objectData — Les données de l'objet.
     */
    _applyObjectPosition(objectData) {
        if (objectData.pixiContainer) {
            objectData.pixiContainer.position.set(objectData.x, objectData.y);
        }
    }

    /**
     * Applique la largeur et la hauteur de l'objet (délégué à _renderObject).
     * @param {Object} objectData — Les données de l'objet.
     */
    _applyObjectSize(objectData) {
        /* La taille est appliquée dans _renderObject (redessine le rect) */
    }

    /**
     * Applique la visibilité sur le Container Pixi.js de l'objet.
     * @param {Object} objectData — Les données de l'objet.
     */
    _applyObjectVisibility(objectData) {
        if (objectData.pixiContainer) {
            objectData.pixiContainer.visible = objectData.isVisible;
        }
    }

    /**
     * Applique l'opacité sur le Container Pixi.js de l'objet.
     * @param {Object} objectData — Les données de l'objet.
     */
    _applyObjectOpacity(objectData) {
        if (objectData.pixiContainer) {
            objectData.pixiContainer.alpha = objectData.opacity;
        }
    }

    /**
     * Applique le z-order sur le Container Pixi.js de l'objet (via zIndex).
     * @param {Object} objectData — Les données de l'objet.
     */
    _applyObjectZOrder(objectData) {
        if (objectData.pixiContainer) {
            objectData.pixiContainer.zIndex = objectData.zOrder;
        }
    }


    /* ══════════════════════════════════════════════════════════════
       MÉTHODE INTERNE: _renderObject
       Redessine le contenu visuel de l'objet (canvas 2D interne).
       ══════════════════════════════════════════════════════════════ */

    /**
     * Redessine le contenu visuel d'un objet.
     * Si un drawingCallback est défini, il est appelé avec le contexte 2D.
     * Sinon, le rendu par défaut (rectangle gris clair) est appliqué.
     * @param {Object} objectData — Les données de l'objet.
     */
    _renderObject(objectData) {

        const container = objectData.pixiContainer;
        if (!container) return;

        if (typeof objectData.drawingCallback === 'function') {

            /* ══════════════════════════════════════════════════
               MODE CALLBACK — Dessin personnalisé via Sprite

               Le callback dessine sur un canvas offscreen.
               Le contenu est affiché via un PIXI.Sprite + texture
               construite depuis un PIXI.CanvasSource (API Pixi v8).

               Optimisation :
               - Même taille → redessiner + source.update() (0 allocation GPU)
               - Taille changée → recréer le CanvasSource (inévitable)
               ══════════════════════════════════════════════════ */

            /* ── Masquer le Graphics (s'il existe) ── */
            if (objectData._pixiGraphics) {
                objectData._pixiGraphics.visible = false;
            }

            /* ── Canvas offscreen — créé une seule fois, réutilisé ── */
            if (!objectData._offscreenCanvas) {
                objectData._offscreenCanvas = document.createElement('canvas');
                objectData._offscreenContext = objectData._offscreenCanvas.getContext('2d');
            }
            const offCanvas = objectData._offscreenCanvas;
            const offContext = objectData._offscreenContext;

            /* ── Détecter si la taille a changé ── */
            const sizeChanged = (offCanvas.width !== objectData.width || offCanvas.height !== objectData.height);

            if (sizeChanged) {
                /* Redimensionner le canvas (réinitialise le contenu) */
                offCanvas.width  = objectData.width;
                offCanvas.height = objectData.height;
            } else {
                /* Même taille — effacer le contenu sans réinitialiser le canvas */
                offContext.clearRect(0, 0, objectData.width, objectData.height);
            }

            /* ── Appeler le callback de dessin ── */
            offContext.save();
            objectData.drawingCallback(offContext, objectData.width, objectData.height, objectData.id);
            offContext.restore();

            /* ── Créer ou mettre à jour la texture et le Sprite ── */
            if (objectData._pixiSprite) {
                if (sizeChanged) {
                    /* Taille changée → recréer la source et la texture ── */
                    objectData._pixiSprite.texture.destroy(true);
                    const newSource = new PIXI.CanvasSource({ resource: offCanvas });
                    objectData._pixiSprite.texture = new PIXI.Texture({ source: newSource });
                } else {
                    /* Même taille → signaler que le canvas a changé (0 allocation GPU) */
                    objectData._pixiSprite.texture.source.update();
                }
                objectData._pixiSprite.visible = true;
            } else {
                /* Premier appel — créer la source, la texture et le Sprite */
                const canvasSource = new PIXI.CanvasSource({ resource: offCanvas });
                const texture = new PIXI.Texture({ source: canvasSource });
                const sprite = new PIXI.Sprite(texture);
                sprite.label = 'objectSprite_' + objectData.id;
                container.addChild(sprite);
                objectData._pixiSprite = sprite;
            }

        } else {

            /* ══════════════════════════════════════════════════
               MODE PAR DÉFAUT — Rectangle coloré via Graphics
               Ultra-rapide, 0 allocation, idéal pour 10 000+ objets
               ══════════════════════════════════════════════════ */

            /* ── Masquer le Sprite (s'il existe) ── */
            if (objectData._pixiSprite) {
                objectData._pixiSprite.visible = false;
            }

            /* ── Créer le Graphics à la demande ── */
            if (!objectData._pixiGraphics) {
                objectData._pixiGraphics = new PIXI.Graphics();
                objectData._pixiGraphics.label = 'objectGraphics_' + objectData.id;
                container.addChild(objectData._pixiGraphics);
            }

            /* ── Dessiner le rectangle coloré ── */
            const graphics = objectData._pixiGraphics;
            graphics.visible = true;
            graphics.clear();
            let pixiColor;
            try {
                pixiColor = new PIXI.Color(objectData.backgroundColor);
            } catch (e) {
                pixiColor = new PIXI.Color('rgba(200, 200, 200, 1.0)');
            }
            graphics.rect(0, 0, objectData.width, objectData.height);
            graphics.fill({ color: pixiColor });
        }
    }


    /* ══════════════════════════════════════════════════════════════
       CRÉATION D'UN OBJET
       ══════════════════════════════════════════════════════════════ */

    /**
     * Crée un nouvel objet sur un canevas.
     *
     * @param {number} canvasId — L'ID du canevas sur lequel créer l'objet.
     * @param {Object} [params] — Paramètres de création.
     * @param {string}   [params.name]            — Nom de l'objet.
     * @param {number}   [params.x]               — Position X sur le canevas (px).
     * @param {number}   [params.y]               — Position Y sur le canevas (px).
     * @param {number}   [params.width]           — Largeur (px).
     * @param {number}   [params.height]          — Hauteur (px).
     * @param {string}   [params.backgroundColor] — Couleur de fond (CSS, pour le rendu par défaut).
     * @param {boolean}  [params.isLocked]        — Verrouillé.
     * @param {boolean}  [params.isVisible]       — Visible ou masqué.
     * @param {number}   [params.opacity]         — Opacité (0.0 à 1.0).
     * @param {Function} [params.drawingCallback]    — Callback de dessin personnalisé.
     * @returns {number} L'ID de l'objet créé, ou -1 en cas d'erreur.
     */
    createObject(canvasId, params = {}) {

        /* ── Vérifier que le canevas existe ── */
        const canvasManager = this._voh._canvasManager;
        if (!canvasManager || !canvasManager.canvasExists(canvasId)) {
            console.error(`[Objects] createObject: canevas ${canvasId} inexistant.`);
            return -1;
        }

        /* ── Récupérer l'élément DOM du canevas ── */
        const canvasData = canvasManager._canvases.get(canvasId);
        if (!canvasData || !canvasData.element) {
            console.error(`[Objects] createObject: élément DOM du canevas ${canvasId} introuvable.`);
            return -1;
        }

        /* ── Générer l'ID ── */
        this._objectIdCounter++;
        const objectId = this._objectIdCounter;

        /* ── Z-order (incrémenté à chaque création) ── */
        this._zOrderCounter++;
        const objectZOrder = this._zOrderCounter;

        /* ── Nom par défaut ── */
        const objectName = params.name !== undefined ? params.name : ('Objet ' + objectId);

        /* ── Dimensions (bornées au minimum) ── */
        let objectWidth  = params.width  !== undefined ? params.width  : OBJECT_DEFAULT_WIDTH;
        let objectHeight = params.height !== undefined ? params.height : OBJECT_DEFAULT_HEIGHT;
        objectWidth  = Math.max(OBJECT_MINIMUM_SIZE, objectWidth);
        objectHeight = Math.max(OBJECT_MINIMUM_SIZE, objectHeight);

        /* ── Créer le PIXI.Container pour le rendu GPU ── */
        /* Le Container est le nœud racine de l'objet dans objectsLayer.        */
        /* Il gère position, visible, alpha, zIndex. À l'intérieur, un          */
        /* Graphics (rendu par défaut) ou un Sprite (drawingCallback) est        */
        /* créé à la demande par _renderObject().                                */
        const pixiContainer = new PIXI.Container();
        pixiContainer.label = 'object_' + objectId;

        /* ── Objet de données ── */
        const objectData = {
            id:       objectId,
            canvasId: canvasId,
            pageId:   canvasData.activePageId, /* Page sur laquelle vit l'objet */
            name:     objectName,

            /* Position sur le canevas */
            x: params.x !== undefined ? params.x : OBJECT_DEFAULT_X,
            y: params.y !== undefined ? params.y : OBJECT_DEFAULT_Y,

            /* Dimensions */
            width:  objectWidth,
            height: objectHeight,

            /* Couleur de fond (utilisée par le rendu par défaut uniquement) */
            backgroundColor: params.backgroundColor !== undefined
                ? params.backgroundColor
                : OBJECT_DEFAULT_BACKGROUND_COLOR,

            /* État */
            isLocked:  params.isLocked  !== undefined ? params.isLocked  : OBJECT_DEFAULT_IS_LOCKED,
            isVisible: params.isVisible !== undefined ? params.isVisible : OBJECT_DEFAULT_IS_VISIBLE,
            opacity:   params.opacity   !== undefined ? params.opacity   : OBJECT_DEFAULT_OPACITY,

            /* Z-order */
            zOrder: objectZOrder,

            /* Callback de dessin personnalisé (null = rendu par défaut) */
            drawingCallback: params.drawingCallback !== undefined ? params.drawingCallback : null,

            /* Curseur CSS au survol (null = pas de changement, le curseur du canevas est conservé) */
            cursor: params.cursor !== undefined ? params.cursor : null,

            /* ── Drag souris ─────────────────────────────────────────────────── */

            /** Activer le déplacement à la souris sur cet objet. */
            mouseDragEnabled: params.mouseDragEnabled !== undefined ? params.mouseDragEnabled : false,

            /** Bouton souris qui déclenche le drag : 'left', 'middle' ou 'right'. */
            mouseDragButton: params.mouseDragButton !== undefined ? params.mouseDragButton : 'left',

            /**
             * Mode de déplacement :
             * 'direct'  → l'objet bouge en temps réel sous la souris.
             * 'preview' → un fantôme suit la souris, l'objet ne bouge qu'au relâchement.
             */
            mouseDragMode: params.mouseDragMode !== undefined ? params.mouseDragMode : 'direct',

            /**
             * Décalage X entre le curseur et le coin haut-gauche de l'objet
             * (0 = l'objet garde sa position relative sous le curseur).
             */
            mouseDragOffsetX: params.mouseDragOffsetX !== undefined ? params.mouseDragOffsetX : 0,

            /**
             * Décalage Y entre le curseur et le coin haut-gauche de l'objet
             * (0 = l'objet garde sa position relative sous le curseur).
             */
            mouseDragOffsetY: params.mouseDragOffsetY !== undefined ? params.mouseDragOffsetY : 0,

            /**
             * Callback de dessin du fantôme en mode preview.
             * Signature : function(context, width, height, objectId)
             * null = pointillés bleus par défaut.
             */
            mouseDragPreviewCallback: params.mouseDragPreviewCallback !== undefined ? params.mouseDragPreviewCallback : null,

            /**
             * Mode de déplacement en multi-sélection :
             * 'direct'  → l'objet bouge en temps réel.
             * 'preview' → un fantôme suit la souris.
             * null      → hérite de mouseDragMode (comportement par défaut).
             */
            mouseDragMultiMode: params.mouseDragMultiMode !== undefined ? params.mouseDragMultiMode : null,

            /**
             * Callback de dessin du fantôme en mode preview multi-sélection.
             * Signature : function(context, width, height, objectId)
             * null = hérite de mouseDragPreviewCallback.
             */
            mouseDragMultiPreviewCallback: params.mouseDragMultiPreviewCallback !== undefined ? params.mouseDragMultiPreviewCallback : null,

            /* ── Contour de sélection (apparence quand l'objet est sélectionné) ── */

            /** Couleur du contour de sélection. */
            selectionBorderColor: params.selectionBorderColor !== undefined
                ? params.selectionBorderColor
                : OBJECT_DEFAULT_SELECTION_BORDER_COLOR,

            /** Épaisseur du contour de sélection (pixels). */
            selectionBorderThickness: params.selectionBorderThickness !== undefined
                ? params.selectionBorderThickness
                : OBJECT_DEFAULT_SELECTION_BORDER_THICKNESS,

            /** Marge entre l'objet et le contour de sélection (pixels). */
            selectionBorderOffset: params.selectionBorderOffset !== undefined
                ? params.selectionBorderOffset
                : OBJECT_DEFAULT_SELECTION_BORDER_OFFSET,

            /** Style du contour de sélection ('solid', 'dashed', 'dotted'). */
            selectionBorderStyle: params.selectionBorderStyle !== undefined
                ? params.selectionBorderStyle
                : OBJECT_DEFAULT_SELECTION_BORDER_STYLE,

            /**
             * Mode de sélection par rectangle pour cet objet.
             * 'enclosed' (défaut) = l'objet doit être entièrement dans le rectangle.
             * 'intersect' = sélectionné dès qu'il touche le rectangle (même partiellement).
             * 'enclosed'  = doit être entièrement contenu dans le rectangle.
             */
            selectionMode: params.selectionMode !== undefined
                ? params.selectionMode
                : OBJECT_DEFAULT_SELECTION_MODE,

            /** Graphics Pixi.js du contour de sélection (créé/détruit dynamiquement). */
            _selectionGraphics: null,

            /* Référence Pixi.js — Container racine (les enfants sont gérés par _renderObject) */
            pixiContainer: pixiContainer
        };

        /* ── Stocker l'objet ── */
        this._objects.set(objectId, objectData);

        /* ── Appliquer les propriétés visuelles ── */
        this._applyObjectPosition(objectData);
        this._applyObjectVisibility(objectData);
        this._applyObjectOpacity(objectData);
        this._applyObjectZOrder(objectData);

        /* ── Premier rendu (rectangle coloré ou callback) ── */
        this._renderObject(objectData);

        /* ── Ajouter au layer objets de Pixi.js ── */
        if (canvasData.pixiObjectsLayer) {
            canvasData.pixiObjectsLayer.addChild(pixiContainer);
        }

        /* ── Déclencher le rendu Pixi.js (mode statique, ticker arrêté) ── */
        this._requestRender(canvasData);

        /* ── Émettre l'événement object:created ── */
        this._emit('object:created', { objectId: objectId, canvasId: canvasId, name: objectName });

        /* ── Insérer dans la grille spatiale (pour le hit-test souris) ── */
        const interactionManager = this._getInteractionManager();
        if (interactionManager) {
            interactionManager.spatialGridInsertObject(objectData);
        }

        /* ── Enregistrer dans l'historique (pour pouvoir annuler la création) ── */
        const historyManager = this._getHistoryManager();
        if (historyManager) {
            const pageData = this._getObjectPageData(objectData);
            if (pageData) {
                historyManager.pushAction(pageData, {
                    type:        'objectCreate',
                    description: `Création objet ${objectId} (${objectName})`,
                    data: {
                        objectId: objectId,
                        canvasId: canvasId,
                        config:   this._captureObjectConfig(objectData)
                    }
                });
            }
        }

        return objectId;
    }


    /* ══════════════════════════════════════════════════════════════
       SUPPRESSION D'UN OBJET
       ══════════════════════════════════════════════════════════════ */

    /**
     * Supprime un objet.
     * @param {number} objectId — L'ID de l'objet à supprimer.
     * @returns {boolean} true si supprimé, false sinon.
     */
    deleteObject(objectId) {

        const objectData = this._getObjectData(objectId, 'deleteObject');
        if (!objectData) return false;

        const deletedCanvasId = objectData.canvasId;
        const deletedName     = objectData.name;
        const deletedCanvasData = this._getCanvasDataForObject(objectData);

        /* ── Enregistrer dans l'historique AVANT la suppression ── */
        const historyManager = this._getHistoryManager();
        if (historyManager) {
            const pageData = this._getObjectPageData(objectData);
            if (pageData) {
                historyManager.pushAction(pageData, {
                    type:        'objectDelete',
                    description: `Suppression objet ${objectId} (${deletedName})`,
                    data: {
                        objectId: objectId,
                        canvasId: deletedCanvasId,
                        config:   this._captureObjectConfig(objectData)
                    }
                });
            }
        }

        /* ── Retirer de la grille spatiale ── */
        const interactionManagerDelete = this._getInteractionManager();
        if (interactionManagerDelete) {
            interactionManagerDelete.spatialGridRemoveObject(objectId);
        }

        /* ── Retirer de la sélection (silencieusement, sans événement) ── */
        const selectionManager = this._voh._objectSelectionManager;
        if (selectionManager) {
            selectionManager.removeObjectFromSelection(deletedCanvasId, objectId);
        }

        /* ── Détacher du layer et stocker dans le pool (pour undo) ── */
        if (objectData.pixiContainer && objectData.pixiContainer.parent) {
            objectData.pixiContainer.parent.removeChild(objectData.pixiContainer);
        }

        /* ── Stocker les ressources Pixi dans le pool pour réutilisation ── */
        this._detachedObjects.set(objectId, {
            pixiContainer:    objectData.pixiContainer,
            _pixiGraphics:    objectData._pixiGraphics    || null,
            _pixiSprite:      objectData._pixiSprite      || null,
            _offscreenCanvas: objectData._offscreenCanvas || null,
            _offscreenContext: objectData._offscreenContext || null
        });

        /* ── Retirer de la Map ── */
        this._objects.delete(objectId);

        /* ── Émettre l'événement object:deleted ── */
        this._emit('object:deleted', { objectId: objectId, canvasId: deletedCanvasId, name: deletedName });

        /* ── Déclencher le rendu Pixi.js ── */
        this._requestRender(deletedCanvasData);

        return true;
    }


    /* ══════════════════════════════════════════════════════════════
       INFORMATIONS
       ══════════════════════════════════════════════════════════════ */

    /**
     * Retourne le nombre d'objets sur un canevas.
     * Si canvasId est omis, retourne le nombre total d'objets.
     * @param {number} [canvasId] — L'ID du canevas (optionnel).
     * @returns {number} Le nombre d'objets.
     */
    getObjectCount(canvasId) {
        if (canvasId === undefined) {
            return this._objects.size;
        }
        let count = 0;
        for (const objectData of this._objects.values()) {
            if (objectData.canvasId === canvasId) count++;
        }
        return count;
    }

    /**
     * Retourne la liste des objets d'un canevas.
     * Si canvasId est omis, retourne tous les objets.
     * @param {number} [canvasId] — L'ID du canevas (optionnel).
     * @returns {Array} Liste de { id, name, canvasId }.
     */
    getObjectList(canvasId) {
        const list = [];
        for (const objectData of this._objects.values()) {
            if (canvasId === undefined || objectData.canvasId === canvasId) {
                list.push({ id: objectData.id, name: objectData.name, canvasId: objectData.canvasId, pageId: objectData.pageId });
            }
        }
        return list;
    }

    /**
     * Retourne true si un objet existe.
     * @param {number} objectId — L'ID de l'objet.
     * @returns {boolean}
     */
    objectExists(objectId) {
        return this._objects.has(objectId);
    }

    /**
     * Retourne l'ID du canevas auquel appartient un objet.
     * @param {number} objectId — L'ID de l'objet.
     * @returns {number|null} L'ID du canevas, ou null si objet inexistant.
     */
    getObjectCanvasId(objectId) {
        const objectData = this._getObjectData(objectId, 'getObjectCanvasId');
        if (!objectData) return null;
        return objectData.canvasId;
    }

    /**
     * Retourne l'ID de la page sur laquelle vit un objet.
     * @param {number} objectId — L'ID de l'objet.
     * @returns {number|null} L'ID de la page, ou null si objet inexistant.
     */
    getObjectPageId(objectId) {
        const objectData = this._getObjectData(objectId, 'getObjectPageId');
        if (!objectData) return null;
        return objectData.pageId;
    }


    /* ══════════════════════════════════════════════════════════════
       CHANGEMENT DE PAGE — Masquer/Afficher les objets
       ══════════════════════════════════════════════════════════════ */

    /**
     * Bascule la visibilité des objets lors d'un changement de page.
     * Les objets de l'ancienne page sont masqués (display:none),
     * les objets de la nouvelle page sont réaffichés selon leur état isVisible.
     *
     * Appelé par CanvasPageManager._activatePage().
     *
     * @param {number} canvasId     — L'ID du canvas.
     * @param {number} newPageId    — L'ID de la nouvelle page active.
     * @param {number} [oldPageId]  — L'ID de l'ancienne page active (null si première activation).
     */
    _swapObjectsForPage(canvasId, newPageId, oldPageId) {

        for (const objectData of this._objects.values()) {

            /* Ne traiter que les objets de ce canvas */
            if (objectData.canvasId !== canvasId) continue;

            if (objectData.pageId === newPageId) {
                /* Objet de la nouvelle page → réafficher selon son état isVisible */
                if (objectData.pixiContainer) objectData.pixiContainer.visible = objectData.isVisible;
            } else {
                /* Objet d'une autre page → masquer systématiquement */
                if (objectData.pixiContainer) objectData.pixiContainer.visible = false;
            }
        }
    }


    /* ══════════════════════════════════════════════════════════════
       NOM
       ══════════════════════════════════════════════════════════════ */

    /**
     * Définit le nom d'un objet.
     * @param {number} objectId — L'ID de l'objet.
     * @param {string} name — Le nouveau nom.
     * @returns {boolean} true si réussi, false si objet inexistant.
     */
    setObjectName(objectId, name) {
        const objectData = this._getObjectData(objectId, 'setObjectName');
        if (!objectData) return false;

        const previousName = objectData.name;
        objectData.name = name;
        this._recordObjectChange(objectData, 'name', previousName, name);

        this._emit('object:nameChanged', { objectId: objectId, name: name, previousName: previousName });
        return true;
    }

    /**
     * Retourne le nom d'un objet.
     * @param {number} objectId — L'ID de l'objet.
     * @returns {string|null}
     */
    getObjectName(objectId) {
        const objectData = this._getObjectData(objectId, 'getObjectName');
        if (!objectData) return null;
        return objectData.name;
    }


    /* ══════════════════════════════════════════════════════════════
       POSITION
       ══════════════════════════════════════════════════════════════ */

    /**
     * Définit la position X d'un objet sur le canevas.
     * @param {number} objectId — L'ID de l'objet.
     * @param {number} x — Nouvelle position X (pixels).
     * @returns {boolean} true si réussi, false si objet inexistant.
     */
    setObjectX(objectId, x) {
        const objectData = this._getObjectData(objectId, 'setObjectX');
        if (!objectData) return false;

        const previousX = objectData.x;
        objectData.x = x;
        this._applyObjectPosition(objectData);
        this._recordObjectChange(objectData, 'x', previousX, x);

        this._emit('object:moved', { objectId: objectId, x: x, y: objectData.y, previousX: previousX, previousY: objectData.y });
        this._requestRender(this._getCanvasDataForObject(objectData));
        /* Mettre à jour la grille spatiale */
        const interactionManagerX = this._getInteractionManager();
        if (interactionManagerX) interactionManagerX.spatialGridUpdateObject(objectData);
        return true;
    }

    /**
     * Retourne la position X d'un objet.
     * @param {number} objectId — L'ID de l'objet.
     * @returns {number|null}
     */
    getObjectX(objectId) {
        const objectData = this._getObjectData(objectId, 'getObjectX');
        if (!objectData) return null;
        return objectData.x;
    }

    /**
     * Définit la position Y d'un objet sur le canevas.
     * @param {number} objectId — L'ID de l'objet.
     * @param {number} y — Nouvelle position Y (pixels).
     * @returns {boolean} true si réussi, false si objet inexistant.
     */
    setObjectY(objectId, y) {
        const objectData = this._getObjectData(objectId, 'setObjectY');
        if (!objectData) return false;

        const previousY = objectData.y;
        objectData.y = y;
        this._applyObjectPosition(objectData);
        this._recordObjectChange(objectData, 'y', previousY, y);

        this._emit('object:moved', { objectId: objectId, x: objectData.x, y: y, previousX: objectData.x, previousY: previousY });
        this._requestRender(this._getCanvasDataForObject(objectData));
        /* Mettre à jour la grille spatiale */
        const interactionManagerY = this._getInteractionManager();
        if (interactionManagerY) interactionManagerY.spatialGridUpdateObject(objectData);
        return true;
    }

    /**
     * Retourne la position Y d'un objet.
     * @param {number} objectId — L'ID de l'objet.
     * @returns {number|null}
     */
    getObjectY(objectId) {
        const objectData = this._getObjectData(objectId, 'getObjectY');
        if (!objectData) return null;
        return objectData.y;
    }


    /* ══════════════════════════════════════════════════════════════
       DIMENSIONS
       ══════════════════════════════════════════════════════════════ */

    /**
     * Définit la largeur d'un objet.
     * @param {number} objectId — L'ID de l'objet.
     * @param {number} width — Nouvelle largeur (pixels, minimum OBJECT_MINIMUM_SIZE).
     * @returns {boolean} true si réussi, false si objet inexistant.
     */
    setObjectWidth(objectId, width) {
        const objectData = this._getObjectData(objectId, 'setObjectWidth');
        if (!objectData) return false;

        /* Borner au minimum */
        width = Math.max(OBJECT_MINIMUM_SIZE, width);

        const previousWidth = objectData.width;
        objectData.width = width;
        this._applyObjectSize(objectData);

        /* Redessiner (le canvas interne doit s'adapter à la nouvelle taille) */
        this._renderObject(objectData);
        this._recordObjectChange(objectData, 'width', previousWidth, width);

        this._emit('object:resized', {
            objectId:      objectId,
            width:         width,
            height:        objectData.height,
            previousWidth: previousWidth,
            previousHeight: objectData.height
        });
        this._requestRender(this._getCanvasDataForObject(objectData));
        /* Mettre à jour la grille spatiale */
        const interactionManagerWidth = this._getInteractionManager();
        if (interactionManagerWidth) interactionManagerWidth.spatialGridUpdateObject(objectData);
        this._updateSelectionOutlineIfSelected(objectData);
        return true;
    }

    /**
     * Retourne la largeur d'un objet.
     * @param {number} objectId — L'ID de l'objet.
     * @returns {number|null}
     */
    getObjectWidth(objectId) {
        const objectData = this._getObjectData(objectId, 'getObjectWidth');
        if (!objectData) return null;
        return objectData.width;
    }

    /**
     * Définit la hauteur d'un objet.
     * @param {number} objectId — L'ID de l'objet.
     * @param {number} height — Nouvelle hauteur (pixels, minimum OBJECT_MINIMUM_SIZE).
     * @returns {boolean} true si réussi, false si objet inexistant.
     */
    setObjectHeight(objectId, height) {
        const objectData = this._getObjectData(objectId, 'setObjectHeight');
        if (!objectData) return false;

        /* Borner au minimum */
        height = Math.max(OBJECT_MINIMUM_SIZE, height);

        const previousHeight = objectData.height;
        objectData.height = height;
        this._applyObjectSize(objectData);

        /* Redessiner (le canvas interne doit s'adapter à la nouvelle taille) */
        this._renderObject(objectData);
        this._recordObjectChange(objectData, 'height', previousHeight, height);

        this._emit('object:resized', {
            objectId:       objectId,
            width:          objectData.width,
            height:         height,
            previousWidth:  objectData.width,
            previousHeight: previousHeight
        });
        this._requestRender(this._getCanvasDataForObject(objectData));
        /* Mettre à jour la grille spatiale */
        const interactionManagerHeight = this._getInteractionManager();
        if (interactionManagerHeight) interactionManagerHeight.spatialGridUpdateObject(objectData);
        this._updateSelectionOutlineIfSelected(objectData);
        return true;
    }

    /**
     * Retourne la hauteur d'un objet.
     * @param {number} objectId — L'ID de l'objet.
     * @returns {number|null}
     */
    getObjectHeight(objectId) {
        const objectData = this._getObjectData(objectId, 'getObjectHeight');
        if (!objectData) return null;
        return objectData.height;
    }


    /* ══════════════════════════════════════════════════════════════
       VERROUILLAGE
       ══════════════════════════════════════════════════════════════ */

    /**
     * Définit le verrouillage d'un objet.
     * Un objet verrouillé ne peut pas être manipulé à la souris.
     * @param {number} objectId — L'ID de l'objet.
     * @param {boolean} isLocked — true = verrouillé.
     * @returns {boolean} true si réussi, false si objet inexistant.
     */
    setObjectLocked(objectId, isLocked) {
        const objectData = this._getObjectData(objectId, 'setObjectLocked');
        if (!objectData) return false;

        /* Ne rien faire si la valeur est déjà la même */
        if (objectData.isLocked === isLocked) return true;

        const previousLocked = objectData.isLocked;
        objectData.isLocked = isLocked;
        this._recordObjectChange(objectData, 'isLocked', previousLocked, isLocked);

        if (isLocked) {
            this._emit('object:locked', { objectId: objectId });
        } else {
            this._emit('object:unlocked', { objectId: objectId });
        }
        return true;
    }

    /**
     * Retourne le verrouillage d'un objet.
     * @param {number} objectId — L'ID de l'objet.
     * @returns {boolean|null}
     */
    getObjectLocked(objectId) {
        const objectData = this._getObjectData(objectId, 'getObjectLocked');
        if (!objectData) return null;
        return objectData.isLocked;
    }


    /* ══════════════════════════════════════════════════════════════
       VISIBILITÉ
       ══════════════════════════════════════════════════════════════ */

    /**
     * Définit la visibilité d'un objet.
     * @param {number} objectId — L'ID de l'objet.
     * @param {boolean} isVisible — true = visible, false = masqué.
     * @returns {boolean} true si réussi, false si objet inexistant.
     */
    setObjectVisible(objectId, isVisible) {
        const objectData = this._getObjectData(objectId, 'setObjectVisible');
        if (!objectData) return false;

        /* Ne rien faire si la valeur est déjà la même */
        if (objectData.isVisible === isVisible) return true;

        const previousVisible = objectData.isVisible;
        objectData.isVisible = isVisible;
        this._applyObjectVisibility(objectData);
        this._recordObjectChange(objectData, 'isVisible', previousVisible, isVisible);

        if (isVisible) {
            this._emit('object:shown', { objectId: objectId });
        } else {
            this._emit('object:hidden', { objectId: objectId });
            /* Un objet invisible ne peut pas être sélectionné → le retirer de la sélection */
            const selectionManagerVisible = this._voh._objectSelectionManager;
            if (selectionManagerVisible) {
                selectionManagerVisible.deselectOnVisibilityChange(objectData.canvasId, objectId);
            }
        }
        this._requestRender(this._getCanvasDataForObject(objectData));
        /* Mettre à jour la grille spatiale (ajouter ou retirer selon la visibilité) */
        const interactionManagerVisible = this._getInteractionManager();
        if (interactionManagerVisible) interactionManagerVisible.spatialGridUpdateObjectVisibility(objectData, isVisible);
        return true;
    }

    /**
     * Retourne la visibilité d'un objet.
     * @param {number} objectId — L'ID de l'objet.
     * @returns {boolean|null}
     */
    getObjectVisible(objectId) {
        const objectData = this._getObjectData(objectId, 'getObjectVisible');
        if (!objectData) return null;
        return objectData.isVisible;
    }


    /* ══════════════════════════════════════════════════════════════
       OPACITÉ
       ══════════════════════════════════════════════════════════════ */

    /**
     * Définit l'opacité d'un objet (0.0 = transparent, 1.0 = opaque).
     * @param {number} objectId — L'ID de l'objet.
     * @param {number} opacity — Opacité (0.0 à 1.0).
     * @returns {boolean} true si réussi, false si objet inexistant.
     */
    setObjectOpacity(objectId, opacity) {
        const objectData = this._getObjectData(objectId, 'setObjectOpacity');
        if (!objectData) return false;

        /* Borner entre 0.0 et 1.0 */
        opacity = Math.max(0.0, Math.min(1.0, opacity));

        const previousOpacity = objectData.opacity;
        objectData.opacity = opacity;
        this._applyObjectOpacity(objectData);
        this._recordObjectChange(objectData, 'opacity', previousOpacity, opacity);
        this._emit('object:opacityChanged', { objectId: objectId, opacity: opacity });
        this._requestRender(this._getCanvasDataForObject(objectData));
        return true;
    }

    /**
     * Retourne l'opacité d'un objet.
     * @param {number} objectId — L'ID de l'objet.
     * @returns {number|null}
     */
    getObjectOpacity(objectId) {
        const objectData = this._getObjectData(objectId, 'getObjectOpacity');
        if (!objectData) return null;
        return objectData.opacity;
    }


    /* ══════════════════════════════════════════════════════════════
       COULEUR DE FOND
       Utilisée uniquement par le rendu par défaut (sans drawingCallback).
       ══════════════════════════════════════════════════════════════ */

    /**
     * Définit la couleur de fond de l'objet (rendu par défaut).
     * N'a aucun effet si un drawingCallback est défini (c'est le callback
     * qui gère entièrement l'apparence).
     * @param {number} objectId — L'ID de l'objet.
     * @param {string} color — Couleur CSS (hex, rgb, rgba, nom).
     * @returns {boolean} true si réussi, false si objet inexistant.
     */
    setObjectBackgroundColor(objectId, color) {
        const objectData = this._getObjectData(objectId, 'setObjectBackgroundColor');
        if (!objectData) return false;

        const previousBackgroundColor = objectData.backgroundColor;
        objectData.backgroundColor = color;

        /* Redessiner uniquement si pas de callback personnalisé */
        if (!objectData.drawingCallback) {
            this._renderObject(objectData);
        }
        this._recordObjectChange(objectData, 'backgroundColor', previousBackgroundColor, color);

        this._emit('object:backgroundColorChanged', { objectId: objectId, backgroundColor: color });
        this._requestRender(this._getCanvasDataForObject(objectData));
        return true;
    }

    /**
     * Retourne la couleur de fond d'un objet.
     * @param {number} objectId — L'ID de l'objet.
     * @returns {string|null}
     */
    getObjectBackgroundColor(objectId) {
        const objectData = this._getObjectData(objectId, 'getObjectBackgroundColor');
        if (!objectData) return null;
        return objectData.backgroundColor;
    }


    /* ══════════════════════════════════════════════════════════════
       CALLBACK DE DESSIN PERSONNALISÉ
       Comme SetObjectDrawingCallback() dans Editors Factory.
       ══════════════════════════════════════════════════════════════ */

    /**
     * Définit un callback de dessin personnalisé pour un objet.
     *
     * Le callback reçoit 4 paramètres:
     *   - context  {CanvasRenderingContext2D} — Contexte 2D pour dessiner.
     *   - width    {number}                   — Largeur de l'objet en pixels.
     *   - height   {number}                   — Hauteur de l'objet en pixels.
     *   - objectId {number}                   — L'ID de l'objet.
     *
     * L'espace de dessin commence à (0, 0) et va jusqu'à (width, height).
     * Le callback est appelé à chaque fois que l'objet doit être redessiné
     * (changement de taille, appel explicite à redraw, etc.).
     *
     * Passer null pour revenir au rendu par défaut (rectangle gris clair).
     *
     * @param {number} objectId — L'ID de l'objet.
     * @param {Function|null} callback — La fonction de dessin, ou null.
     * @returns {boolean} true si réussi, false si objet inexistant.
     */
    setObjectDrawingCallback(objectId, callback) {
        const objectData = this._getObjectData(objectId, 'setObjectDrawingCallback');
        if (!objectData) return false;

        const previousCallback = objectData.drawingCallback;
        objectData.drawingCallback = callback;

        /* Enregistrer dans l'historique (la référence à la fonction est stockée) */
        this._recordObjectChange(objectData, 'drawingCallback', previousCallback, callback);

        /* Redessiner immédiatement avec le nouveau callback (ou le rendu par défaut) */
        this._renderObject(objectData);
        this._requestRender(this._getCanvasDataForObject(objectData));

        this._emit('object:drawingCallbackChanged', { objectId: objectId, hasCallback: callback !== null });
        return true;
    }

    /**
     * Retourne le callback de dessin d'un objet (ou null si rendu par défaut).
     * @param {number} objectId — L'ID de l'objet.
     * @returns {Function|null|undefined} Le callback, null, ou undefined si objet inexistant.
     */
    getObjectDrawingCallback(objectId) {
        const objectData = this._getObjectData(objectId, 'getObjectDrawingCallback');
        if (!objectData) return undefined;
        return objectData.drawingCallback;
    }

    /**
     * Force le redessin d'un objet.
     * Utile quand le callback de dessin dépend de données externes
     * qui ont changé sans que l'objet lui-même ait été modifié.
     * @param {number} objectId — L'ID de l'objet.
     * @returns {boolean} true si réussi, false si objet inexistant.
     */
    redrawObject(objectId) {
        const objectData = this._getObjectData(objectId, 'redrawObject');
        if (!objectData) return false;

        this._renderObject(objectData);
        this._requestRender(this._getCanvasDataForObject(objectData));
        return true;
    }


    /* ══════════════════════════════════════════════════════════════
       CURSEUR AU SURVOL
       Définit le curseur CSS affiché quand la souris survole l'objet.
       ══════════════════════════════════════════════════════════════ */

    /**
     * Définit le curseur CSS affiché au survol de l'objet.
     * Passer null pour revenir au curseur par défaut du canevas.
     * @param {number} objectId — L'ID de l'objet.
     * @param {string|null} cursor — Curseur CSS (ex: 'pointer', 'move', 'crosshair'), ou null.
     * @returns {boolean} true si réussi, false si objet inexistant.
     */
    setObjectCursor(objectId, cursor) {
        const objectData = this._getObjectData(objectId, 'setObjectCursor');
        if (!objectData) return false;

        /* Le curseur CSS est un état visuel transitoire (ex: grab → grabbing
           pendant un drag). Il n'est PAS enregistré dans l'historique car
           personne ne veut "annuler" un changement de curseur. */
        objectData.cursor = cursor;

        this._emit('object:cursorChanged', { objectId: objectId, cursor: cursor });
        return true;
    }

    /**
     * Retourne le curseur CSS de l'objet, ou null si aucun curseur personnalisé.
     * @param {number} objectId — L'ID de l'objet.
     * @returns {string|null|undefined} Le curseur, null, ou undefined si objet inexistant.
     */
    getObjectCursor(objectId) {
        const objectData = this._getObjectData(objectId, 'getObjectCursor');
        if (!objectData) return undefined;
        return objectData.cursor;
    }


    /* ══════════════════════════════════════════════════════════════
       DRAG SOURIS
       ══════════════════════════════════════════════════════════════ */

    /**
     * Active ou désactive le drag souris sur un objet.
     * @param {number}  objectId  — L'ID de l'objet.
     * @param {boolean} isEnabled — true = drag activé.
     * @returns {boolean} true si réussi, false si objet inexistant.
     */
    setObjectMouseDragEnabled(objectId, isEnabled) {
        const objectData = this._getObjectData(objectId, 'setObjectMouseDragEnabled');
        if (!objectData) return false;
        const previous = objectData.mouseDragEnabled;
        objectData.mouseDragEnabled = isEnabled;
        this._recordObjectChange(objectData, 'mouseDragEnabled', previous, isEnabled);
        this._emit('object:mouseDragEnabledChanged', { objectId: objectId, mouseDragEnabled: isEnabled });

        /* ── Si on désactive pendant un drag actif sur cet objet → annuler le drag ── */
        if (!isEnabled) {
            const interactionManager = this._voh._objectInteractionManager;
            if (interactionManager &&
                interactionManager._activeDrag &&
                interactionManager._activeDrag.objectData.id === objectId) {
                interactionManager._cancelObjectDrag(null); /* null = pas d'événement DOM (annulation programmatique) */
            }
        }

        return true;
    }

    /**
     * Retourne si le drag souris est activé sur l'objet.
     * @param {number} objectId — L'ID de l'objet.
     * @returns {boolean|undefined}
     */
    getObjectMouseDragEnabled(objectId) {
        const objectData = this._getObjectData(objectId, 'getObjectMouseDragEnabled');
        if (!objectData) return undefined;
        return objectData.mouseDragEnabled;
    }

    /**
     * Définit le bouton souris qui déclenche le drag ('left', 'middle', 'right').
     * @param {number} objectId — L'ID de l'objet.
     * @param {string} button   — Bouton souris.
     * @returns {boolean}
     */
    setObjectMouseDragButton(objectId, button) {
        const objectData = this._getObjectData(objectId, 'setObjectMouseDragButton');
        if (!objectData) return false;
        const validButtons = ['left', 'middle', 'right'];
        if (!validButtons.includes(button)) {
            console.error(`[Objects] setObjectMouseDragButton: bouton invalide "${button}". Valeurs acceptées: ${validButtons.join(', ')}.`);
            return false;
        }
        const previous = objectData.mouseDragButton;
        objectData.mouseDragButton = button;
        this._recordObjectChange(objectData, 'mouseDragButton', previous, button);
        this._emit('object:mouseDragButtonChanged', { objectId: objectId, mouseDragButton: button });
        return true;
    }

    /**
     * Retourne le bouton souris configuré pour le drag.
     * @param {number} objectId — L'ID de l'objet.
     * @returns {string|undefined}
     */
    getObjectMouseDragButton(objectId) {
        const objectData = this._getObjectData(objectId, 'getObjectMouseDragButton');
        if (!objectData) return undefined;
        return objectData.mouseDragButton;
    }

    /**
     * Définit le mode de drag ('direct' ou 'preview').
     * 'direct'  → l'objet bouge en temps réel.
     * 'preview' → un fantôme suit la souris, l'objet bouge au relâchement.
     * @param {number} objectId — L'ID de l'objet.
     * @param {string} mode     — 'direct' ou 'preview'.
     * @returns {boolean}
     */
    setObjectMouseDragMode(objectId, mode) {
        const objectData = this._getObjectData(objectId, 'setObjectMouseDragMode');
        if (!objectData) return false;
        const validModes = ['direct', 'preview'];
        if (!validModes.includes(mode)) {
            console.error(`[Objects] setObjectMouseDragMode: mode invalide "${mode}". Valeurs acceptées: ${validModes.join(', ')}.`);
            return false;
        }
        const previous = objectData.mouseDragMode;
        objectData.mouseDragMode = mode;
        this._recordObjectChange(objectData, 'mouseDragMode', previous, mode);
        this._emit('object:mouseDragModeChanged', { objectId: objectId, mouseDragMode: mode });
        return true;
    }

    /**
     * Retourne le mode de drag de l'objet.
     * @param {number} objectId — L'ID de l'objet.
     * @returns {string|undefined}
     */
    getObjectMouseDragMode(objectId) {
        const objectData = this._getObjectData(objectId, 'getObjectMouseDragMode');
        if (!objectData) return undefined;
        return objectData.mouseDragMode;
    }

    /**
     * Définit le décalage X du drag (pixels, 0 = position naturelle sous le curseur).
     * @param {number} objectId — L'ID de l'objet.
     * @param {number} value    — Décalage en pixels.
     * @returns {boolean}
     */
    setObjectMouseDragOffsetX(objectId, value) {
        const objectData = this._getObjectData(objectId, 'setObjectMouseDragOffsetX');
        if (!objectData) return false;
        const previous = objectData.mouseDragOffsetX;
        objectData.mouseDragOffsetX = value;
        this._recordObjectChange(objectData, 'mouseDragOffsetX', previous, value);
        this._emit('object:mouseDragOffsetXChanged', { objectId: objectId, mouseDragOffsetX: value });
        return true;
    }

    /**
     * Retourne le décalage X du drag.
     * @param {number} objectId — L'ID de l'objet.
     * @returns {number|undefined}
     */
    getObjectMouseDragOffsetX(objectId) {
        const objectData = this._getObjectData(objectId, 'getObjectMouseDragOffsetX');
        if (!objectData) return undefined;
        return objectData.mouseDragOffsetX;
    }

    /**
     * Définit le décalage Y du drag (pixels, 0 = position naturelle sous le curseur).
     * @param {number} objectId — L'ID de l'objet.
     * @param {number} value    — Décalage en pixels.
     * @returns {boolean}
     */
    setObjectMouseDragOffsetY(objectId, value) {
        const objectData = this._getObjectData(objectId, 'setObjectMouseDragOffsetY');
        if (!objectData) return false;
        const previous = objectData.mouseDragOffsetY;
        objectData.mouseDragOffsetY = value;
        this._recordObjectChange(objectData, 'mouseDragOffsetY', previous, value);
        this._emit('object:mouseDragOffsetYChanged', { objectId: objectId, mouseDragOffsetY: value });
        return true;
    }

    /**
     * Retourne le décalage Y du drag.
     * @param {number} objectId — L'ID de l'objet.
     * @returns {number|undefined}
     */
    getObjectMouseDragOffsetY(objectId) {
        const objectData = this._getObjectData(objectId, 'getObjectMouseDragOffsetY');
        if (!objectData) return undefined;
        return objectData.mouseDragOffsetY;
    }

    /**
     * Définit le callback de dessin du fantôme en mode preview.
     * Signature : function(context, width, height, objectId)
     * null = pointillés bleus par défaut.
     * @param {number}        objectId — L'ID de l'objet.
     * @param {Function|null} callback — Callback de dessin ou null.
     * @returns {boolean}
     */
    setObjectMouseDragPreviewCallback(objectId, callback) {
        const objectData = this._getObjectData(objectId, 'setObjectMouseDragPreviewCallback');
        if (!objectData) return false;
        const previous = objectData.mouseDragPreviewCallback;
        objectData.mouseDragPreviewCallback = callback;
        this._recordObjectChange(objectData, 'mouseDragPreviewCallback', previous, callback);
        this._emit('object:mouseDragPreviewCallbackChanged', { objectId: objectId, hasCallback: callback !== null });
        return true;
    }

    /**
     * Retourne le callback de dessin du fantôme (ou null si défaut).
     * @param {number} objectId — L'ID de l'objet.
     * @returns {Function|null|undefined}
     */
    getObjectMouseDragPreviewCallback(objectId) {
        const objectData = this._getObjectData(objectId, 'getObjectMouseDragPreviewCallback');
        if (!objectData) return undefined;
        return objectData.mouseDragPreviewCallback;
    }

    /**
     * Définit le mode de déplacement en multi-sélection.
     * 'direct' = l'objet bouge en temps réel.
     * 'preview' = un fantôme suit la souris.
     * null = hérite de mouseDragMode (comportement par défaut).
     * @param {number}      objectId — L'ID de l'objet.
     * @param {string|null} mode     — 'direct', 'preview' ou null.
     * @returns {boolean}
     */
    setObjectMouseDragMultiMode(objectId, mode) {
        const objectData = this._getObjectData(objectId, 'setObjectMouseDragMultiMode');
        if (!objectData) return false;
        if (mode !== null && mode !== 'direct' && mode !== 'preview') {
            console.warn(`[Objects] setObjectMouseDragMultiMode: mode invalide "${mode}". Valeurs: 'direct', 'preview', null.`);
            return false;
        }
        const previous = objectData.mouseDragMultiMode;
        objectData.mouseDragMultiMode = mode;
        this._recordObjectChange(objectData, 'mouseDragMultiMode', previous, mode);
        return true;
    }

    /**
     * Retourne le mode de déplacement en multi-sélection (ou null si hérite du solo).
     * @param {number} objectId — L'ID de l'objet.
     * @returns {string|null|undefined}
     */
    getObjectMouseDragMultiMode(objectId) {
        const objectData = this._getObjectData(objectId, 'getObjectMouseDragMultiMode');
        if (!objectData) return undefined;
        return objectData.mouseDragMultiMode;
    }

    /**
     * Définit le callback de dessin du fantôme en multi-sélection.
     * null = hérite de mouseDragPreviewCallback.
     * @param {number}        objectId — L'ID de l'objet.
     * @param {Function|null} callback — Callback de dessin ou null.
     * @returns {boolean}
     */
    setObjectMouseDragMultiPreviewCallback(objectId, callback) {
        const objectData = this._getObjectData(objectId, 'setObjectMouseDragMultiPreviewCallback');
        if (!objectData) return false;
        const previous = objectData.mouseDragMultiPreviewCallback;
        objectData.mouseDragMultiPreviewCallback = callback;
        this._recordObjectChange(objectData, 'mouseDragMultiPreviewCallback', previous, callback);
        return true;
    }

    /**
     * Retourne le callback de dessin du fantôme en multi-sélection (ou null).
     * @param {number} objectId — L'ID de l'objet.
     * @returns {Function|null|undefined}
     */
    getObjectMouseDragMultiPreviewCallback(objectId) {
        const objectData = this._getObjectData(objectId, 'getObjectMouseDragMultiPreviewCallback');
        if (!objectData) return undefined;
        return objectData.mouseDragMultiPreviewCallback;
    }


    /* ══════════════════════════════════════════════════════════════
       CONTOUR DE SÉLECTION — Apparence configurable par objet
       ══════════════════════════════════════════════════════════════ */

    /**
     * Définit la couleur du contour de sélection de l'objet.
     * @param {number} objectId — L'ID de l'objet.
     * @param {string} color    — Couleur CSS (ex: 'rgba(0, 120, 215, 0.9)').
     * @returns {boolean}
     */
    setObjectSelectionBorderColor(objectId, color) {
        const objectData = this._getObjectData(objectId, 'setObjectSelectionBorderColor');
        if (!objectData) return false;
        const previous = objectData.selectionBorderColor;
        objectData.selectionBorderColor = color;
        this._recordObjectChange(objectData, 'selectionBorderColor', previous, color);
        this._updateSelectionOutlineIfSelected(objectData);
        return true;
    }

    /**
     * Retourne la couleur du contour de sélection de l'objet.
     * @param {number} objectId — L'ID de l'objet.
     * @returns {string|undefined}
     */
    getObjectSelectionBorderColor(objectId) {
        const objectData = this._getObjectData(objectId, 'getObjectSelectionBorderColor');
        if (!objectData) return undefined;
        return objectData.selectionBorderColor;
    }

    /**
     * Définit l'épaisseur du contour de sélection de l'objet (pixels).
     * @param {number} objectId   — L'ID de l'objet.
     * @param {number} thickness  — Épaisseur en pixels.
     * @returns {boolean}
     */
    setObjectSelectionBorderThickness(objectId, thickness) {
        const objectData = this._getObjectData(objectId, 'setObjectSelectionBorderThickness');
        if (!objectData) return false;
        const previous = objectData.selectionBorderThickness;
        objectData.selectionBorderThickness = thickness;
        this._recordObjectChange(objectData, 'selectionBorderThickness', previous, thickness);
        this._updateSelectionOutlineIfSelected(objectData);
        return true;
    }

    /**
     * Retourne l'épaisseur du contour de sélection de l'objet.
     * @param {number} objectId — L'ID de l'objet.
     * @returns {number|undefined}
     */
    getObjectSelectionBorderThickness(objectId) {
        const objectData = this._getObjectData(objectId, 'getObjectSelectionBorderThickness');
        if (!objectData) return undefined;
        return objectData.selectionBorderThickness;
    }

    /**
     * Définit la marge entre l'objet et son contour de sélection (pixels).
     * @param {number} objectId — L'ID de l'objet.
     * @param {number} offset   — Marge en pixels.
     * @returns {boolean}
     */
    setObjectSelectionBorderOffset(objectId, offset) {
        const objectData = this._getObjectData(objectId, 'setObjectSelectionBorderOffset');
        if (!objectData) return false;
        const previous = objectData.selectionBorderOffset;
        objectData.selectionBorderOffset = offset;
        this._recordObjectChange(objectData, 'selectionBorderOffset', previous, offset);
        this._updateSelectionOutlineIfSelected(objectData);
        return true;
    }

    /**
     * Retourne la marge entre l'objet et son contour de sélection.
     * @param {number} objectId — L'ID de l'objet.
     * @returns {number|undefined}
     */
    getObjectSelectionBorderOffset(objectId) {
        const objectData = this._getObjectData(objectId, 'getObjectSelectionBorderOffset');
        if (!objectData) return undefined;
        return objectData.selectionBorderOffset;
    }

    /**
     * Définit le style du contour de sélection ('solid', 'dashed', 'dotted').
     * @param {number} objectId — L'ID de l'objet.
     * @param {string} style    — 'solid', 'dashed' ou 'dotted'.
     * @returns {boolean}
     */
    setObjectSelectionBorderStyle(objectId, style) {
        const objectData = this._getObjectData(objectId, 'setObjectSelectionBorderStyle');
        if (!objectData) return false;
        if (OBJECT_SELECTION_BORDER_STYLES_VALID.indexOf(style) === -1) {
            console.warn(`[Objects] setObjectSelectionBorderStyle: style invalide "${style}". Valeurs: 'solid', 'dashed', 'dotted'.`);
            return false;
        }
        const previous = objectData.selectionBorderStyle;
        objectData.selectionBorderStyle = style;
        this._recordObjectChange(objectData, 'selectionBorderStyle', previous, style);
        this._updateSelectionOutlineIfSelected(objectData);
        return true;
    }

    /**
     * Retourne le style du contour de sélection.
     * @param {number} objectId — L'ID de l'objet.
     * @returns {string|undefined}
     */
    getObjectSelectionBorderStyle(objectId) {
        const objectData = this._getObjectData(objectId, 'getObjectSelectionBorderStyle');
        if (!objectData) return undefined;
        return objectData.selectionBorderStyle;
    }

    /**
     * Définit le mode de sélection par rectangle pour cet objet.
     * 'enclosed' (défaut) = l'objet doit être entièrement dans le rectangle.
     * 'intersect' = sélectionné dès qu'il touche le rectangle.
     * 'enclosed' = doit être entièrement contenu dans le rectangle.
     * @param {number}      objectId — L'ID de l'objet.
     * @param {string} mode     — 'intersect' ou 'enclosed'.
     * @returns {boolean}
     */
    setObjectSelectionMode(objectId, mode) {
        const objectData = this._getObjectData(objectId, 'setObjectSelectionMode');
        if (!objectData) return false;
        /* null est accepté et converti silencieusement en 'enclosed' (défaut) */
        if (mode === null || mode === undefined) mode = 'enclosed';
        if (OBJECT_SELECTION_MODES_VALID.indexOf(mode) === -1) {
            console.warn(`[Objects] setObjectSelectionMode: mode invalide "${mode}". Valeurs: 'intersect', 'enclosed'.`);
            return false;
        }
        const previous = objectData.selectionMode;
        objectData.selectionMode = mode;
        this._recordObjectChange(objectData, 'selectionMode', previous, mode);
        return true;
    }

    /**
     * Retourne le mode de sélection par rectangle de l'objet.
     * @param {number} objectId — L'ID de l'objet.
     * @returns {string|undefined} 'enclosed' ou 'intersect'.
     */
    getObjectSelectionMode(objectId) {
        const objectData = this._getObjectData(objectId, 'getObjectSelectionMode');
        if (!objectData) return undefined;
        return objectData.selectionMode;
    }

    /**
     * Met à jour le contour de sélection si l'objet est actuellement sélectionné.
     * Appelé après modification d'une propriété visuelle de sélection ou de position/taille.
     * @param {Object} objectData — Les données de l'objet.
     * @private
     */
    _updateSelectionOutlineIfSelected(objectData) {
        const selectionManager = this._voh._objectSelectionManager;
        if (!selectionManager) return;
        if (selectionManager.isSelected(objectData.canvasId, objectData.id)) {
            selectionManager.updateSelectionOutline(objectData);
        }
    }


    /* ══════════════════════════════════════════════════════════════
       Z-ORDER
       ══════════════════════════════════════════════════════════════ */

    /**
     * Place un objet au premier plan (z-order le plus élevé).
     * @param {number} objectId — L'ID de l'objet.
     * @returns {boolean} true si réussi, false si objet inexistant.
     */
    bringObjectToFront(objectId) {
        const objectData = this._getObjectData(objectId, 'bringObjectToFront');
        if (!objectData) return false;

        /* Trouver le z-order maximum parmi les objets du même canevas */
        let maxZOrder = 0;
        for (const data of this._objects.values()) {
            if (data.canvasId === objectData.canvasId && data.zOrder > maxZOrder) {
                maxZOrder = data.zOrder;
            }
        }

        /* Si déjà au premier plan, ne rien faire */
        if (objectData.zOrder === maxZOrder) return true;

        objectData.zOrder = maxZOrder + 1;
        this._applyObjectZOrder(objectData);
        this._emit('object:zOrderChanged', { objectId: objectId, zOrder: objectData.zOrder });
        return true;
    }

    /**
     * Place un objet en arrière-plan (z-order le plus bas).
     * @param {number} objectId — L'ID de l'objet.
     * @returns {boolean} true si réussi, false si objet inexistant.
     */
    sendObjectToBack(objectId) {
        const objectData = this._getObjectData(objectId, 'sendObjectToBack');
        if (!objectData) return false;

        /* Trouver le z-order minimum parmi les objets du même canevas */
        let minZOrder = Infinity;
        for (const data of this._objects.values()) {
            if (data.canvasId === objectData.canvasId && data.zOrder < minZOrder) {
                minZOrder = data.zOrder;
            }
        }

        /* Si déjà en arrière-plan, ne rien faire */
        if (objectData.zOrder === minZOrder) return true;

        objectData.zOrder = minZOrder - 1;
        this._applyObjectZOrder(objectData);
        this._emit('object:zOrderChanged', { objectId: objectId, zOrder: objectData.zOrder });
        return true;
    }

    /**
     * Monte un objet d'un cran dans le z-order (parmi les objets du même canevas).
     * @param {number} objectId — L'ID de l'objet.
     * @returns {boolean} true si réussi, false si objet inexistant.
     */
    moveObjectUp(objectId) {
        const objectData = this._getObjectData(objectId, 'moveObjectUp');
        if (!objectData) return false;

        /* Trier les objets du même canevas par z-order croissant */
        const sortedObjects = Array.from(this._objects.values())
            .filter(data => data.canvasId === objectData.canvasId)
            .sort((a, b) => a.zOrder - b.zOrder);

        /* Trouver l'index de l'objet courant */
        const currentIndex = sortedObjects.findIndex(data => data.id === objectId);

        /* Si déjà au sommet, ne rien faire */
        if (currentIndex >= sortedObjects.length - 1) return true;

        /* Échanger les z-order avec l'objet juste au-dessus */
        const objectAbove = sortedObjects[currentIndex + 1];
        const tempZOrder = objectData.zOrder;
        objectData.zOrder = objectAbove.zOrder;
        objectAbove.zOrder = tempZOrder;

        this._applyObjectZOrder(objectData);
        this._applyObjectZOrder(objectAbove);

        this._emit('object:zOrderChanged', { objectId: objectId, zOrder: objectData.zOrder });
        this._emit('object:zOrderChanged', { objectId: objectAbove.id, zOrder: objectAbove.zOrder });
        return true;
    }

    /**
     * Descend un objet d'un cran dans le z-order (parmi les objets du même canevas).
     * @param {number} objectId — L'ID de l'objet.
     * @returns {boolean} true si réussi, false si objet inexistant.
     */
    moveObjectDown(objectId) {
        const objectData = this._getObjectData(objectId, 'moveObjectDown');
        if (!objectData) return false;

        /* Trier les objets du même canevas par z-order croissant */
        const sortedObjects = Array.from(this._objects.values())
            .filter(data => data.canvasId === objectData.canvasId)
            .sort((a, b) => a.zOrder - b.zOrder);

        /* Trouver l'index de l'objet courant */
        const currentIndex = sortedObjects.findIndex(data => data.id === objectId);

        /* Si déjà tout en bas, ne rien faire */
        if (currentIndex <= 0) return true;

        /* Échanger les z-order avec l'objet juste en-dessous */
        const objectBelow = sortedObjects[currentIndex - 1];
        const tempZOrder = objectData.zOrder;
        objectData.zOrder = objectBelow.zOrder;
        objectBelow.zOrder = tempZOrder;

        this._applyObjectZOrder(objectData);
        this._applyObjectZOrder(objectBelow);

        this._emit('object:zOrderChanged', { objectId: objectId, zOrder: objectData.zOrder });
        this._emit('object:zOrderChanged', { objectId: objectBelow.id, zOrder: objectBelow.zOrder });
        return true;
    }

    /**
     * Définit le z-order d'un objet à une valeur précise.
     * Si un autre objet du même canevas a déjà ce z-order,
     * tous les objets ayant un z-order >= à la valeur demandée
     * sont décalés de +1 pour libérer la place.
     * @param {number} objectId — L'ID de l'objet.
     * @param {number} zOrder — La valeur de z-order souhaitée (nombre entier).
     * @returns {boolean} true si réussi, false si objet inexistant.
     */
    setObjectZOrder(objectId, zOrder) {
        const objectData = this._getObjectData(objectId, 'setObjectZOrder');
        if (!objectData) return false;

        /* Convertir en entier pour éviter les flottants */
        const newZOrder = Math.round(zOrder);

        /* Si la valeur est identique, ne rien faire */
        if (objectData.zOrder === newZOrder) return true;

        /* Vérifier si un autre objet du même canevas a déjà ce z-order */
        const conflictingObjects = [];
        for (const [id, data] of this._objects) {
            if (id !== objectId && data.canvasId === objectData.canvasId && data.zOrder >= newZOrder) {
                conflictingObjects.push(data);
            }
        }

        /* Décaler les objets en conflit vers le haut (+1) */
        if (conflictingObjects.length > 0) {
            /* Trier par z-order décroissant pour décaler du plus haut vers le plus bas */
            conflictingObjects.sort((a, b) => b.zOrder - a.zOrder);
            for (const conflicting of conflictingObjects) {
                conflicting.zOrder += 1;
                this._applyObjectZOrder(conflicting);
                this._emit('object:zOrderChanged', { objectId: conflicting.id, zOrder: conflicting.zOrder });
            }
        }

        objectData.zOrder = newZOrder;
        this._applyObjectZOrder(objectData);
        this._emit('object:zOrderChanged', { objectId: objectId, zOrder: objectData.zOrder });
        return true;
    }

    /**
     * Retourne le z-order d'un objet.
     * @param {number} objectId — L'ID de l'objet.
     * @returns {number|null}
     */
    getObjectZOrder(objectId) {
        const objectData = this._getObjectData(objectId, 'getObjectZOrder');
        if (!objectData) return null;
        return objectData.zOrder;
    }


    /* ══════════════════════════════════════════════════════════════
       SUPPRESSION EN CASCADE (appelé par CanvasManager)
       Quand un canevas est supprimé, tous ses objets doivent l'être.
       ══════════════════════════════════════════════════════════════ */

    /**
     * Supprime tous les objets d'un canevas.
     * Appelé automatiquement quand un canevas est supprimé.
     * @param {number} canvasId — L'ID du canevas dont les objets doivent être supprimés.
     * @returns {number} Le nombre d'objets supprimés.
     */
    deleteObjectsByCanvas(canvasId) {
        const objectIdsToDelete = [];
        for (const [objectId, objectData] of this._objects) {
            if (objectData.canvasId === canvasId) {
                objectIdsToDelete.push(objectId);
            }
        }

        for (const objectId of objectIdsToDelete) {
            this.deleteObject(objectId);
        }

        return objectIdsToDelete.length;
    }


    /* ══════════════════════════════════════════════════════════════
       DESTRUCTION
       ══════════════════════════════════════════════════════════════ */

    /**
     * Détruit tous les objets et libère les ressources.
     * Appelé par VisualObjectsHandler.destroy().
     */
    destroy() {

        /* ── Détruire tous les objets actifs ── */
        for (const objectData of this._objects.values()) {
            if (objectData.pixiContainer) {
                if (objectData._pixiSprite && objectData._pixiSprite.texture) {
                    objectData._pixiSprite.texture.destroy(true);
                }
                if (objectData.pixiContainer.parent) {
                    objectData.pixiContainer.parent.removeChild(objectData.pixiContainer);
                }
                objectData.pixiContainer.destroy({ children: true });
            }
        }
        this._objects.clear();

        /* ── Détruire tous les objets détachés du pool ── */
        for (const cached of this._detachedObjects.values()) {
            if (cached.pixiContainer) {
                if (cached._pixiSprite && cached._pixiSprite.texture) {
                    cached._pixiSprite.texture.destroy(true);
                }
                if (cached.pixiContainer.parent) {
                    cached.pixiContainer.parent.removeChild(cached.pixiContainer);
                }
                cached.pixiContainer.destroy({ children: true });
            }
        }
        this._detachedObjects.clear();

        console.log('[Objects] Tous les objets détruits (actifs + pool).');
    }
}


/* ═══════════════════════════════════════════════════════════════════════════
   EXPOSITION GLOBALE
   ═══════════════════════════════════════════════════════════════════════════ */
window.ObjectManager = ObjectManager;
