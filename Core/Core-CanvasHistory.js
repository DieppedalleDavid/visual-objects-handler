/* ═══════════════════════════════════════════════════════════════════════════
   CORE-CANVASHISTORY.JS — Undo/Redo par page (v2 — Architecture optimisée)

   Système d'historique haute performance conçu pour des dizaines de milliers
   d'objets par page. Chaque page possède son propre historique indépendant.

   ══════════════════════════════════════════════════════════════════════════
   ARCHITECTURE : Actions typées + Dispatcher central
   ══════════════════════════════════════════════════════════════════════════

   Chaque modification est enregistrée comme un objet JS plat (pas de
   closure, pas de JSON.stringify). Un registre central mappe chaque type
   d'action vers ses fonctions apply() et reverse().

   Format d'une action :
   {
       type:        'pagePropertyChange',     // clé vers le handler
       description: 'backgroundColor: ...',   // lisible pour le debug
       data:        { property, from, to }     // données minimales
   }

   Avantages vs closures (v1) :
   - Zéro référence capturée → GC-friendly avec 10 000+ objets
   - Sérialisable en JSON à la demande (sauvegarde .voh, debug)
   - Extensible : chaque module enregistre ses propres types d'actions

   ══════════════════════════════════════════════════════════════════════════
   COALESCING : Fusion intelligente pendant les opérations batch
   ══════════════════════════════════════════════════════════════════════════

   Pendant un batch (pause/resume), les modifications successives sur la
   même cible sont fusionnées automatiquement. Exemple :

     pause()
       backgroundColor: #fff → #eee    ╮
       backgroundColor: #eee → #ddd    ├→ fusionné : #fff → #333
       backgroundColor: #ddd → #333    ╯
       gridCellWidth:   25   → 50      →  gardé tel quel
     resume()

   Résultat : 2 actions au lieu de 4. Avec 500 objets déplacés pendant
   un drag, on obtient 500 actions (une par objet) au lieu de 500 × N
   (N = nombre de pixels de déplacement).

   La clé de fusion (coalescingKey) est fournie par l'appelant.
   Pour les propriétés de page : le nom de la propriété.
   Pour les objets (futur) : "objectId:property".

   ══════════════════════════════════════════════════════════════════════════
   TYPES D'ACTIONS ENREGISTRÉS
   ══════════════════════════════════════════════════════════════════════════

   Types intégrés (enregistrés au constructeur) :
   - 'pagePropertyChange'  : modification d'une propriété de page
   - 'batch'               : groupe d'actions (généré par pause/resume)

   Types enregistrés par Core-Objects.js :
   - 'objectCreate'        : création d'objet (avec cleanup du pool)
   - 'objectDelete'        : suppression d'objet (avec cleanup du pool)
   - 'objectPropertyChange': modification de propriété d'objet

   Chaque handler peut fournir une fonction cleanup() optionnelle, appelée
   quand une action est définitivement éjectée des piles (nouvelle branche
   d'historique, overflow maxLevel, clear ou destroy). Ceci permet de
   libérer les ressources (containers Pixi dans le pool d'objets détachés)
   qui ne seront plus jamais récupérées par undo/redo.

   ══════════════════════════════════════════════════════════════════════════

   Licence: Open Source (licence à définir)
   Auteur: David Dieppedalle (ShadowStorm)
   ═══════════════════════════════════════════════════════════════════════════ */

'use strict';


/* ═══════════════════════════════════════════════════════════════════════════
   CONSTANTES
   ═══════════════════════════════════════════════════════════════════════════ */

/** Nombre maximum d'actions conservées dans la pile undo par défaut. */
const HISTORY_DEFAULT_MAX_LEVEL = 50;


/* ═══════════════════════════════════════════════════════════════════════════
   CLASSE: CanvasHistoryManager

   Gère l'historique undo/redo de toutes les pages de tous les canvas.
   Reçoit une référence vers le CanvasManager pour accéder aux données
   et émettre les événements.
   ═══════════════════════════════════════════════════════════════════════════ */
class CanvasHistoryManager {

    /**
     * Crée le gestionnaire d'historique.
     * @param {CanvasManager} canvasManager — Référence vers le CanvasManager parent.
     */
    constructor(canvasManager) {

        /** Référence vers le CanvasManager parent. */
        this._canvasManager = canvasManager;

        /**
         * Registre des types d'actions : type → { apply, reverse }.
         *
         * Chaque handler reçoit (context, data) où :
         * - context = { pageData, canvasData, canvasManager }
         * - data    = les données spécifiques à l'action
         *
         * apply()   applique le changement (redo / première exécution)
         * reverse() inverse le changement (undo)
         *
         * @type {Map<string, { apply: Function, reverse: Function }>}
         */
        this._actionHandlers = new Map();

        /**
         * Verrou anti-boucle : true pendant qu'on applique un undo/redo.
         * Empêche les setters de ré-enregistrer dans l'historique pendant
         * qu'on applique une action (ex: undo appelle un setter qui essaie
         * de recordChange → bloqué par ce flag).
         * @type {boolean}
         */
        this._isApplyingAction = false;

        /* ── Enregistrer les types d'actions intégrés ── */
        this._registerBuiltInActionTypes();
    }


    /* ══════════════════════════════════════════════════════════════
       REGISTRE DES TYPES D'ACTIONS

       Chaque module peut enregistrer ses propres types.
       Exemple futur depuis Core-Objects.js :
         historyManager.registerActionType('objectMove', {
             apply:   (ctx, d) => { ... },
             reverse: (ctx, d) => { ... }
         });
       ══════════════════════════════════════════════════════════════ */

    /**
     * Enregistre un type d'action dans le dispatcher central.
     *
     * @param {string} type — Identifiant unique du type (ex: 'pagePropertyChange').
     * @param {Object} handler — Les fonctions de traitement.
     * @param {Function} handler.apply   — (context, data) → applique le changement.
     * @param {Function} handler.reverse — (context, data) → inverse le changement.
     */
    registerActionType(type, handler) {

        if (this._actionHandlers.has(type)) {
            console.warn(`[History] registerActionType: type '${type}' déjà enregistré — écrasé.`);
        }
        this._actionHandlers.set(type, handler);
    }

    /**
     * Enregistre les types d'actions intégrés au Core.
     * Appelé par le constructeur.
     * @private
     */
    _registerBuiltInActionTypes() {

        /* ── pagePropertyChange : modification d'une propriété de page ── */
        /* data = { property: string, from: *, to: * }                    */
        this.registerActionType('pagePropertyChange', {
            apply: (context, data) => {
                context.pageData[data.property] = data.to;
            },
            reverse: (context, data) => {
                context.pageData[data.property] = data.from;
            }
        });

        /* ── batch : groupe d'actions (généré par pause/resume) ── */
        /* data = { actions: Action[] }                             */
        /* Chaque sous-action est dispatchée individuellement.      */
        this.registerActionType('batch', {
            apply: (context, data) => {
                /* Appliquer toutes les sous-actions dans l'ordre */
                for (let i = 0; i < data.actions.length; i++) {
                    this._dispatchApply(context, data.actions[i]);
                }
            },
            reverse: (context, data) => {
                /* Inverser toutes les sous-actions en ordre INVERSE */
                for (let i = data.actions.length - 1; i >= 0; i--) {
                    this._dispatchReverse(context, data.actions[i]);
                }
            }
        });
    }


    /* ══════════════════════════════════════════════════════════════
       HELPERS INTERNES
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
     * @param {number} [pageId]   — L'ID de la page (optionnel).
     * @param {string} methodName — Nom de la méthode appelante.
     * @returns {{ canvasData: Object, pageData: Object }|null}
     */
    _resolvePageData(canvasId, pageId, methodName) {

        const canvasData = this._getCanvasData(canvasId, methodName);
        if (!canvasData) return null;

        const targetPageId = (pageId !== undefined && pageId !== null)
            ? pageId
            : canvasData.activePageId;

        if (targetPageId === null) {
            console.error(`[History] ${methodName}: aucune page active dans canvas ${canvasId}.`);
            return null;
        }

        const pageData = canvasData.pages.get(targetPageId);
        if (!pageData) {
            console.error(`[History] ${methodName}: page ${targetPageId} inexistante dans canvas ${canvasId}.`);
            return null;
        }

        return { canvasData, pageData };
    }

    /**
     * Construit l'objet contexte passé aux handlers d'actions.
     * Ce contexte donne aux handlers accès à tout ce dont ils ont besoin
     * sans atteindre les variables globales.
     * @param {Object} canvasData — Les données du canvas.
     * @param {Object} pageData   — Les données de la page.
     * @returns {Object} Le contexte.
     */
    _buildContext(canvasData, pageData) {
        return {
            pageData:      pageData,
            canvasData:    canvasData,
            canvasManager: this._canvasManager
        };
    }


    /* ══════════════════════════════════════════════════════════════
       DISPATCHER CENTRAL

       Applique ou inverse une action via le registre de handlers.
       C'est le cœur du système — toute action passe par ici.
       ══════════════════════════════════════════════════════════════ */

    /**
     * Applique une action (redo / première exécution).
     * @param {Object} context — Le contexte d'exécution.
     * @param {Object} action  — L'action à appliquer.
     * @private
     */
    _dispatchApply(context, action) {

        const handler = this._actionHandlers.get(action.type);
        if (!handler) {
            console.error(`[History] _dispatchApply: type d'action inconnu '${action.type}'.`);
            return;
        }
        handler.apply(context, action.data);
    }

    /**
     * Inverse une action (undo).
     * @param {Object} context — Le contexte d'exécution.
     * @param {Object} action  — L'action à inverser.
     * @private
     */
    _dispatchReverse(context, action) {

        const handler = this._actionHandlers.get(action.type);
        if (!handler) {
            console.error(`[History] _dispatchReverse: type d'action inconnu '${action.type}'.`);
            return;
        }
        handler.reverse(context, action.data);
    }


    /* ══════════════════════════════════════════════════════════════
       NETTOYAGE DES ACTIONS ÉJECTÉES

       Quand des actions sont éjectées des piles (redoStack vidée
       lors d'une nouvelle branche, undoStack tronquée par le
       maxLevel, ou clear/destroy), les ressources associées
       (containers Pixi dans le pool d'objets) doivent être
       libérées pour éviter les fuites mémoire.

       Chaque type d'action peut fournir une fonction cleanup()
       optionnelle, appelée quand l'action est définitivement
       perdue (pas d'undo/redo possible).
       ══════════════════════════════════════════════════════════════ */

    /**
     * Nettoie les ressources associées à une action éjectée.
     * Appelle le handler cleanup() du type d'action s'il existe.
     * Gère récursivement les actions de type 'batch'.
     * @param {Object} action — L'action à nettoyer.
     * @private
     */
    _cleanupDiscardedAction(action) {

        /* ── Batch : nettoyer chaque sous-action ── */
        if (action.type === 'batch' && action.data && action.data.actions) {
            for (let i = 0; i < action.data.actions.length; i++) {
                this._cleanupDiscardedAction(action.data.actions[i]);
            }
            return;
        }

        /* ── Appeler le cleanup du handler s'il existe ── */
        const handler = this._actionHandlers.get(action.type);
        if (handler && typeof handler.cleanup === 'function') {
            handler.cleanup(action.data);
        }
    }

    /**
     * Nettoie toutes les actions d'un tableau (pile undo ou redo).
     * @param {Array} actions — Le tableau d'actions à nettoyer.
     * @private
     */
    _cleanupDiscardedActions(actions) {
        for (let i = 0; i < actions.length; i++) {
            this._cleanupDiscardedAction(actions[i]);
        }
    }


    /* ══════════════════════════════════════════════════════════════
       RE-RENDU APRÈS UNDO/REDO

       Déclenche le re-rendu Pixi.js si la page modifiée est la
       page active. Appelé une seule fois après chaque undo/redo,
       pas après chaque sous-action individuelle.
       ══════════════════════════════════════════════════════════════ */

    /**
     * Re-rend toutes les propriétés visuelles si la page modifiée est la page active.
     * @param {Object} canvasData — Les données du canvas.
     * @param {Object} pageData   — Les données de la page modifiée.
     * @private
     */
    _reRenderAfterHistoryAction(canvasData, pageData) {

        /* Ne re-rendre que si la page modifiée est la page active */
        if (pageData.id !== canvasData.activePageId) return;

        const renderEngine = this._canvasManager._renderEngine;
        if (!renderEngine) return;

        /* Re-rendre toutes les propriétés visuelles de la page (fond, bordure, grille) */
        renderEngine.renderAllPageVisuals(canvasData);

        /* Synchroniser les propriétés de sélection pageData → canvasData.
           Les propriétés de sélection vivent en double (canvasData = live,
           pageData = sauvegarde). Après un undo/redo, pageData est à jour
           mais canvasData peut être désynchronisé. */
        const selectionManager = this._canvasManager._selectionManager;
        if (selectionManager) {
            selectionManager.syncSelectionFromPage(canvasData, pageData);
        }
    }


    /* ══════════════════════════════════════════════════════════════
       INITIALISATION — Données d'historique dans pageData
       ══════════════════════════════════════════════════════════════ */

    /**
     * Initialise les structures d'historique dans un pageData fraîchement créé.
     * Appelé par CanvasPageManager._createPage().
     * @param {Object} pageData — L'objet de données de la page.
     */
    initHistory(pageData) {

        /** Pile des actions annulables (du plus ancien au plus récent). */
        pageData.historyUndoStack = [];

        /** Pile des actions refaisables (du plus ancien au plus récent). */
        pageData.historyRedoStack = [];

        /** Niveau maximum (nombre d'actions conservées dans undoStack). */
        pageData.historyMaxLevel = HISTORY_DEFAULT_MAX_LEVEL;

        /** Compteur de pauses imbriquées (0 = actif, >0 = en pause). */
        pageData.historyPauseCount = 0;

        /**
         * Actions en attente pendant un batch (pause/resume).
         * Map<coalescingKey, action> pour fusionner les actions sur la même cible.
         * Les actions sans clé de coalescing sont stockées avec une clé auto-générée.
         * @type {Map<string, Object>}
         */
        pageData.historyPendingActions = new Map();

        /**
         * Compteur auto-incrémenté pour les clés de coalescing non fournies.
         * Garantit l'unicité et l'ordre d'insertion.
         * @type {number}
         */
        pageData.historyPendingCounter = 0;
    }


    /* ══════════════════════════════════════════════════════════════
       ENREGISTREMENT D'ACTIONS
       ══════════════════════════════════════════════════════════════ */

    /**
     * Enregistre une action dans l'historique d'une page.
     *
     * Si l'historique est en pause (batch), l'action est accumulée dans
     * la map de pending. Si une coalescingKey est fournie ET qu'une
     * action avec la même clé existe déjà, les deux sont fusionnées
     * (on garde le 'from' de la première et le 'to' de la nouvelle).
     *
     * @param {Object} pageData       — Les données de la page.
     * @param {Object} action         — L'action à enregistrer.
     * @param {string} action.type    — Type de l'action (clé dans le registre).
     * @param {string} action.description — Description lisible pour le debug.
     * @param {Object} action.data    — Données spécifiques au type.
     * @param {string} [coalescingKey] — Clé de fusion optionnelle. Les actions
     *   avec la même clé pendant un même batch sont fusionnées.
     *   Ex: 'backgroundColor' pour les propriétés de page,
     *       '42:x' pour la position X de l'objet 42.
     */
    pushAction(pageData, action, coalescingKey) {

        /* ── Verrou anti-boucle : ne rien enregistrer pendant un undo/redo ── */
        if (this._isApplyingAction) return;

        /* ── En pause ? → accumuler avec coalescing ── */
        if (pageData.historyPauseCount > 0) {

            if (coalescingKey !== undefined && coalescingKey !== null) {

                /* ── Coalescing : fusionner si même clé déjà en attente ── */
                const existing = pageData.historyPendingActions.get(coalescingKey);

                if (existing && existing.type === action.type) {
                    /* ── Fusion : garder le 'from' original, prendre le 'to' nouveau ── */
                    /* Ceci fonctionne pour tous les types qui ont from/to dans data.     */
                    if (action.data.to !== undefined && existing.data.from !== undefined) {
                        existing.data.to = action.data.to;
                        existing.description = action.description;
                    } else {
                        /* Type sans from/to : remplacer l'action ── */
                        pageData.historyPendingActions.set(coalescingKey, action);
                    }
                } else {
                    /* Première action avec cette clé (ou type différent → remplacer) */
                    pageData.historyPendingActions.set(coalescingKey, action);
                }

            } else {
                /* Pas de clé de coalescing : stocker avec un index unique */
                pageData.historyPendingCounter++;
                pageData.historyPendingActions.set(
                    '__seq_' + pageData.historyPendingCounter,
                    action
                );
            }

            return;
        }

        /* ── Mode normal : pousser directement sur la pile undo ── */
        this._pushToUndoStack(pageData, action);
    }

    /**
     * Pousse une action sur la pile undo et vide la pile redo.
     * Respecte le niveau max (éjecte les plus anciennes si nécessaire).
     * @param {Object} pageData — Les données de la page.
     * @param {Object} action   — L'action à pousser.
     * @private
     */
    _pushToUndoStack(pageData, action) {

        /* ── Nettoyer les ressources des actions redo avant de les perdre ── */
        if (pageData.historyRedoStack.length > 0) {
            this._cleanupDiscardedActions(pageData.historyRedoStack);
        }

        /* ── Vider la pile redo (nouvelle branche d'historique) ── */
        pageData.historyRedoStack.length = 0;

        /* ── Pousser l'action ── */
        pageData.historyUndoStack.push(action);

        /* ── Respecter le niveau max ── */
        while (pageData.historyUndoStack.length > pageData.historyMaxLevel) {
            const ejected = pageData.historyUndoStack.shift();
            this._cleanupDiscardedAction(ejected);
        }
    }


    /* ══════════════════════════════════════════════════════════════
       MÉTHODE DE COMMODITÉ : pushPagePropertyChange

       Appelée par CanvasPageManager._recordChange() pour chaque
       setter de propriété de page. Crée l'action typée et appelle
       pushAction avec la clé de coalescing appropriée.
       ══════════════════════════════════════════════════════════════ */

    /**
     * Enregistre un changement de propriété de page.
     *
     * @param {Object} pageData     — Les données de la page.
     * @param {string} propertyName — Nom de la propriété (ex: 'backgroundColor').
     * @param {*}      oldValue     — Ancienne valeur.
     * @param {*}      newValue     — Nouvelle valeur.
     */
    pushPagePropertyChange(pageData, propertyName, oldValue, newValue) {

        /* Ne pas enregistrer si la valeur n'a pas changé */
        if (oldValue === newValue) return;

        this.pushAction(pageData, {
            type:        'pagePropertyChange',
            description: `${propertyName}: ${oldValue} → ${newValue}`,
            data: {
                property: propertyName,
                from:     oldValue,
                to:       newValue
            }
        }, propertyName); /* coalescingKey = nom de la propriété */
    }


    /* ══════════════════════════════════════════════════════════════
       PAUSE / RESUME — Opérations batch avec coalescing

       pause()  : commence l'accumulation (imbriquable)
       resume() : fusionne les actions accumulées en un seul 'batch'

       Utilisation typique (futur, pendant un drag multi-objets) :
         history.pause()
           // 500 objets × 60 appels mousemove = 30 000 appels
           // → fusionnés en 500 actions (1 par objet)
         history.resume('Déplacement de 500 objets')
           // → 1 seul Ctrl+Z annule tout
       ══════════════════════════════════════════════════════════════ */

    /**
     * Met l'historique d'une page en pause.
     * Les actions poussées pendant la pause sont accumulées et fusionnées.
     * Les pauses sont imbriquables (compteur).
     *
     * @param {number} canvasId — L'ID du canvas.
     * @param {number} [pageId] — L'ID de la page (optionnel, défaut: page active).
     * @returns {boolean} true si réussi.
     */
    pauseHistory(canvasId, pageId) {
        const result = this._resolvePageData(canvasId, pageId, 'pauseHistory');
        if (!result) return false;
        result.pageData.historyPauseCount++;
        return true;
    }

    /**
     * Reprend l'enregistrement de l'historique.
     * Si des actions ont été accumulées pendant la pause, elles sont
     * fusionnées (coalescing) puis regroupées en une seule action 'batch'
     * sur la pile undo.
     *
     * @param {number} canvasId          — L'ID du canvas.
     * @param {number} [pageId]          — L'ID de la page (optionnel, défaut: page active).
     * @param {string} [batchDescription] — Description du batch (optionnel).
     * @returns {boolean} true si réussi.
     */
    resumeHistory(canvasId, pageId, batchDescription) {
        const result = this._resolvePageData(canvasId, pageId, 'resumeHistory');
        if (!result) return false;

        const pageData = result.pageData;

        if (pageData.historyPauseCount <= 0) {
            console.warn('[History] resumeHistory: l\'historique n\'est pas en pause.');
            return false;
        }

        pageData.historyPauseCount--;

        /* ── Si on revient à 0, traiter les actions accumulées ── */
        if (pageData.historyPauseCount === 0 && pageData.historyPendingActions.size > 0) {

            /* ── Extraire les actions fusionnées (dans l'ordre d'insertion de la Map) ── */
            const coalescedActions = Array.from(pageData.historyPendingActions.values());

            /* ── Vider la map ── */
            pageData.historyPendingActions.clear();
            pageData.historyPendingCounter = 0;

            /* ── Filtrer les actions devenues no-op après coalescing ── */
            /* Ex: propriété changée 5 fois puis remise à la valeur d'origine */
            const effectiveActions = [];
            for (let i = 0; i < coalescedActions.length; i++) {
                const action = coalescedActions[i];
                /* Un changement dont from === to après coalescing = aucun changement réel */
                if (action.data && action.data.from !== undefined && action.data.from === action.data.to) {
                    continue;
                }
                effectiveActions.push(action);
            }

            /* ── Rien d'effectif ? → ne rien enregistrer ── */
            if (effectiveActions.length === 0) return true;

            /* ── Une seule action ? → pas besoin de wrapper batch ── */
            if (effectiveActions.length === 1) {
                this._pushToUndoStack(pageData, effectiveActions[0]);
                return true;
            }

            /* ── Plusieurs actions → créer un batch ── */
            this._pushToUndoStack(pageData, {
                type:        'batch',
                description: batchDescription || `Batch (${effectiveActions.length} actions)`,
                data: {
                    actions: effectiveActions
                }
            });
        }

        return true;
    }


    /* ══════════════════════════════════════════════════════════════
       UNDO / REDO

       Chaque opération :
       1. Dépile l'action
       2. Active le verrou _isApplyingAction
       3. Dispatche vers le handler (apply ou reverse)
       4. Désactive le verrou
       5. Re-rend les visuels si page active
       6. Émet l'événement
       ══════════════════════════════════════════════════════════════ */

    /**
     * Annule la dernière action sur une page.
     * @param {number} canvasId — L'ID du canvas.
     * @param {number} [pageId] — L'ID de la page (optionnel, défaut: page active).
     * @returns {boolean} true si une action a été annulée, false sinon.
     */
    undo(canvasId, pageId) {

        const result = this._resolvePageData(canvasId, pageId, 'undo');
        if (!result) return false;

        const pageData = result.pageData;
        if (pageData.historyUndoStack.length === 0) return false;

        /* ── Dépiler l'action la plus récente ── */
        const action = pageData.historyUndoStack.pop();

        /* ── Construire le contexte pour le dispatcher ── */
        const context = this._buildContext(result.canvasData, pageData);

        /* ── Activer le verrou anti-boucle ── */
        this._isApplyingAction = true;

        try {
            /* ── Dispatcher l'inversion ── */
            this._dispatchReverse(context, action);
        } catch (error) {
            console.error('[History] Erreur undo:', error);
        }

        /* ── Désactiver le verrou ── */
        this._isApplyingAction = false;

        /* ── Empiler sur la pile redo ── */
        pageData.historyRedoStack.push(action);

        /* ── Re-rendre les visuels ── */
        this._reRenderAfterHistoryAction(result.canvasData, pageData);

        /* ── Émettre l'événement ── */
        this._emit('page:undone', {
            canvasId: result.canvasData.id,
            pageId:   pageData.id,
            action:   action.description
        });

        return true;
    }

    /**
     * Refait la dernière action annulée sur une page.
     * @param {number} canvasId — L'ID du canvas.
     * @param {number} [pageId] — L'ID de la page (optionnel, défaut: page active).
     * @returns {boolean} true si une action a été refaite, false sinon.
     */
    redo(canvasId, pageId) {

        const result = this._resolvePageData(canvasId, pageId, 'redo');
        if (!result) return false;

        const pageData = result.pageData;
        if (pageData.historyRedoStack.length === 0) return false;

        /* ── Dépiler l'action la plus récente de redo ── */
        const action = pageData.historyRedoStack.pop();

        /* ── Construire le contexte pour le dispatcher ── */
        const context = this._buildContext(result.canvasData, pageData);

        /* ── Activer le verrou anti-boucle ── */
        this._isApplyingAction = true;

        try {
            /* ── Dispatcher l'application ── */
            this._dispatchApply(context, action);
        } catch (error) {
            console.error('[History] Erreur redo:', error);
        }

        /* ── Désactiver le verrou ── */
        this._isApplyingAction = false;

        /* ── Rempiler sur la pile undo ── */
        pageData.historyUndoStack.push(action);

        /* ── Re-rendre les visuels ── */
        this._reRenderAfterHistoryAction(result.canvasData, pageData);

        /* ── Émettre l'événement ── */
        this._emit('page:redone', {
            canvasId: result.canvasData.id,
            pageId:   pageData.id,
            action:   action.description
        });

        return true;
    }


    /* ══════════════════════════════════════════════════════════════
       INFORMATIONS
       ══════════════════════════════════════════════════════════════ */

    /**
     * Retourne true s'il y a au moins une action annulable.
     * @param {number} canvasId — L'ID du canvas.
     * @param {number} [pageId] — L'ID de la page (optionnel).
     * @returns {boolean}
     */
    canUndo(canvasId, pageId) {
        const result = this._resolvePageData(canvasId, pageId, 'canUndo');
        if (!result) return false;
        return result.pageData.historyUndoStack.length > 0;
    }

    /**
     * Retourne true s'il y a au moins une action refaisable.
     * @param {number} canvasId — L'ID du canvas.
     * @param {number} [pageId] — L'ID de la page (optionnel).
     * @returns {boolean}
     */
    canRedo(canvasId, pageId) {
        const result = this._resolvePageData(canvasId, pageId, 'canRedo');
        if (!result) return false;
        return result.pageData.historyRedoStack.length > 0;
    }

    /**
     * Retourne le nombre d'actions annulables.
     * @param {number} canvasId — L'ID du canvas.
     * @param {number} [pageId] — L'ID de la page (optionnel).
     * @returns {number}
     */
    getUndoCount(canvasId, pageId) {
        const result = this._resolvePageData(canvasId, pageId, 'getUndoCount');
        if (!result) return 0;
        return result.pageData.historyUndoStack.length;
    }

    /**
     * Retourne le nombre d'actions refaisables.
     * @param {number} canvasId — L'ID du canvas.
     * @param {number} [pageId] — L'ID de la page (optionnel).
     * @returns {number}
     */
    getRedoCount(canvasId, pageId) {
        const result = this._resolvePageData(canvasId, pageId, 'getRedoCount');
        if (!result) return 0;
        return result.pageData.historyRedoStack.length;
    }


    /* ══════════════════════════════════════════════════════════════
       CONFIGURATION
       ══════════════════════════════════════════════════════════════ */

    /**
     * Définit le niveau maximum de l'historique undo pour une page.
     * Si la pile actuelle dépasse le nouveau max, les plus anciennes sont éjectées.
     * @param {number} canvasId  — L'ID du canvas.
     * @param {number} maxLevel  — Nombre maximum d'actions (minimum 1).
     * @param {number} [pageId]  — L'ID de la page (optionnel).
     * @returns {boolean}
     */
    setMaxLevel(canvasId, maxLevel, pageId) {
        const result = this._resolvePageData(canvasId, pageId, 'setMaxLevel');
        if (!result) return false;

        maxLevel = Math.max(1, maxLevel);
        result.pageData.historyMaxLevel = maxLevel;

        /* Tronquer la pile si nécessaire */
        while (result.pageData.historyUndoStack.length > maxLevel) {
            const ejected = result.pageData.historyUndoStack.shift();
            this._cleanupDiscardedAction(ejected);
        }

        return true;
    }

    /**
     * Retourne le niveau maximum de l'historique undo.
     * @param {number} canvasId — L'ID du canvas.
     * @param {number} [pageId] — L'ID de la page (optionnel).
     * @returns {number|null}
     */
    getMaxLevel(canvasId, pageId) {
        const result = this._resolvePageData(canvasId, pageId, 'getMaxLevel');
        if (!result) return null;
        return result.pageData.historyMaxLevel;
    }

    /**
     * Vide l'historique undo et redo d'une page.
     * @param {number} canvasId — L'ID du canvas.
     * @param {number} [pageId] — L'ID de la page (optionnel).
     * @returns {boolean}
     */
    clear(canvasId, pageId) {
        const result = this._resolvePageData(canvasId, pageId, 'clear');
        if (!result) return false;

        /* ── Nettoyer les ressources avant de vider les piles ── */
        this._cleanupDiscardedActions(result.pageData.historyUndoStack);
        this._cleanupDiscardedActions(result.pageData.historyRedoStack);

        result.pageData.historyUndoStack.length = 0;
        result.pageData.historyRedoStack.length = 0;
        result.pageData.historyPendingActions.clear();
        result.pageData.historyPendingCounter = 0;

        this._emit('page:historyCleared', {
            canvasId: result.canvasData.id,
            pageId:   result.pageData.id
        });

        return true;
    }


    /* ══════════════════════════════════════════════════════════════
       SÉRIALISATION (pour futur .voh / debug)

       Les actions typées sont des objets JS plats sans closures,
       donc sérialisables en JSON à la demande. Ces méthodes seront
       utilisées pour la sauvegarde de projet et le rapport
       de diagnostic.
       ══════════════════════════════════════════════════════════════ */

    /**
     * Exporte l'historique d'une page en format sérialisable.
     * Utile pour la sauvegarde de projet (.voh) et le diagnostic.
     * @param {number} canvasId — L'ID du canvas.
     * @param {number} [pageId] — L'ID de la page (optionnel).
     * @returns {Object|null} { undoStack, redoStack, maxLevel } ou null.
     */
    exportHistory(canvasId, pageId) {
        const result = this._resolvePageData(canvasId, pageId, 'exportHistory');
        if (!result) return null;

        return {
            undoStack: result.pageData.historyUndoStack.slice(),
            redoStack: result.pageData.historyRedoStack.slice(),
            maxLevel:  result.pageData.historyMaxLevel
        };
    }

    /**
     * Importe un historique dans une page (restaure depuis .voh).
     * @param {number} canvasId — L'ID du canvas.
     * @param {Object} data     — Les données exportées.
     * @param {number} [pageId] — L'ID de la page (optionnel).
     * @returns {boolean}
     */
    importHistory(canvasId, data, pageId) {
        const result = this._resolvePageData(canvasId, pageId, 'importHistory');
        if (!result) return false;

        if (data.undoStack) result.pageData.historyUndoStack = data.undoStack.slice();
        if (data.redoStack) result.pageData.historyRedoStack = data.redoStack.slice();
        if (data.maxLevel)  result.pageData.historyMaxLevel  = data.maxLevel;

        return true;
    }


    /* ══════════════════════════════════════════════════════════════
       DESTRUCTION
       ══════════════════════════════════════════════════════════════ */

    /**
     * Vide l'historique d'une page (appelé à la suppression de la page).
     * @param {Object} pageData — Les données de la page.
     */
    destroyHistory(pageData) {

        /* ── Nettoyer les ressources avant de vider les piles ── */
        this._cleanupDiscardedActions(pageData.historyUndoStack);
        this._cleanupDiscardedActions(pageData.historyRedoStack);

        pageData.historyUndoStack.length = 0;
        pageData.historyRedoStack.length = 0;
        pageData.historyPendingActions.clear();
        pageData.historyPendingCounter = 0;
    }

    /**
     * Détruit le CanvasHistoryManager et libère toutes les ressources.
     * Appelé par CanvasManager.destroy().
     */
    destroy() {
        this._actionHandlers.clear();
        this._canvasManager = null;
    }
}


/* ═══════════════════════════════════════════════════════════════════════════
   EXPOSITION GLOBALE
   ═══════════════════════════════════════════════════════════════════════════ */
window.CanvasHistoryManager = CanvasHistoryManager;
