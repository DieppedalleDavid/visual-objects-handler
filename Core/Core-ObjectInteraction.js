/* ═══════════════════════════════════════════════════════════════════════════
   CORE-OBJECTINTERACTION.JS — Événements souris et molette sur les objets

   Gère l'interaction souris avec les objets de chaque canevas.
   Utilise une grille spatiale multi-niveaux (Core-SpatialGrid.js) pour
   un hit-test optimisé à O(1) même avec 20 000+ objets par page.

   ══════════════════════════════════════════════════════════════════════════
   SÉLECTION INTERACTIVE
   ══════════════════════════════════════════════════════════════════════════

   - Clic gauche sur un objet (sans Ctrl) → sélection exclusive (selectOnly)
   - Ctrl+clic gauche sur un objet → bascule (toggle) ajouter/retirer
   - Clic gauche sur le fond → désélectionner tout (deselectAll)
   - Rectangle de sélection → sélectionner tous les objets intersectés
   - Ctrl + rectangle de sélection → ajouter les objets intersectés

   ══════════════════════════════════════════════════════════════════════════
   ÉVÉNEMENTS ÉMIS
   ══════════════════════════════════════════════════════════════════════════

   Événements objet (émis quand la souris interagit avec un objet):
   - object:click          — clic (gauche, milieu ou droit)
   - object:dblclick       — double-clic
   - object:mousedown      — bouton souris enfoncé
   - object:mouseup        — bouton souris relâché
   - object:mouseenter     — la souris entre dans l'objet
   - object:mouseleave     — la souris quitte l'objet
   - object:mousemove      — la souris bouge sur l'objet
   - object:wheel          — molette souris sur l'objet
   - object:contextmenu    — clic droit (menu contextuel)

   Événements canevas (émis quand la souris interagit avec le fond du canevas):
   - canvas:click          — clic sur le fond (aucun objet sous le curseur)
   - canvas:dblclick       — double-clic sur le fond
   - canvas:mousedown      — bouton enfoncé sur le fond
   - canvas:mouseup        — bouton relâché sur le fond
   - canvas:mousemove      — la souris bouge sur le fond
   - canvas:wheel          — molette sur le fond
   - canvas:contextmenu    — clic droit sur le fond

   ══════════════════════════════════════════════════════════════════════════
   COORDINATION AVEC CanvasSelection

   Si la sélection souris est en cours de tracé (selectionIsDrawing = true),
   les événements d'interaction objet sont SUSPENDUS pour éviter les conflits.
   Le mousedown qui initie la sélection est AUSSI transmis normalement
   (il arrive avant que selectionIsDrawing passe à true).

   ══════════════════════════════════════════════════════════════════════════

   Licence: Open Source (licence à définir)
   Auteur: David Dieppedalle (ShadowStorm)
   ═══════════════════════════════════════════════════════════════════════════ */

'use strict';


/* ═══════════════════════════════════════════════════════════════════════════
   CONSTANTES
   ═══════════════════════════════════════════════════════════════════════════ */

/** Noms des boutons souris indexés par event.button (0=gauche, 1=milieu, 2=droit). */
const INTERACTION_MOUSE_BUTTON_NAMES = ['left', 'middle', 'right'];


/* ═══════════════════════════════════════════════════════════════════════════
   CLASSE: ObjectInteractionManager

   Une instance par instance VOH. Gère les événements souris de tous les
   canevas et utilise la grille spatiale pour le hit-test.
   ═══════════════════════════════════════════════════════════════════════════ */
class ObjectInteractionManager {

    /**
     * @param {VisualObjectsHandler} vohInstance — Référence à l'instance VOH.
     */
    constructor(vohInstance) {

        /** Référence à l'instance VOH parente. */
        this._voh = vohInstance;

        /**
         * Grille spatiale pour le hit-test optimisé.
         * Contient uniquement les objets de la page active du canevas actif.
         * Reconstruite à chaque changement de page ou de canevas actif.
         * @type {SpatialGrid}
         */
        this._spatialGrid = new SpatialGrid();

        /**
         * ID du canevas dont la grille spatiale est actuellement construite.
         * Permet de savoir si on doit reconstruire la grille lors d'un
         * changement de canevas actif.
         * @type {number|null}
         */
        this._spatialGridCanvasId = null;

        /**
         * ID de la page dont la grille spatiale est actuellement construite.
         * @type {number|null}
         */
        this._spatialGridPageId = null;

        /**
         * L'objet actuellement sous la souris (pour mouseenter/mouseleave).
         * Map<canvasId, objectId|null> — un suivi par canevas.
         * @type {Map<number, number|null>}
         */
        this._objectUnderCursor = new Map();

        /**
         * État du drag en cours (une seule souris = un seul drag à la fois).
         * null si aucun drag actif.
         * @type {Object|null}
         * Structure :
         * {
         *   canvasId      : number,
         *   objectData    : Object,       — données de l'objet draggé
         *   button        : string,       — 'left'|'middle'|'right'
         *   buttonCode    : number,       — 0|1|2
         *   startMouseX   : number,       — position absolue souris au départ
         *   startMouseY   : number,
         *   offsetX       : number,       — décalage souris→coin haut-gauche objet
         *   offsetY       : number,
         *   originalX     : number,       — position objet avant le drag (pour annulation)
         *   originalY     : number,
         *   hasMoved      : boolean,      — true si la souris a bougé d'au moins 1px
         *   previewSprite  : PIXI.Sprite|null,   — fantôme en mode preview
         *   previewTexture : PIXI.Texture|null,
         *   _docMouseMove : Function,     — handler document.mousemove
         *   _docMouseUp   : Function,     — handler document.mouseup
         *   _docKeyDown   : Function      — handler document.keydown (Escape)
         * }
         */
        this._activeDrag = null;

        /**
         * Handlers d'événements stockés par canevas pour le nettoyage.
         * Map<canvasId, { mousedown, mouseup, mousemove, click, dblclick, wheel, contextmenu }>
         * @type {Map<number, Object>}
         */
        this._eventHandlers = new Map();

        /* ── Écouter la fin du rectangle de sélection pour sélectionner les objets ── */
        const eventEmitter = vohInstance.getEventEmitter();
        if (eventEmitter) {
            this._onSelectionEndedBound = (data) => this._onCanvasSelectionEnded(data);
            eventEmitter.on('canvas:selectionEnded', this._onSelectionEndedBound);
        }
    }


    /* ══════════════════════════════════════════════════════════════
       RACCOURCIS INTERNES
       ══════════════════════════════════════════════════════════════ */

    /** Émet un événement via l'EventEmitter global. */
    _emit(eventName, data) {
        const eventEmitter = this._voh.getEventEmitter();
        if (eventEmitter) eventEmitter.emit(eventName, data);
    }

    /** Retourne l'ObjectManager. */
    _getObjectManager() {
        return this._voh._objectManager;
    }

    /** Retourne le CanvasManager. */
    _getCanvasManager() {
        return this._voh._canvasManager;
    }

    /** Retourne l'ObjectSelectionManager. */
    _getObjectSelectionManager() {
        return this._voh._objectSelectionManager;
    }


    /* ══════════════════════════════════════════════════════════════
       GRILLE SPATIALE — Construction et maintenance

       La grille contient les objets de la page active d'un canevas.
       Elle est reconstruite quand:
       - Le canevas actif change
       - La page active d'un canevas change
       - On le demande explicitement (rebuildSpatialGrid)

       Elle est mise à jour incrémentalement quand:
       - Un objet est créé → insert
       - Un objet est supprimé → remove
       - Un objet bouge/change de taille → update
       - Un objet change de visibilité → insert/remove
       ══════════════════════════════════════════════════════════════ */

    /**
     * Reconstruit la grille spatiale pour un canevas et sa page active.
     * @param {number} canvasId — L'ID du canevas.
     */
    rebuildSpatialGrid(canvasId) {

        const canvasManager = this._getCanvasManager();
        if (!canvasManager) return;

        const canvasData = canvasManager._canvases.get(canvasId);
        if (!canvasData) return;

        const activePageId = canvasData.activePageId;
        const objectManager = this._getObjectManager();
        if (!objectManager) return;

        /* ── Vider et reconstruire ── */
        this._spatialGrid.clear();
        this._spatialGridCanvasId = canvasId;
        this._spatialGridPageId = activePageId;

        /* ── Insérer tous les objets visibles de la page active ── */
        for (const objectData of objectManager._objects.values()) {
            if (objectData.canvasId === canvasId &&
                objectData.pageId === activePageId &&
                objectData.isVisible) {
                this._spatialGrid.insert(
                    objectData.id, objectData.x, objectData.y,
                    objectData.width, objectData.height
                );
            }
        }
    }

    /**
     * Insère un objet dans la grille spatiale (si c'est sur la page active et visible).
     * Appelé par ObjectManager après la création d'un objet.
     * @param {Object} objectData — Les données de l'objet.
     */
    spatialGridInsertObject(objectData) {
        if (objectData.canvasId !== this._spatialGridCanvasId) return;
        if (objectData.pageId !== this._spatialGridPageId) return;
        if (!objectData.isVisible) return;
        this._spatialGrid.insert(
            objectData.id, objectData.x, objectData.y,
            objectData.width, objectData.height
        );
    }

    /**
     * Retire un objet de la grille spatiale.
     * Appelé par ObjectManager avant la suppression d'un objet.
     * @param {number} objectId — L'ID de l'objet.
     */
    spatialGridRemoveObject(objectId) {
        this._spatialGrid.remove(objectId);
    }

    /**
     * Met à jour un objet dans la grille spatiale (position ou taille changée).
     * Appelé par ObjectManager après modification de x, y, width ou height.
     * @param {Object} objectData — Les données de l'objet (avec les nouvelles valeurs).
     */
    spatialGridUpdateObject(objectData) {
        if (objectData.canvasId !== this._spatialGridCanvasId) return;
        if (objectData.pageId !== this._spatialGridPageId) return;
        this._spatialGrid.update(
            objectData.id, objectData.x, objectData.y,
            objectData.width, objectData.height
        );
    }

    /**
     * Gère le changement de visibilité d'un objet dans la grille.
     * @param {Object} objectData — Les données de l'objet.
     * @param {boolean} isVisible — Nouvelle visibilité.
     */
    spatialGridUpdateObjectVisibility(objectData, isVisible) {
        if (objectData.canvasId !== this._spatialGridCanvasId) return;
        if (objectData.pageId !== this._spatialGridPageId) return;

        if (isVisible) {
            /* Devenu visible → insérer dans la grille */
            this._spatialGrid.insert(
                objectData.id, objectData.x, objectData.y,
                objectData.width, objectData.height
            );
        } else {
            /* Devenu invisible → retirer de la grille */
            this._spatialGrid.remove(objectData.id);
        }
    }

    /**
     * Retourne les statistiques de la grille spatiale (pour le diagnostic).
     * @returns {Object} { objectCount, cellCounts, totalCells }
     */
    getSpatialGridStatistics() {
        return this._spatialGrid.getStatistics();
    }


    /* ══════════════════════════════════════════════════════════════
       HIT-TEST — Trouver l'objet sous un point

       1. Interroge la grille spatiale → candidats (O(1))
       2. Filtre les candidats: visible, sur la bonne page
       3. Test précis: le point est-il dans le rectangle de l'objet ?
       4. Trie par z-order décroissant → le premier gagne
       ══════════════════════════════════════════════════════════════ */

    /**
     * Trouve l'objet le plus haut (z-order max) sous le point (x, y).
     * @param {number} canvasId — L'ID du canevas.
     * @param {number} x — Position X relative au canevas.
     * @param {number} y — Position Y relative au canevas.
     * @returns {Object|null} objectData de l'objet trouvé, ou null.
     */
    hitTest(canvasId, x, y) {

        /* ── S'assurer que la grille est à jour pour ce canevas ── */
        if (canvasId !== this._spatialGridCanvasId) {
            this.rebuildSpatialGrid(canvasId);
        }

        const objectManager = this._getObjectManager();
        if (!objectManager) return null;

        /* ── Obtenir les candidats depuis la grille spatiale ── */
        const candidateIds = this._spatialGrid.queryCandidates(x, y);
        if (candidateIds.length === 0) return null;

        /* ── Test précis + tri par z-order ── */
        let bestObject = null;
        let bestZOrder = -Infinity;

        for (let i = 0; i < candidateIds.length; i++) {
            const objectData = objectManager._objects.get(candidateIds[i]);
            if (!objectData) continue;

            /* Vérifier la visibilité */
            if (!objectData.isVisible) continue;

            /* Vérifier la page active */
            if (objectData.pageId !== this._spatialGridPageId) continue;

            /* Test précis: le point est-il dans le rectangle ? */
            if (x >= objectData.x && x < objectData.x + objectData.width &&
                y >= objectData.y && y < objectData.y + objectData.height) {

                /* Garder l'objet avec le z-order le plus élevé */
                if (objectData.zOrder > bestZOrder) {
                    bestZOrder = objectData.zOrder;
                    bestObject = objectData;
                }
            }
        }

        return bestObject;
    }


    /* ══════════════════════════════════════════════════════════════
       BRANCHEMENT DES ÉVÉNEMENTS SOURIS SUR UN CANEVAS

       Appelé à la création de chaque canevas.
       Les handlers capturent les événements DOM, font le hit-test,
       et émettent les événements VOH correspondants.
       ══════════════════════════════════════════════════════════════ */

    /**
     * Branche les événements souris et molette sur un canevas.
     * @param {Object} canvasData — Les données du canevas.
     */
    initInteractionEvents(canvasData) {

        const self = this;
        const canvasId = canvasData.id;
        const element = canvasData.element;

        /* ── Fonction utilitaire : coordonnées souris relatives au canevas ── */
        function _getRelativePosition(event) {
            const rect = element.getBoundingClientRect();
            return {
                x: event.clientX - rect.left,
                y: event.clientY - rect.top
            };
        }

        /* ── Fonction utilitaire : données de base de l'événement ── */
        function _buildEventData(objectData, position, event) {
            return {
                objectId:      objectData.id,
                canvasId:      canvasId,
                x:             position.x,
                y:             position.y,
                button:        INTERACTION_MOUSE_BUTTON_NAMES[event.button] || 'left',
                originalEvent: event
            };
        }

        /* ── Fonction utilitaire : données de base pour événement canevas ── */
        function _buildCanvasEventData(position, event) {
            return {
                canvasId:      canvasId,
                x:             position.x,
                y:             position.y,
                button:        INTERACTION_MOUSE_BUTTON_NAMES[event.button] || 'left',
                originalEvent: event
            };
        }

        /* ── Vérifier si la sélection est en cours de tracé ── */
        function _isSelectionDrawing() {
            return canvasData.selectionIsDrawing === true;
        }

        /* ══════════════════════════════════════════════════════════
           HANDLER: mousedown
           — Sélection d'objet: sans Ctrl → selectOnly (sauf si déjà sélectionné en multi)
           — Clic sur le fond: deselectAll
           ══════════════════════════════════════════════════════════ */
        const onMouseDown = function(event) {
            if (_isSelectionDrawing()) return;

            const position = _getRelativePosition(event);
            const objectData = self.hitTest(canvasId, position.x, position.y);
            const selectionManager = self._voh._objectSelectionManager;

            if (objectData) {

                /* ── Sélection interactive (avant le test de drag) ── */
                if (selectionManager && event.button === 0) {
                    if (!event.ctrlKey && !event.metaKey) {
                        /* Sans Ctrl: deux cas possibles.
                           1. L'objet n'est PAS sélectionné → selectOnly immédiat.
                           2. L'objet EST déjà sélectionné (multi-sélection) → ne PAS
                              faire selectOnly ici, sinon on casse la multi-sélection
                              avant que le drag multi ne puisse démarrer.
                              Le selectOnly sera fait au click si l'utilisateur n'a pas
                              dragué (comportement standard Photoshop/Figma). */
                        const isAlreadySelected = selectionManager.isSelected(canvasId, objectData.id);
                        const multiCount = selectionManager.getSelectedCount(canvasId);

                        if (!isAlreadySelected) {
                            /* Objet non sélectionné → sélection exclusive immédiate */
                            selectionManager.selectOnly(canvasId, objectData.id);
                        }
                        /* Si déjà sélectionné en multi → on attend le click.
                           Si déjà sélectionné seul → rien à faire (no-op). */
                    }
                    /* Avec Ctrl: on attend le click pour toggle (sinon un Ctrl+drag
                       désélectionnerait l'objet avant de pouvoir le déplacer en multi). */
                }

                /* ── Vérifier si cet objet est draggable avec ce bouton ── */
                /* Ctrl+clic = toggle sélection, pas drag (même si l'objet est draggable) */
                const buttonName = INTERACTION_MOUSE_BUTTON_NAMES[event.button] || 'left';
                if (objectData.mouseDragEnabled &&
                    objectData.mouseDragButton === buttonName &&
                    !self._activeDrag &&
                    !event.ctrlKey && !event.metaKey) {

                    /* Démarrer le drag — bloquer la sélection de texte navigateur */
                    event.preventDefault();
                    self._startObjectDrag(canvasId, objectData, event.clientX, event.clientY,
                                         buttonName, event.button, event);
                    return;
                }
                self._emit('object:mousedown', _buildEventData(objectData, position, event));
            } else {

                /* ── Clic sur le fond : désélectionner tous les objets ── */
                if (selectionManager) {
                    selectionManager.deselectAll(canvasId);
                }

                self._emit('canvas:mousedown', _buildCanvasEventData(position, event));
            }
        };

        /* ══════════════════════════════════════════════════════════
           HANDLER: mouseup
           ══════════════════════════════════════════════════════════ */
        const onMouseUp = function(event) {
            if (_isSelectionDrawing()) return;

            const position = _getRelativePosition(event);
            const objectData = self.hitTest(canvasId, position.x, position.y);

            if (objectData) {
                self._emit('object:mouseup', _buildEventData(objectData, position, event));
            } else {
                self._emit('canvas:mouseup', _buildCanvasEventData(position, event));
            }
        };

        /* ══════════════════════════════════════════════════════════
           HANDLER: click
           — Avec Ctrl: toggle la sélection de l'objet cliqué
           — Sans Ctrl sur objet déjà sélectionné en multi: selectOnly différé
             (le mousedown n'a pas fait selectOnly pour permettre le multi-drag)
           ══════════════════════════════════════════════════════════ */
        const onClick = function(event) {
            if (_isSelectionDrawing()) return;

            /* Ignorer le click qui suit immédiatement un drag (mouseup déclenche click) */
            if (canvasData._dragJustEnded) {
                canvasData._dragJustEnded = false;
                return;
            }

            /* Ignorer le click qui suit immédiatement un rectangle de sélection */
            if (canvasData._selectionJustEnded) {
                canvasData._selectionJustEnded = false;
                return;
            }

            const position = _getRelativePosition(event);
            const objectData = self.hitTest(canvasId, position.x, position.y);

            if (objectData) {

                const selectionManager = self._voh._objectSelectionManager;
                if (selectionManager) {
                    if (event.ctrlKey || event.metaKey) {
                        /* ── Ctrl+clic: bascule (ajouter/retirer) ── */
                        selectionManager.toggle(canvasId, objectData.id);
                    } else {
                        /* ── Clic simple sans Ctrl: selectOnly différé.
                           Si l'objet est sélectionné parmi d'autres, le mousedown
                           n'a pas fait selectOnly (pour permettre le multi-drag).
                           Comme le drag n'a pas eu lieu (sinon _dragJustEnded serait true),
                           on fait selectOnly maintenant. ── */
                        selectionManager.selectOnly(canvasId, objectData.id);
                    }
                }

                self._emit('object:click', _buildEventData(objectData, position, event));
            } else {
                self._emit('canvas:click', _buildCanvasEventData(position, event));
            }
        };

        /* ══════════════════════════════════════════════════════════
           HANDLER: dblclick
           ══════════════════════════════════════════════════════════ */
        const onDblClick = function(event) {
            if (_isSelectionDrawing()) return;

            const position = _getRelativePosition(event);
            const objectData = self.hitTest(canvasId, position.x, position.y);

            if (objectData) {
                self._emit('object:dblclick', _buildEventData(objectData, position, event));
            } else {
                self._emit('canvas:dblclick', _buildCanvasEventData(position, event));
            }
        };

        /* ══════════════════════════════════════════════════════════
           HANDLER: mousemove — avec tracking enter/leave
           ══════════════════════════════════════════════════════════ */
        const onMouseMove = function(event) {
            if (_isSelectionDrawing()) return;

            const position = _getRelativePosition(event);
            const objectData = self.hitTest(canvasId, position.x, position.y);
            const previousObjectId = self._objectUnderCursor.get(canvasId) || null;
            const currentObjectId = objectData ? objectData.id : null;

            /* ── Détection mouseenter / mouseleave ── */
            if (currentObjectId !== previousObjectId) {

                /* mouseleave sur l'ancien objet */
                if (previousObjectId !== null) {
                    const previousObjectData = self._getObjectManager()._objects.get(previousObjectId);
                    if (previousObjectData) {
                        self._emit('object:mouseleave', {
                            objectId:      previousObjectId,
                            canvasId:      canvasId,
                            x:             position.x,
                            y:             position.y,
                            originalEvent: event
                        });

                        /* Restaurer le curseur par défaut du canevas —
                           SAUF si un drag est en cours: le curseur est alors
                           géré exclusivement par le système de drag. */
                        if (!self._activeDrag) {
                            element.style.cursor = '';
                        }
                    }
                }

                /* mouseenter sur le nouvel objet */
                if (objectData) {
                    self._emit('object:mouseenter', {
                        objectId:      objectData.id,
                        canvasId:      canvasId,
                        x:             position.x,
                        y:             position.y,
                        originalEvent: event
                    });

                    /* Appliquer le curseur de l'objet s'il en a un —
                       SAUF si un drag est en cours (le curseur du drag prime). */
                    if (objectData.cursor && !self._activeDrag) {
                        element.style.cursor = objectData.cursor;
                    }
                }

                self._objectUnderCursor.set(canvasId, currentObjectId);
            }

            /* ── mousemove sur l'objet courant ou le canevas ── */
            if (objectData) {
                self._emit('object:mousemove', {
                    objectId:      objectData.id,
                    canvasId:      canvasId,
                    x:             position.x,
                    y:             position.y,
                    originalEvent: event
                });
            } else {
                self._emit('canvas:mousemove', _buildCanvasEventData(position, event));
            }
        };

        /* ══════════════════════════════════════════════════════════
           HANDLER: mouseleave sur l'élément canvas (la souris quitte le canvas)
           ══════════════════════════════════════════════════════════ */
        const onMouseLeave = function(event) {
            const previousObjectId = self._objectUnderCursor.get(canvasId) || null;

            if (previousObjectId !== null) {
                const position = _getRelativePosition(event);
                self._emit('object:mouseleave', {
                    objectId:      previousObjectId,
                    canvasId:      canvasId,
                    x:             position.x,
                    y:             position.y,
                    originalEvent: event
                });
                self._objectUnderCursor.set(canvasId, null);
                /* Ne pas toucher au curseur si un drag est en cours */
                if (!self._activeDrag) {
                    element.style.cursor = '';
                }
            }
        };

        /* ══════════════════════════════════════════════════════════
           HANDLER: wheel (molette)
           ══════════════════════════════════════════════════════════ */
        const onWheel = function(event) {
            if (_isSelectionDrawing()) return;

            const position = _getRelativePosition(event);
            const objectData = self.hitTest(canvasId, position.x, position.y);

            if (objectData) {
                self._emit('object:wheel', {
                    objectId:      objectData.id,
                    canvasId:      canvasId,
                    x:             position.x,
                    y:             position.y,
                    deltaX:        event.deltaX,
                    deltaY:        event.deltaY,
                    deltaZ:        event.deltaZ,
                    originalEvent: event
                });
            } else {
                self._emit('canvas:wheel', {
                    canvasId:      canvasId,
                    x:             position.x,
                    y:             position.y,
                    deltaX:        event.deltaX,
                    deltaY:        event.deltaY,
                    deltaZ:        event.deltaZ,
                    originalEvent: event
                });
            }
        };

        /* ══════════════════════════════════════════════════════════
           HANDLER: contextmenu (clic droit)
           ══════════════════════════════════════════════════════════ */
        const onContextMenu = function(event) {
            if (_isSelectionDrawing()) return;

            /* ── Bloquer le menu contextuel si un drag bouton droit est en cours ── */
            if (self._activeDrag && self._activeDrag.button === 'right') {
                event.preventDefault();
                return;
            }

            const position = _getRelativePosition(event);
            const objectData = self.hitTest(canvasId, position.x, position.y);

            /* ── Bloquer le menu contextuel si l'objet utilise le clic droit pour dragger ── */
            if (objectData && objectData.mouseDragEnabled && objectData.mouseDragButton === 'right') {
                event.preventDefault();
                return;
            }

            if (objectData) {
                self._emit('object:contextmenu', {
                    objectId:      objectData.id,
                    canvasId:      canvasId,
                    x:             position.x,
                    y:             position.y,
                    originalEvent: event
                });
            } else {
                self._emit('canvas:contextmenu', {
                    canvasId:      canvasId,
                    x:             position.x,
                    y:             position.y,
                    originalEvent: event
                });
            }
        };

        /* ── Brancher les handlers sur l'élément DOM du canevas ── */
        element.addEventListener('mousedown',   onMouseDown);
        element.addEventListener('mouseup',     onMouseUp);
        element.addEventListener('click',       onClick);
        element.addEventListener('dblclick',    onDblClick);
        element.addEventListener('mousemove',   onMouseMove);
        element.addEventListener('mouseleave',  onMouseLeave);
        element.addEventListener('wheel',       onWheel);
        element.addEventListener('contextmenu', onContextMenu);

        /* ── Stocker les handlers pour pouvoir les retirer proprement ── */
        this._eventHandlers.set(canvasId, {
            mousedown:   onMouseDown,
            mouseup:     onMouseUp,
            click:       onClick,
            dblclick:    onDblClick,
            mousemove:   onMouseMove,
            mouseleave:  onMouseLeave,
            wheel:       onWheel,
            contextmenu: onContextMenu
        });
    }


    /* ══════════════════════════════════════════════════════════════
       DRAG SOURIS — Démarrage, mise à jour, fin, annulation

       Le drag est géré par des handlers sur `document` (pas sur
       l'élément canvas) afin que le déplacement continue même si
       la souris sort du canvas pendant le drag.

       État global : this._activeDrag (un seul drag à la fois).
       ══════════════════════════════════════════════════════════════ */

    /**
     * Démarre un drag sur un objet (et ses co-sélectionnés si multi-sélection).
     * Appelé par le handler mousedown quand un objet draggable est cliqué.
     * @param {number} canvasId   — ID du canevas.
     * @param {Object} objectData — Données de l'objet leader (celui cliqué).
     * @param {number} mouseX     — Position absolue souris X (event.clientX).
     * @param {number} mouseY     — Position absolue souris Y (event.clientY).
     * @param {string} button     — Nom du bouton ('left', 'middle', 'right').
     * @param {number} buttonCode — Code du bouton (0, 1, 2).
     * @param {Event}  event      — Événement DOM original.
     */
    _startObjectDrag(canvasId, objectData, mouseX, mouseY, button, buttonCode, event) {

        const canvasManager  = this._getCanvasManager();
        const canvasData     = canvasManager ? canvasManager._canvases.get(canvasId) : null;
        const objectManager  = this._getObjectManager();
        const historyManager = canvasManager ? canvasManager._historyManager : null;
        if (!canvasData || !objectManager) return;

        /* ── Calculer l'offset: différence entre le coin haut-gauche de l'objet
           et la position de la souris dans les coordonnées du canevas.
           Si mouseDragOffsetX/Y != 0, ils décalent la position relative. ── */
        const rect    = canvasData.element.getBoundingClientRect();
        const relX    = mouseX - rect.left;
        const relY    = mouseY - rect.top;
        const offsetX = (relX - objectData.x) + objectData.mouseDragOffsetX;
        const offsetY = (relY - objectData.y) + objectData.mouseDragOffsetY;

        /* ── Mettre en pause l'historique pour n'enregistrer qu'une seule
           action au relâchement (pas à chaque pixel déplacé) ── */
        if (historyManager) {
            const pageData = objectManager._getObjectPageData(objectData);
            if (pageData) {
                historyManager.pauseHistory(canvasId, pageData.id);
            }
        }

        /* ── Déterminer si c'est un multi-drag (objet sélectionné avec d'autres) ── */
        const selectionManager = this._voh._objectSelectionManager;
        let isMultiDrag = false;
        let multiObjects = null;

        if (selectionManager) {
            const selectedIds = selectionManager.getSelectedIds(canvasId);
            if (selectedIds.length > 1 && selectionManager.isSelected(canvasId, objectData.id)) {

                isMultiDrag  = true;
                multiObjects = [];

                /* ── Construire la liste des co-sélectionnés (tous sauf le leader) ── */
                for (let i = 0; i < selectedIds.length; i++) {
                    const siblingId = selectedIds[i];
                    if (siblingId === objectData.id) continue; /* le leader est géré séparément */

                    const siblingData = objectManager._objects.get(siblingId);
                    if (!siblingData) continue;

                    /* ── Chaîne de fallback pour le mode multi ── */
                    const effectiveMode = siblingData.mouseDragMultiMode !== null
                        ? siblingData.mouseDragMultiMode
                        : siblingData.mouseDragMode;

                    multiObjects.push({
                        objectData:     siblingData,
                        originalX:      siblingData.x,
                        originalY:      siblingData.y,
                        effectiveMode:  effectiveMode,
                        previewSprite:  null,
                        previewTexture: null
                    });
                }
            }
        }

        /* ── Créer l'état du drag ── */
        this._activeDrag = {
            canvasId:      canvasId,
            objectData:    objectData,
            button:        button,
            buttonCode:    buttonCode,
            startMouseX:   mouseX,
            startMouseY:   mouseY,
            offsetX:       offsetX,
            offsetY:       offsetY,
            originalX:     objectData.x,
            originalY:     objectData.y,
            hasMoved:      false,
            previewSprite:  null,
            previewTexture: null,
            isMultiDrag:   isMultiDrag,
            multiObjects:  multiObjects,
            _docMouseMove: null,
            _docMouseUp:   null,
            _docKeyDown:   null
        };

        /* ── En mode preview : créer le sprite fantôme du leader ── */
        if (objectData.mouseDragMode === 'preview') {
            this._createDragPreviewSprite(canvasId, objectData, objectData.x, objectData.y);
        }

        /* ── Multi-drag : créer les sprites fantômes des co-sélectionnés en mode preview ── */
        if (isMultiDrag) {
            for (let i = 0; i < multiObjects.length; i++) {
                const entry = multiObjects[i];
                if (entry.effectiveMode === 'preview') {
                    this._createMultiDragPreviewSprite(canvasId, entry);
                }
            }
        }

        /* ── Émettre l'événement de début de drag ── */
        this._emit('object:dragstart', {
            objectId:      objectData.id,
            canvasId:      canvasId,
            x:             relX,
            y:             relY,
            button:        button,
            originalEvent: event
        });

        /* ── Brancher les handlers document ── */
        const self = this;

        /* ── Appliquer le curseur de l'objet à l'élément canvas ET à document.body.
           Fait APRÈS l'émission de dragstart: si l'utilisateur a appelé setCursor()
           dans son handler dragstart, objectData.cursor est déjà à jour ici.
           document.body garantit que le curseur reste cohérent quand la souris
           sort du canvas pendant le drag. ── */
        if (objectData.cursor) {
            canvasData.element.style.cursor = objectData.cursor;
            document.body.style.cursor      = objectData.cursor;
        }

        this._activeDrag._docMouseMove = function(moveEvent) {
            self._updateObjectDrag(moveEvent);
        };
        this._activeDrag._docMouseUp = function(upEvent) {
            if (upEvent.button !== buttonCode) return;
            self._endObjectDrag(upEvent);
        };
        this._activeDrag._docKeyDown = function(keyEvent) {
            if (keyEvent.key === 'Escape') {
                self._cancelObjectDrag(keyEvent);
            }
        };

        document.addEventListener('mousemove', this._activeDrag._docMouseMove);
        document.addEventListener('mouseup',   this._activeDrag._docMouseUp);
        document.addEventListener('keydown',   this._activeDrag._docKeyDown);
    }

    /**
     * Met à jour la position pendant le drag (handler document mousemove).
     * En multi-drag, le delta du leader est appliqué à tous les co-sélectionnés.
     * @param {MouseEvent} event — Événement mousemove du document.
     */
    _updateObjectDrag(event) {
        if (!this._activeDrag) return;

        const drag        = this._activeDrag;
        const canvasManager = this._getCanvasManager();
        const canvasData  = canvasManager ? canvasManager._canvases.get(drag.canvasId) : null;
        const objectManager = this._getObjectManager();
        if (!canvasData || !objectManager) return;

        /* ── Calculer la nouvelle position du leader dans les coords canvas ── */
        const rect   = canvasData.element.getBoundingClientRect();
        const relX   = event.clientX - rect.left;
        const relY   = event.clientY - rect.top;
        const newX   = relX - drag.offsetX;
        const newY   = relY - drag.offsetY;

        const deltaX = newX - drag.objectData.x;
        const deltaY = newY - drag.objectData.y;

        /* ── Ne traiter que si la position a réellement changé ── */
        if (deltaX === 0 && deltaY === 0) return;
        drag.hasMoved = true;

        /* ── Déplacer le leader ── */
        if (drag.objectData.mouseDragMode === 'direct') {
            objectManager.setObjectX(drag.objectData.id, newX);
            objectManager.setObjectY(drag.objectData.id, newY);
        } else {
            if (drag.previewSprite) {
                drag.previewSprite.x = newX;
                drag.previewSprite.y = newY;
            }
        }

        /* ── Multi-drag : déplacer les co-sélectionnés ── */
        if (drag.isMultiDrag && drag.multiObjects) {
            for (let i = 0; i < drag.multiObjects.length; i++) {
                const entry   = drag.multiObjects[i];
                const entryNewX = entry.originalX + (newX - drag.originalX);
                const entryNewY = entry.originalY + (newY - drag.originalY);

                if (entry.effectiveMode === 'direct') {
                    objectManager.setObjectX(entry.objectData.id, entryNewX);
                    objectManager.setObjectY(entry.objectData.id, entryNewY);
                } else if (entry.previewSprite) {
                    entry.previewSprite.x = entryNewX;
                    entry.previewSprite.y = entryNewY;
                }
            }
        }

        /* ── Déclencher le rendu Pixi (coalescé par rAF) ── */
        const renderEngine = canvasManager._renderEngine;
        if (renderEngine) renderEngine.requestRender(canvasData);

        /* ── Émettre l'événement de déplacement ── */
        this._emit('object:dragmove', {
            objectId:      drag.objectData.id,
            canvasId:      drag.canvasId,
            x:             relX,
            y:             relY,
            deltaX:        deltaX,
            deltaY:        deltaY,
            isMultiDrag:   drag.isMultiDrag,
            originalEvent: event
        });
    }

    /**
     * Termine le drag au relâchement du bouton souris.
     * En multi-drag, la position finale est appliquée à tous les co-sélectionnés.
     * @param {MouseEvent} event — Événement mouseup du document.
     */
    _endObjectDrag(event) {
        if (!this._activeDrag) return;

        const drag          = this._activeDrag;
        const canvasManager = this._getCanvasManager();
        const canvasData    = canvasManager ? canvasManager._canvases.get(drag.canvasId) : null;
        const objectManager = this._getObjectManager();
        const historyManager = canvasManager ? canvasManager._historyManager : null;

        /* ── Calculer la position finale du leader ── */
        const rect   = canvasData ? canvasData.element.getBoundingClientRect() : { left: 0, top: 0 };
        const finalX = event.clientX - rect.left - drag.offsetX;
        const finalY = event.clientY - rect.top  - drag.offsetY;

        /* ── Mode preview du leader : appliquer la position finale ── */
        if (drag.objectData.mouseDragMode === 'preview') {
            this._destroyDragPreviewSprite(drag.canvasId);
            if (objectManager && drag.hasMoved) {
                objectManager.setObjectX(drag.objectData.id, finalX);
                objectManager.setObjectY(drag.objectData.id, finalY);
            }
        }

        /* ── Multi-drag : finaliser les co-sélectionnés ── */
        if (drag.isMultiDrag && drag.multiObjects) {
            for (let i = 0; i < drag.multiObjects.length; i++) {
                const entry   = drag.multiObjects[i];
                const entryFinalX = entry.originalX + (finalX - drag.originalX);
                const entryFinalY = entry.originalY + (finalY - drag.originalY);

                if (entry.effectiveMode === 'preview') {
                    /* Détruire le sprite fantôme */
                    this._destroyMultiDragPreviewSprite(drag.canvasId, entry);
                    /* Appliquer la position finale */
                    if (objectManager && drag.hasMoved) {
                        objectManager.setObjectX(entry.objectData.id, entryFinalX);
                        objectManager.setObjectY(entry.objectData.id, entryFinalY);
                    }
                }
                /* Mode direct : la position est déjà à jour via _updateObjectDrag */
            }
        }

        /* ── Reprendre l'historique (crée une entrée batch si les objets ont bougé) ── */
        if (historyManager) {
            const pageData = objectManager ? objectManager._getObjectPageData(drag.objectData) : null;
            if (pageData) {
                const description = drag.isMultiDrag
                    ? 'Déplacement de ' + (drag.multiObjects.length + 1) + ' objets'
                    : 'Déplacement d\'objet';
                historyManager.resumeHistory(drag.canvasId, pageData.id, description);
            }
        }

        /* ── Signaler au handler click qu'un drag vient de se terminer
           (le mouseup déclenche un click → il faut l'ignorer) ── */
        if (canvasData && drag.hasMoved) {
            canvasData._dragJustEnded = true;
        }

        /* ── Émettre l'événement de fin de drag (TOUJOURS, même sans mouvement,
           pour que les handlers puissent restaurer le curseur ou autre état) ── */
        this._emit('object:dragend', {
            objectId:      drag.objectData.id,
            canvasId:      drag.canvasId,
            x:             finalX,
            y:             finalY,
            previousX:     drag.originalX,
            previousY:     drag.originalY,
            hasMoved:      drag.hasMoved,
            isMultiDrag:   drag.isMultiDrag,
            originalEvent: event
        });

        /* ── Nettoyer les handlers document et l'état ── */
        this._cleanupDragHandlers();
    }

    /**
     * Annule le drag en cours (touche Escape).
     * Tous les objets (leader + co-sélectionnés) sont ramenés à leur position d'origine.
     * Grâce au coalescing de l'historique, le batch est une no-op et n'est
     * pas enregistré (old === new après restore).
     * @param {KeyboardEvent} event — Événement keydown Escape.
     */
    _cancelObjectDrag(event) {
        if (!this._activeDrag) return;

        const drag          = this._activeDrag;
        const canvasManager = this._getCanvasManager();
        const canvasData    = canvasManager ? canvasManager._canvases.get(drag.canvasId) : null;
        const objectManager = this._getObjectManager();
        const historyManager = canvasManager ? canvasManager._historyManager : null;

        /* ── Détruire le sprite fantôme du leader si mode preview ── */
        if (drag.objectData.mouseDragMode === 'preview') {
            this._destroyDragPreviewSprite(drag.canvasId);
        }

        /* ── Restaurer la position d'origine du leader ── */
        if (objectManager && drag.hasMoved) {
            objectManager.setObjectX(drag.objectData.id, drag.originalX);
            objectManager.setObjectY(drag.objectData.id, drag.originalY);
        }

        /* ── Multi-drag : restaurer les co-sélectionnés ── */
        if (drag.isMultiDrag && drag.multiObjects) {
            for (let i = 0; i < drag.multiObjects.length; i++) {
                const entry = drag.multiObjects[i];

                /* Détruire le sprite fantôme si mode preview */
                if (entry.effectiveMode === 'preview') {
                    this._destroyMultiDragPreviewSprite(drag.canvasId, entry);
                }

                /* Restaurer la position d'origine */
                if (objectManager && drag.hasMoved) {
                    objectManager.setObjectX(entry.objectData.id, entry.originalX);
                    objectManager.setObjectY(entry.objectData.id, entry.originalY);
                }
            }
        }

        /* ── Reprendre l'historique (le batch sera vide = ignoré) ── */
        if (historyManager) {
            const pageData = objectManager ? objectManager._getObjectPageData(drag.objectData) : null;
            if (pageData) {
                historyManager.resumeHistory(drag.canvasId, pageData.id, 'Annulation drag');
            }
        }

        /* ── Émettre l'événement d'annulation ── */
        this._emit('object:dragcancel', {
            objectId:  drag.objectData.id,
            canvasId:  drag.canvasId,
            originalX: drag.originalX,
            originalY: drag.originalY,
            isMultiDrag: drag.isMultiDrag
        });

        /* ── Nettoyer ── */
        this._cleanupDragHandlers();
    }

    /**
     * Crée le sprite Pixi fantôme pour le mode preview.
     * Le fantôme est dessiné via mouseDragPreviewCallback ou par défaut
     * (rectangle en pointillés bleus semi-transparents).
     * Le canvas offscreen est créé une seule fois ici — le sprite est
     * ensuite simplement repositionné à chaque mousemove.
     * @param {number} canvasId   — ID du canevas.
     * @param {Object} objectData — Données de l'objet.
     * @param {number} x          — Position X initiale.
     * @param {number} y          — Position Y initiale.
     */
    _createDragPreviewSprite(canvasId, objectData, x, y) {
        if (!this._activeDrag) return;

        const canvasManager = this._getCanvasManager();
        const canvasData    = canvasManager ? canvasManager._canvases.get(canvasId) : null;
        if (!canvasData || !canvasData.pixiOverlayLayer) return;

        const width  = objectData.width;
        const height = objectData.height;

        /* ── Dessiner le fantôme sur un canvas offscreen 2D ── */
        const offscreen = document.createElement('canvas');
        offscreen.width  = width;
        offscreen.height = height;
        const ctx = offscreen.getContext('2d');

        if (typeof objectData.mouseDragPreviewCallback === 'function') {
            /* Callback utilisateur */
            try {
                objectData.mouseDragPreviewCallback(ctx, width, height, objectData.id);
            } catch (err) {
                console.warn('[ObjectInteraction] mouseDragPreviewCallback erreur:', err);
                this._drawDefaultDragPreview(ctx, width, height);
            }
        } else {
            /* Dessin par défaut : rectangle semi-transparent en pointillés bleus */
            this._drawDefaultDragPreview(ctx, width, height);
        }

        /* ── Créer la texture et le sprite Pixi ── */
        const pixiTexture = PIXI.Texture.from(offscreen);
        const pixiSprite  = new PIXI.Sprite(pixiTexture);
        pixiSprite.x = x;
        pixiSprite.y = y;
        pixiSprite.label = 'drag_preview_' + objectData.id;

        canvasData.pixiOverlayLayer.addChild(pixiSprite);

        /* Déclencher le premier rendu */
        const renderEngine = canvasManager._renderEngine;
        if (renderEngine) renderEngine.requestRender(canvasData);

        /* ── Stocker les références dans l'état du drag ── */
        this._activeDrag.previewSprite  = pixiSprite;
        this._activeDrag.previewTexture = pixiTexture;
    }

    /**
     * Dessine le fantôme par défaut : fond bleu semi-transparent + pointillés.
     * @param {CanvasRenderingContext2D} ctx    — Contexte 2D du canvas offscreen.
     * @param {number}                   width  — Largeur de l'objet.
     * @param {number}                   height — Hauteur de l'objet.
     */
    _drawDefaultDragPreview(ctx, width, height) {
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = 'rgba(0, 100, 220, 0.18)';
        ctx.fillRect(0, 0, width, height);
        ctx.setLineDash([5, 4]);
        ctx.strokeStyle = 'rgba(0, 100, 220, 0.75)';
        ctx.lineWidth   = 1.5;
        ctx.strokeRect(0.75, 0.75, width - 1.5, height - 1.5);
    }

    /**
     * Détruit le sprite fantôme Pixi et libère la texture.
     * @param {number} canvasId — ID du canevas.
     */
    _destroyDragPreviewSprite(canvasId) {
        if (!this._activeDrag) return;

        const drag = this._activeDrag;
        if (!drag.previewSprite) return;

        const canvasManager = this._getCanvasManager();
        const canvasData    = canvasManager ? canvasManager._canvases.get(canvasId) : null;

        /* ── Retirer du layer overlay ── */
        if (drag.previewSprite.parent) {
            drag.previewSprite.parent.removeChild(drag.previewSprite);
        }
        drag.previewSprite.destroy({ texture: false });

        /* ── Détruire la texture ── */
        if (drag.previewTexture) {
            drag.previewTexture.destroy(true);
        }

        drag.previewSprite  = null;
        drag.previewTexture = null;

        /* ── Déclencher un rendu pour effacer le fantôme ── */
        if (canvasData) {
            const renderEngine = canvasManager._renderEngine;
            if (renderEngine) renderEngine.requestRender(canvasData);
        }
    }

    /**
     * Crée un sprite fantôme Pixi pour un objet co-sélectionné en mode preview.
     * Utilise la chaîne de fallback : mouseDragMultiPreviewCallback → mouseDragPreviewCallback → défaut.
     * @param {number} canvasId — ID du canevas.
     * @param {Object} entry — L'entrée multiObjects { objectData, effectiveMode, previewSprite, previewTexture }.
     */
    _createMultiDragPreviewSprite(canvasId, entry) {

        const canvasManager = this._getCanvasManager();
        const canvasData    = canvasManager ? canvasManager._canvases.get(canvasId) : null;
        if (!canvasData || !canvasData.pixiOverlayLayer) return;

        const objectData = entry.objectData;
        const width  = objectData.width;
        const height = objectData.height;

        /* ── Dessiner le fantôme sur un canvas offscreen 2D ── */
        const offscreen = document.createElement('canvas');
        offscreen.width  = width;
        offscreen.height = height;
        const ctx = offscreen.getContext('2d');

        /* ── Chaîne de fallback pour le callback ── */
        const callback = objectData.mouseDragMultiPreviewCallback !== null
            ? objectData.mouseDragMultiPreviewCallback
            : objectData.mouseDragPreviewCallback;

        if (typeof callback === 'function') {
            try {
                callback(ctx, width, height, objectData.id);
            } catch (err) {
                console.warn('[ObjectInteraction] Multi-drag preview callback erreur:', err);
                this._drawDefaultDragPreview(ctx, width, height);
            }
        } else {
            this._drawDefaultDragPreview(ctx, width, height);
        }

        /* ── Créer la texture et le sprite Pixi ── */
        const pixiTexture = PIXI.Texture.from(offscreen);
        const pixiSprite  = new PIXI.Sprite(pixiTexture);
        pixiSprite.x = objectData.x;
        pixiSprite.y = objectData.y;
        pixiSprite.label = 'multi_drag_preview_' + objectData.id;

        canvasData.pixiOverlayLayer.addChild(pixiSprite);

        /* ── Stocker les références dans l'entrée ── */
        entry.previewSprite  = pixiSprite;
        entry.previewTexture = pixiTexture;

        /* ── Déclencher un rendu ── */
        const renderEngine = canvasManager._renderEngine;
        if (renderEngine) renderEngine.requestRender(canvasData);
    }

    /**
     * Détruit le sprite fantôme Pixi d'un co-sélectionné et libère la texture.
     * @param {number} canvasId — ID du canevas.
     * @param {Object} entry — L'entrée multiObjects.
     */
    _destroyMultiDragPreviewSprite(canvasId, entry) {

        if (!entry.previewSprite) return;

        /* ── Retirer du layer overlay ── */
        if (entry.previewSprite.parent) {
            entry.previewSprite.parent.removeChild(entry.previewSprite);
        }
        entry.previewSprite.destroy({ texture: false });

        /* ── Détruire la texture ── */
        if (entry.previewTexture) {
            entry.previewTexture.destroy(true);
        }

        entry.previewSprite  = null;
        entry.previewTexture = null;
    }

    /**
     * Retire les handlers document et réinitialise l'état du drag.
     * Appelé à la fin ou à l'annulation du drag.
     */
    _cleanupDragHandlers() {
        if (!this._activeDrag) return;
        const drag = this._activeDrag;
        if (drag._docMouseMove) document.removeEventListener('mousemove', drag._docMouseMove);
        if (drag._docMouseUp)   document.removeEventListener('mouseup',   drag._docMouseUp);
        if (drag._docKeyDown)   document.removeEventListener('keydown',   drag._docKeyDown);

        /* ── Restaurer le curseur du navigateur ── */
        /* Retirer le curseur forcé sur document.body (appliqué au début du drag) */
        document.body.style.cursor = '';
        /* Appliquer le curseur de l'objet actuellement sous la souris —
           et non celui de l'objet dragué, qui peut être différent.
           _objectUnderCursor contient l'ID de l'objet sous la souris
           (mis à jour en continu par onMouseMove même pendant le drag). */
        const canvasManager    = this._getCanvasManager();
        const canvasData       = canvasManager ? canvasManager._canvases.get(drag.canvasId) : null;
        const objectManager    = this._getObjectManager();
        const objectUnderMouse = this._objectUnderCursor.get(drag.canvasId) || null;
        if (canvasData) {
            let cursorToApply = '';
            if (objectUnderMouse !== null && objectManager) {
                const objectUnderMouseData = objectManager._objects.get(objectUnderMouse);
                if (objectUnderMouseData && objectUnderMouseData.cursor) {
                    cursorToApply = objectUnderMouseData.cursor; /* curseur de l'objet sous la souris */
                }
            }
            canvasData.element.style.cursor = cursorToApply;
        }

        this._activeDrag = null;
    }


    /* ══════════════════════════════════════════════════════════════
       SÉLECTION PAR RECTANGLE — Callback canvas:selectionEnded

       Quand le rectangle de sélection souris se termine,
       tous les objets visibles intersectés sont sélectionnés.
       Si Ctrl est enfoncé, les objets sont ajoutés à la sélection
       existante. Sinon, la sélection est remplacée.
       ══════════════════════════════════════════════════════════════ */

    /**
     * Callback appelé quand le rectangle de sélection souris se termine.
     * Sélectionne tous les objets visibles qui intersectent le rectangle.
     * @param {Object} data — Données de l'événement canvas:selectionEnded.
     * @param {number} data.canvasId — L'ID du canevas.
     * @param {number} data.x       — X du rectangle (normalisé).
     * @param {number} data.y       — Y du rectangle (normalisé).
     * @param {number} data.width   — Largeur du rectangle.
     * @param {number} data.height  — Hauteur du rectangle.
     * @param {boolean} data.ctrlKey — true si Ctrl était enfoncé au mouseup.
     */
    _onCanvasSelectionEnded(data) {

        const { canvasId, x, y, width, height, ctrlKey } = data;

        /* ── Rectangle trop petit = simple clic sur le fond (pas de mouvement) ── */
        if (width < 3 && height < 3) {
            /* Clic sur le fond sans Ctrl → désélectionner tout */
            const selectionManagerClick = this._voh._objectSelectionManager;
            if (selectionManagerClick && !ctrlKey) {
                selectionManagerClick.deselectAll(canvasId);
            }
            return;
        }

        const objectManager    = this._getObjectManager();
        const selectionManager = this._voh._objectSelectionManager;
        const canvasManager    = this._getCanvasManager();
        if (!objectManager || !selectionManager || !canvasManager) return;

        const canvasData = canvasManager._canvases.get(canvasId);
        if (!canvasData) return;

        const activePageId = canvasData.activePageId;
        const rectRight    = x + width;
        const rectBottom   = y + height;

        /* ── Trouver les objets selon leur selectionMode individuel ── */
        const objectsInRect = [];
        for (const objectData of objectManager._objects.values()) {
            if (objectData.canvasId !== canvasId) continue;
            if (objectData.pageId !== activePageId) continue;
            if (!objectData.isVisible) continue;

            const objectRight  = objectData.x + objectData.width;
            const objectBottom = objectData.y + objectData.height;

            /* ── Mode de sélection par objet ('enclosed' par défaut, 'intersect' possible) ── */
            const objectSelectionMode = objectData.selectionMode;

            if (objectSelectionMode === 'intersect') {
                /* L'objet touche le rectangle (même partiellement) → sélectionné */
                if (objectData.x < rectRight  && objectRight  > x &&
                    objectData.y < rectBottom && objectBottom > y) {
                    objectsInRect.push(objectData.id);
                }
            } else {
                /* Mode 'enclosed' (défaut): l'objet doit être ENTIÈREMENT dans le rectangle */
                if (objectData.x >= x && objectData.y >= y &&
                    objectRight <= rectRight && objectBottom <= rectBottom) {
                    objectsInRect.push(objectData.id);
                }
            }
        }

        /* ── Appliquer la sélection ── */
        if (ctrlKey) {
            /* Ctrl enfoncé: ajouter les objets du rectangle à la sélection existante */
            for (let i = 0; i < objectsInRect.length; i++) {
                selectionManager.select(canvasId, objectsInRect[i]);
            }
        } else {
            /* Sans Ctrl: remplacer la sélection par les objets du rectangle.
               D'abord vider la sélection existante, puis sélectionner les nouveaux. */
            selectionManager.deselectAll(canvasId);
            for (let i = 0; i < objectsInRect.length; i++) {
                selectionManager.select(canvasId, objectsInRect[i]);
            }
        }
    }


    /* ══════════════════════════════════════════════════════════════
       DÉBRANCHEMENT DES ÉVÉNEMENTS

       Appelé à la suppression d'un canevas ou à la destruction
       de l'instance VOH.

       ══════════════════════════════════════════════════════════════ */

    /**
     * Retire les événements souris d'un canevas.
     * @param {Object} canvasData — Les données du canevas.
     */
    destroyInteractionEvents(canvasData) {

        const handlers = this._eventHandlers.get(canvasData.id);
        if (!handlers) return;

        const element = canvasData.element;
        element.removeEventListener('mousedown',   handlers.mousedown);
        element.removeEventListener('mouseup',     handlers.mouseup);
        element.removeEventListener('click',       handlers.click);
        element.removeEventListener('dblclick',    handlers.dblclick);
        element.removeEventListener('mousemove',   handlers.mousemove);
        element.removeEventListener('mouseleave',  handlers.mouseleave);
        element.removeEventListener('wheel',       handlers.wheel);
        element.removeEventListener('contextmenu', handlers.contextmenu);

        this._eventHandlers.delete(canvasData.id);
        this._objectUnderCursor.delete(canvasData.id);
    }


    /* ══════════════════════════════════════════════════════════════
       DESTRUCTION COMPLÈTE
       ══════════════════════════════════════════════════════════════ */

    /**
     * Détruit le gestionnaire d'interaction et libère les ressources.
     * Appelé par VisualObjectsHandler.destroy().
     */
    destroy() {

        /* ── Retirer les handlers de tous les canevas ── */
        const canvasManager = this._getCanvasManager();
        if (canvasManager) {
            for (const canvasData of canvasManager._canvases.values()) {
                this.destroyInteractionEvents(canvasData);
            }
        }

        /* ── Détruire la grille spatiale ── */
        if (this._spatialGrid) {
            this._spatialGrid.destroy();
            this._spatialGrid = null;
        }

        /* ── Annuler un drag en cours s'il y en a un ── */
        if (this._activeDrag) {
            this._cleanupDragHandlers();
        }

        /* ── Retirer l'écoute de canvas:selectionEnded ── */
        if (this._onSelectionEndedBound && this._voh) {
            const eventEmitter = this._voh.getEventEmitter();
            if (eventEmitter) {
                eventEmitter.off('canvas:selectionEnded', this._onSelectionEndedBound);
            }
            this._onSelectionEndedBound = null;
        }

        this._eventHandlers.clear();
        this._objectUnderCursor.clear();
        this._voh = null;

        console.log('[ObjectInteraction] Détruit.');
    }
}


/* ═══════════════════════════════════════════════════════════════════════════
   EXPOSITION GLOBALE
   ═══════════════════════════════════════════════════════════════════════════ */
window.ObjectInteractionManager = ObjectInteractionManager;
