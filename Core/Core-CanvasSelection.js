/* ═══════════════════════════════════════════════════════════════════════════
   CORE-CANVASSELECTION.JS — Gestionnaire du rectangle de sélection souris

   Ce fichier gère le rectangle de sélection tracé à la souris sur un canvas.
   Il est utilisé par le CanvasManager (Core-Canvas.js) comme sous-module.

   Responsabilités :
   - Création et gestion du div overlay du rectangle de sélection
   - Événements souris pour le tracé (mousedown, mousemove, mouseup)
   - Apparence du rectangle (couleurs, bordure, style)
   - Simulation programmatique du tracé (API simulate / cancelSimulation)

   Note : les propriétés de sélection sont synchronisées avec les pages
   via SYNC_PROPERTIES (sauvegarde/chargement au changement de page active).

   Licence: Open Source (licence à définir)
   Auteur: David Dieppedalle (ShadowStorm)
   ═══════════════════════════════════════════════════════════════════════════ */

'use strict';


/* ═══════════════════════════════════════════════════════════════════════════
   CONSTANTES — Valeurs par défaut pour le rectangle de sélection
   ═══════════════════════════════════════════════════════════════════════════ */

/** Couleur de fond du rectangle de sélection (bleu semi-transparent). */
const CANVAS_DEFAULT_SELECTION_BACKGROUND_COLOR = 'rgba(0, 120, 215, 0.15)';

/** Couleur de bordure du rectangle de sélection. */
const CANVAS_DEFAULT_SELECTION_BORDER_COLOR = 'rgba(0, 120, 215, 0.8)';

/** Épaisseur de la bordure du rectangle de sélection (pixels). */
const CANVAS_DEFAULT_SELECTION_BORDER_THICKNESS = 1;

/** Style de la bordure du rectangle de sélection. Valeurs: 'solid', 'dashed', 'dotted'. */
const CANVAS_DEFAULT_SELECTION_BORDER_STYLE = 'solid';

/** Styles de bordure valides pour le rectangle de sélection. */
const CANVAS_SELECTION_BORDER_STYLES_VALID = ['solid', 'dashed', 'dotted'];

/** La sélection à la souris est désactivée par défaut. */
const CANVAS_DEFAULT_SELECTION_ENABLED = false;

/** Bouton souris pour tracer le rectangle de sélection (défaut: bouton gauche). */
const CANVAS_DEFAULT_SELECTION_MOUSE_BUTTON = 'left';

/** Correspondance bouton nommé → numéro MouseEvent.button. */
const CANVAS_SELECTION_MOUSE_BUTTON_MAP = { left: 0, middle: 1, right: 2 };

/** Boutons souris valides pour la sélection. */
const CANVAS_SELECTION_MOUSE_BUTTONS_VALID = ['left', 'middle', 'right'];


/* ═══════════════════════════════════════════════════════════════════════════
   CLASSE: CanvasSelectionManager

   Gère le rectangle de sélection souris pour tous les canvas.
   Reçoit une référence vers le CanvasManager pour accéder aux données
   des canvas et émettre les événements.
   ═══════════════════════════════════════════════════════════════════════════ */
class CanvasSelectionManager {

    /**
     * Crée le gestionnaire de sélection.
     * @param {CanvasManager} canvasManager — Référence vers le CanvasManager parent.
     */
    constructor(canvasManager) {
        this._canvasManager = canvasManager;
    }


    /* ══════════════════════════════════════════════════════════════
       MÉTHODES INTERNES: accès au CanvasManager parent
       ══════════════════════════════════════════════════════════════ */

    /**
     * Raccourci vers _getCanvasData du CanvasManager.
     * @param {number} canvasId — L'ID du canvas.
     * @param {string} methodName — Nom de la méthode appelante (pour les logs d'erreur).
     * @returns {Object|null} Les données du canvas, ou null si inexistant.
     */
    _getCanvasData(canvasId, methodName) {
        return this._canvasManager._getCanvasData(canvasId, methodName);
    }

    /**
     * Raccourci vers _emit du CanvasManager.
     * @param {string} eventName — Nom de l'événement.
     * @param {Object} data — Données de l'événement.
     */
    _emit(eventName, data) {
        this._canvasManager._emit(eventName, data);
    }


    /* ══════════════════════════════════════════════════════════════
       INITIALISATION — Valeurs par défaut dans canvasData
       ══════════════════════════════════════════════════════════════ */

    /**
     * Initialise les propriétés de sélection dans l'objet canvasData.
     * Appelé par CanvasManager.createCanvas() lors de la création d'un canvas.
     * @param {Object} canvasData — L'objet de données du canvas (déjà créé).
     * @param {Object} params — Les paramètres passés à createCanvas().
     */
    initSelectionDefaults(canvasData, params) {

        /* ── Propriétés visuelles du rectangle de sélection ── */
        canvasData.selectionBackgroundColor = params.selectionBackgroundColor !== undefined
            ? params.selectionBackgroundColor
            : CANVAS_DEFAULT_SELECTION_BACKGROUND_COLOR;
        canvasData.selectionBorderColor = params.selectionBorderColor !== undefined
            ? params.selectionBorderColor
            : CANVAS_DEFAULT_SELECTION_BORDER_COLOR;
        canvasData.selectionBorderThickness = params.selectionBorderThickness !== undefined
            ? params.selectionBorderThickness
            : CANVAS_DEFAULT_SELECTION_BORDER_THICKNESS;
        canvasData.selectionBorderStyle = params.selectionBorderStyle !== undefined
            ? params.selectionBorderStyle
            : CANVAS_DEFAULT_SELECTION_BORDER_STYLE;
        canvasData.selectionEnabled = params.selectionEnabled !== undefined
            ? params.selectionEnabled
            : CANVAS_DEFAULT_SELECTION_ENABLED;
        canvasData.selectionMouseButton = params.selectionMouseButton !== undefined
            ? params.selectionMouseButton
            : CANVAS_DEFAULT_SELECTION_MOUSE_BUTTON;

        /* ── État interne du tracé en cours ── */
        canvasData.selectionIsDrawing          = false;
        canvasData.selectionIsSimulating       = false;
        canvasData.selectionSimulationRAF      = null;
        canvasData.selectionSimulationResolve  = null;
        canvasData.selectionStartX             = 0;
        canvasData.selectionStartY             = 0;
        canvasData.selectionRectElement        = null;
    }


    /* ══════════════════════════════════════════════════════════════
       INITIALISATION — Div overlay et événements souris
       ══════════════════════════════════════════════════════════════ */

    /**
     * Crée le div overlay du rectangle de sélection pour un canvas.
     * Le div est en position absolute dans le canvas, pointer-events none,
     * caché par défaut. Son style visuel sera appliqué à chaque début de tracé.
     * @param {Object} canvasData — Les données du canvas.
     */
    initSelectionRect(canvasData) {

        const rectElement = document.createElement('div');

        /* Positionnement : flotte au-dessus du contenu du canvas */
        rectElement.style.position       = 'absolute';
        rectElement.style.pointerEvents  = 'none'; /* ne bloque pas les clics sur les objets */
        rectElement.style.display        = 'none'; /* caché jusqu'au premier tracé */
        rectElement.style.boxSizing      = 'border-box';
        rectElement.style.zIndex         = '9999'; /* toujours au premier plan dans le canvas */
        rectElement.className            = 'voh-canvas-selection-rect';

        canvasData.element.appendChild(rectElement);
        canvasData.selectionRectElement = rectElement;
    }

    /**
     * Branche les événements souris sur l'élément DOM du canvas pour gérer
     * le tracé du rectangle de sélection.
     * Les handlers sont stockés dans canvasData pour pouvoir les retirer proprement.
     * @param {Object} canvasData — Les données du canvas.
     */
    initSelectionEvents(canvasData) {

        /* ── Handler mousedown : début du tracé ── */
        canvasData._selectionOnMouseDown = (event) => {

            /* Vérifier que la sélection est activée et que c'est le bon bouton */
            if (!canvasData.selectionEnabled) return;
            if (canvasData.selectionIsSimulating) return; /* simulation en cours — ignorer la souris */
            const expectedButton = CANVAS_SELECTION_MOUSE_BUTTON_MAP[canvasData.selectionMouseButton];
            if (event.button !== expectedButton) return;

            /* Vérifier si un objet est sous le curseur.
               Si oui, la sélection d'objet prend la main — le rectangle ne démarre pas. */
            const voh = this._canvasManager._voh;
            if (voh && voh._objectInteractionManager) {
                const rect     = canvasData.element.getBoundingClientRect();
                const checkX   = event.clientX - rect.left;
                const checkY   = event.clientY - rect.top;
                const hitObject = voh._objectInteractionManager.hitTest(canvasData.id, checkX, checkY);
                if (hitObject) return;
            }

            /* Empêcher la sélection de texte du navigateur pendant le tracé */
            event.preventDefault();

            /* ── Désélectionner immédiatement tous les objets au clic sur le fond
               (sans attendre le mouseup) — sauf si Ctrl est enfoncé (ajout au groupe) ── */
            if (!event.ctrlKey && !event.metaKey) {
                const vohInstance = this._canvasManager._voh;
                if (vohInstance && vohInstance._objectSelectionManager) {
                    vohInstance._objectSelectionManager.deselectAll(canvasData.id);
                }
            }

            /* Calculer la position relative au canvas */
            const rect   = canvasData.element.getBoundingClientRect();
            const startX = event.clientX - rect.left;
            const startY = event.clientY - rect.top;

            canvasData.selectionIsDrawing = true;
            canvasData.selectionStartX    = startX;
            canvasData.selectionStartY    = startY;

            /* Appliquer le style visuel courant et afficher le rectangle */
            this._applyCanvasSelectionRectStyle(canvasData);
            this._updateCanvasSelectionRect(canvasData, startX, startY);
            canvasData.selectionRectElement.style.display = 'block';

            this._emit('canvas:selectionStarted', {
                canvasId: canvasData.id,
                x: startX, y: startY
            });
        };

        /* ── Handler mousemove : mise à jour du rectangle pendant le tracé ── */
        canvasData._selectionOnMouseMove = (event) => {

            if (!canvasData.selectionIsDrawing) return;

            const rect     = canvasData.element.getBoundingClientRect();
            const currentX = event.clientX - rect.left;
            const currentY = event.clientY - rect.top;

            this._updateCanvasSelectionRect(canvasData, currentX, currentY);
        };

        /* ── Handler mouseup : fin du tracé ── */
        canvasData._selectionOnMouseUp = (event) => {

            if (!canvasData.selectionIsDrawing) return;
            const expectedButton = CANVAS_SELECTION_MOUSE_BUTTON_MAP[canvasData.selectionMouseButton];
            if (event.button !== expectedButton) return;

            canvasData.selectionIsDrawing = false;

            /* Récupérer les coordonnées finales du rectangle */
            const rect     = canvasData.element.getBoundingClientRect();
            const endX     = event.clientX - rect.left;
            const endY     = event.clientY - rect.top;
            const x        = Math.min(canvasData.selectionStartX, endX);
            const y        = Math.min(canvasData.selectionStartY, endY);
            const width    = Math.abs(endX - canvasData.selectionStartX);
            const height   = Math.abs(endY - canvasData.selectionStartY);

            /* Masquer le rectangle */
            canvasData.selectionRectElement.style.display = 'none';

            this._emit('canvas:selectionEnded', {
                canvasId: canvasData.id,
                x: x, y: y, width: width, height: height,
                ctrlKey: event.ctrlKey
            });

            /* ── Signaler au handler click qu'un rectangle de sélection vient de se
               terminer (le mouseup déclenche un click → il faut l'ignorer) ── */
            canvasData._selectionJustEnded = true;
        };

        /* ── Handler contextmenu : bloquer le menu clic-droit si bouton = right ── */
        canvasData._selectionOnContextMenu = (event) => {
            if (canvasData.selectionEnabled && canvasData.selectionMouseButton === 'right') {
                event.preventDefault();
            }
        };

        /* ── Brancher sur l'élément DOM du canvas ── */
        canvasData.element.addEventListener('mousedown',    canvasData._selectionOnMouseDown);
        canvasData.element.addEventListener('contextmenu',  canvasData._selectionOnContextMenu);

        /* mousemove et mouseup sur le document pour capturer même hors du canvas */
        document.addEventListener('mousemove', canvasData._selectionOnMouseMove);
        document.addEventListener('mouseup',   canvasData._selectionOnMouseUp);
    }

    /**
     * Retire les événements souris de sélection d'un canvas.
     * Appelé à la suppression du canvas ou à la destruction de l'instance.
     * @param {Object} canvasData — Les données du canvas.
     */
    destroySelectionEvents(canvasData) {

        if (canvasData._selectionOnMouseDown) {
            canvasData.element.removeEventListener('mousedown',   canvasData._selectionOnMouseDown);
            canvasData.element.removeEventListener('contextmenu', canvasData._selectionOnContextMenu);
            document.removeEventListener('mousemove', canvasData._selectionOnMouseMove);
            document.removeEventListener('mouseup',   canvasData._selectionOnMouseUp);
            canvasData._selectionOnMouseDown    = null;
            canvasData._selectionOnMouseMove    = null;
            canvasData._selectionOnMouseUp      = null;
            canvasData._selectionOnContextMenu  = null;
        }
    }


    /* ══════════════════════════════════════════════════════════════
       MÉTHODES INTERNES: rendu du rectangle
       ══════════════════════════════════════════════════════════════ */

    /**
     * Applique le style visuel courant (couleurs, épaisseur, style de trait)
     * sur le div du rectangle de sélection.
     * @param {Object} canvasData — Les données du canvas.
     */
    _applyCanvasSelectionRectStyle(canvasData) {

        const rect = canvasData.selectionRectElement;
        if (!rect) return;

        rect.style.backgroundColor = canvasData.selectionBackgroundColor;
        rect.style.borderColor     = canvasData.selectionBorderColor;
        rect.style.borderWidth     = canvasData.selectionBorderThickness + 'px';
        rect.style.borderStyle     = canvasData.selectionBorderStyle;
    }

    /**
     * Met à jour la position et taille du div du rectangle de sélection
     * pendant le tracé à la souris.
     * @param {Object} canvasData — Les données du canvas.
     * @param {number} currentX   — Position X courante de la souris (relative au canvas).
     * @param {number} currentY   — Position Y courante de la souris (relative au canvas).
     */
    _updateCanvasSelectionRect(canvasData, currentX, currentY) {

        const rect = canvasData.selectionRectElement;
        if (!rect) return;

        /* Calculer le rectangle normalisé (gère le tracé dans n'importe quelle direction) */
        const x      = Math.min(canvasData.selectionStartX, currentX);
        const y      = Math.min(canvasData.selectionStartY, currentY);
        const width  = Math.abs(currentX - canvasData.selectionStartX);
        const height = Math.abs(currentY - canvasData.selectionStartY);

        rect.style.left   = x + 'px';
        rect.style.top    = y + 'px';
        rect.style.width  = width  + 'px';
        rect.style.height = height + 'px';
    }

    /**
     * Annulation interne d'une simulation — stoppe le RAF, masque le rectangle,
     * résout la Promise avec false et restitue le style d'origine.
     * @param {Object} canvasData — Les données du canvas.
     */
    _cancelCanvasSelectionSimulationInternal(canvasData) {

        if (canvasData.selectionSimulationRAF) {
            cancelAnimationFrame(canvasData.selectionSimulationRAF);
            canvasData.selectionSimulationRAF = null;
        }

        canvasData.selectionRectElement.style.display = 'none';
        canvasData.selectionIsSimulating = false;

        /* Restituer le style d'origine sauvegardé au début de simulate() */
        if (canvasData._selectionSavedStyle) {
            canvasData.selectionBackgroundColor  = canvasData._selectionSavedStyle.backgroundColor;
            canvasData.selectionBorderColor      = canvasData._selectionSavedStyle.borderColor;
            canvasData.selectionBorderThickness   = canvasData._selectionSavedStyle.borderThickness;
            canvasData.selectionBorderStyle       = canvasData._selectionSavedStyle.borderStyle;
            canvasData._selectionSavedStyle = null;
        }

        /* Résoudre la Promise avec false pour signaler l'annulation */
        if (canvasData.selectionSimulationResolve) {
            canvasData.selectionSimulationResolve(false);
            canvasData.selectionSimulationResolve = null;
        }
    }


    /* ══════════════════════════════════════════════════════════════
       SYNCHRONISATION AVEC LES PAGES

       Les propriétés de sélection vivent à deux endroits :
       - canvasData.selection* → utilisé par le rendu en temps réel
       - pageData.selection*   → stockage par page

       Au changement de page active :
       1. Sauvegarder canvasData → ancienne page
       2. Charger nouvelle page → canvasData

       Quand un setter canvas.selection.* est appelé :
       - Met à jour canvasData (rendu) ET la page active (stockage)
       ══════════════════════════════════════════════════════════════ */

    /** Liste des propriétés de sélection à synchroniser. */
    static get SYNC_PROPERTIES() {
        return [
            'selectionEnabled',
            'selectionMouseButton',
            'selectionBackgroundColor',
            'selectionBorderColor',
            'selectionBorderThickness',
            'selectionBorderStyle'
        ];
    }

    /**
     * Sauvegarde les propriétés de sélection de canvasData vers une page.
     * Appelé AVANT de changer de page active.
     * @param {Object} canvasData — Les données du canvas.
     * @param {Object} pageData   — La page cible (ancienne page active).
     */
    syncSelectionToPage(canvasData, pageData) {
        for (const prop of CanvasSelectionManager.SYNC_PROPERTIES) {
            pageData[prop] = canvasData[prop];
        }
    }

    /**
     * Charge les propriétés de sélection d'une page vers canvasData.
     * Appelé APRÈS avoir changé de page active.
     * Met aussi à jour le style visuel du rectangle de sélection.
     * @param {Object} canvasData — Les données du canvas.
     * @param {Object} pageData   — La page source (nouvelle page active).
     */
    syncSelectionFromPage(canvasData, pageData) {
        for (const prop of CanvasSelectionManager.SYNC_PROPERTIES) {
            canvasData[prop] = pageData[prop];
        }
        /* Mettre à jour le style visuel du rectangle (même s'il est caché) */
        this._applyCanvasSelectionRectStyle(canvasData);
    }

    /**
     * Écrit une propriété de sélection dans la page active du canvas.
     * Appelé par les setters pour garder canvasData et pageData synchronisés.
     * @param {Object} canvasData   — Les données du canvas.
     * @param {string} propertyName — Nom de la propriété (ex: 'selectionEnabled').
     * @param {*}      value        — La valeur à écrire.
     */
    _syncPropertyToActivePage(canvasData, propertyName, value) {
        if (canvasData.activePageId !== null) {
            const pageData = canvasData.pages.get(canvasData.activePageId);
            if (pageData) {
                pageData[propertyName] = value;
            }
        }
    }


    /* ══════════════════════════════════════════════════════════════
       ACTIVATION / DÉSACTIVATION
       ══════════════════════════════════════════════════════════════ */

    /**
     * Active ou désactive la sélection à la souris sur un canvas.
     * Quand false (défaut), aucun rectangle de sélection ne peut être tracé.
     * Le style (couleurs, épaisseur, style) reste configurable dans tous les cas.
     * @param {number}  canvasId — L'ID du canvas.
     * @param {boolean} enabled  — true pour activer, false pour désactiver.
     * @returns {boolean} true si réussi, false si canvas inexistant.
     */
    setEnabled(canvasId, enabled) {
        const canvasData = this._getCanvasData(canvasId, 'setCanvasSelectionEnabled');
        if (!canvasData) return false;
        canvasData.selectionEnabled = enabled;
        this._syncPropertyToActivePage(canvasData, 'selectionEnabled', enabled);
        this._emit('canvas:selectionEnabledChanged', { canvasId: canvasId, enabled: enabled });
        return true;
    }

    /**
     * Retourne l'état d'activation de la sélection à la souris.
     * @param {number} canvasId — L'ID du canvas.
     * @returns {boolean|null} true si activée, false si désactivée, null si canvas inexistant.
     */
    getEnabled(canvasId) {
        const canvasData = this._getCanvasData(canvasId, 'getCanvasSelectionEnabled');
        if (!canvasData) return null;
        return canvasData.selectionEnabled;
    }


    /* ══════════════════════════════════════════════════════════════
       BOUTON SOURIS
       ══════════════════════════════════════════════════════════════ */

    /**
     * Définit le bouton souris utilisé pour tracer le rectangle de sélection.
     * @param {number} canvasId — L'ID du canvas.
     * @param {string} button   — 'left', 'middle' ou 'right'.
     * @returns {boolean} true si réussi, false si canvas inexistant ou bouton invalide.
     */
    setMouseButton(canvasId, button) {
        const canvasData = this._getCanvasData(canvasId, 'setCanvasSelectionMouseButton');
        if (!canvasData) return false;
        if (!CANVAS_SELECTION_MOUSE_BUTTONS_VALID.includes(button)) {
            console.warn(`[Canvas] setCanvasSelectionMouseButton: bouton '${button}' invalide. Valeurs autorisées: ${CANVAS_SELECTION_MOUSE_BUTTONS_VALID.join(', ')}.`);
            return false;
        }
        canvasData.selectionMouseButton = button;
        this._syncPropertyToActivePage(canvasData, 'selectionMouseButton', button);
        this._emit('canvas:selectionMouseButtonChanged', { canvasId: canvasId, mouseButton: button });
        return true;
    }

    /**
     * Retourne le bouton souris configuré pour la sélection.
     * @param {number} canvasId — L'ID du canvas.
     * @returns {string|null} 'left', 'middle' ou 'right', ou null si canvas inexistant.
     */
    getMouseButton(canvasId) {
        const canvasData = this._getCanvasData(canvasId, 'getCanvasSelectionMouseButton');
        if (!canvasData) return null;
        return canvasData.selectionMouseButton;
    }


    /* ══════════════════════════════════════════════════════════════
       COULEUR DE FOND DU RECTANGLE
       ══════════════════════════════════════════════════════════════ */

    /**
     * Définit la couleur de fond du rectangle de sélection.
     * Accepte toute valeur CSS valide incluant rgba() pour la transparence.
     * @param {number} canvasId — L'ID du canvas.
     * @param {string} color — Couleur CSS (ex: 'rgba(0, 120, 215, 0.15)').
     * @returns {boolean} true si réussi, false si canvas inexistant.
     */
    setBackgroundColor(canvasId, color) {
        const canvasData = this._getCanvasData(canvasId, 'setCanvasSelectionBackgroundColor');
        if (!canvasData) return false;
        canvasData.selectionBackgroundColor = color;
        this._syncPropertyToActivePage(canvasData, 'selectionBackgroundColor', color);
        this._emit('canvas:selectionBackgroundColorChanged', { canvasId: canvasId, backgroundColor: color });
        return true;
    }

    /**
     * Retourne la couleur de fond du rectangle de sélection.
     * @param {number} canvasId — L'ID du canvas.
     * @returns {string|null} La couleur CSS ou null si canvas inexistant.
     */
    getBackgroundColor(canvasId) {
        const canvasData = this._getCanvasData(canvasId, 'getCanvasSelectionBackgroundColor');
        if (!canvasData) return null;
        return canvasData.selectionBackgroundColor;
    }


    /* ══════════════════════════════════════════════════════════════
       COULEUR DE BORDURE DU RECTANGLE
       ══════════════════════════════════════════════════════════════ */

    /**
     * Définit la couleur de bordure du rectangle de sélection.
     * Accepte toute valeur CSS valide incluant rgba() pour la transparence.
     * @param {number} canvasId — L'ID du canvas.
     * @param {string} color — Couleur CSS (ex: 'rgba(0, 120, 215, 0.8)').
     * @returns {boolean} true si réussi, false si canvas inexistant.
     */
    setBorderColor(canvasId, color) {
        const canvasData = this._getCanvasData(canvasId, 'setCanvasSelectionBorderColor');
        if (!canvasData) return false;
        canvasData.selectionBorderColor = color;
        this._syncPropertyToActivePage(canvasData, 'selectionBorderColor', color);
        this._emit('canvas:selectionBorderColorChanged', { canvasId: canvasId, borderColor: color });
        return true;
    }

    /**
     * Retourne la couleur de bordure du rectangle de sélection.
     * @param {number} canvasId — L'ID du canvas.
     * @returns {string|null} La couleur CSS ou null si canvas inexistant.
     */
    getBorderColor(canvasId) {
        const canvasData = this._getCanvasData(canvasId, 'getCanvasSelectionBorderColor');
        if (!canvasData) return null;
        return canvasData.selectionBorderColor;
    }


    /* ══════════════════════════════════════════════════════════════
       ÉPAISSEUR DE BORDURE DU RECTANGLE
       ══════════════════════════════════════════════════════════════ */

    /**
     * Définit l'épaisseur de la bordure du rectangle de sélection.
     * @param {number} canvasId — L'ID du canvas.
     * @param {number} thickness — Épaisseur en pixels (minimum 0).
     * @returns {boolean} true si réussi, false si canvas inexistant.
     */
    setBorderThickness(canvasId, thickness) {
        const canvasData = this._getCanvasData(canvasId, 'setCanvasSelectionBorderThickness');
        if (!canvasData) return false;
        /* Borner à 0 minimum */
        thickness = Math.max(0, thickness);
        canvasData.selectionBorderThickness = thickness;
        this._syncPropertyToActivePage(canvasData, 'selectionBorderThickness', canvasData.selectionBorderThickness);
        this._emit('canvas:selectionBorderThicknessChanged', { canvasId: canvasId, borderThickness: thickness });
        return true;
    }

    /**
     * Retourne l'épaisseur de la bordure du rectangle de sélection.
     * @param {number} canvasId — L'ID du canvas.
     * @returns {number|null} L'épaisseur en pixels ou null si canvas inexistant.
     */
    getBorderThickness(canvasId) {
        const canvasData = this._getCanvasData(canvasId, 'getCanvasSelectionBorderThickness');
        if (!canvasData) return null;
        return canvasData.selectionBorderThickness;
    }


    /* ══════════════════════════════════════════════════════════════
       STYLE DE BORDURE DU RECTANGLE
       ══════════════════════════════════════════════════════════════ */

    /**
     * Définit le style de la bordure du rectangle de sélection.
     * @param {number} canvasId — L'ID du canvas.
     * @param {string} style — Style de trait: 'solid', 'dashed' ou 'dotted'.
     * @returns {boolean} true si réussi, false si canvas inexistant ou style invalide.
     */
    setBorderStyle(canvasId, style) {
        const canvasData = this._getCanvasData(canvasId, 'setCanvasSelectionBorderStyle');
        if (!canvasData) return false;
        /* Valider que le style est autorisé */
        if (!CANVAS_SELECTION_BORDER_STYLES_VALID.includes(style)) {
            console.warn(`[Canvas] setCanvasSelectionBorderStyle: style '${style}' invalide. Valeurs autorisées: ${CANVAS_SELECTION_BORDER_STYLES_VALID.join(', ')}.`);
            return false;
        }
        canvasData.selectionBorderStyle = style;
        this._syncPropertyToActivePage(canvasData, 'selectionBorderStyle', style);
        this._emit('canvas:selectionBorderStyleChanged', { canvasId: canvasId, borderStyle: style });
        return true;
    }

    /**
     * Retourne le style de la bordure du rectangle de sélection.
     * @param {number} canvasId — L'ID du canvas.
     * @returns {string|null} Le style ('solid', 'dashed', 'dotted') ou null si canvas inexistant.
     */
    getBorderStyle(canvasId) {
        const canvasData = this._getCanvasData(canvasId, 'getCanvasSelectionBorderStyle');
        if (!canvasData) return null;
        return canvasData.selectionBorderStyle;
    }


    /* ══════════════════════════════════════════════════════════════
       SIMULATION PROGRAMMATIQUE
       ══════════════════════════════════════════════════════════════ */

    /**
     * Simule programmatiquement un tracé de rectangle de sélection à la souris.
     *
     * Si un tracé souris est déjà en cours sur ce canvas, il est annulé proprement
     * avant de lancer la simulation. Si une simulation est déjà en cours, elle est
     * annulée et remplacée par la nouvelle.
     *
     * Les overrides de style (backgroundColor, borderColor, etc.) sont appliqués
     * uniquement le temps de la simulation, puis le style d'origine est restitué.
     *
     * @param {number} canvasId — L'ID du canvas.
     * @param {number} x1 — X de départ du tracé (relatif au canvas, en pixels).
     * @param {number} y1 — Y de départ du tracé (relatif au canvas, en pixels).
     * @param {number} x2 — X de fin du tracé (relatif au canvas, en pixels).
     * @param {number} y2 — Y de fin du tracé (relatif au canvas, en pixels).
     * @param {Object} [options={}] — Options facultatives.
     * @param {number} [options.duration=600] — Durée de l'animation en ms. 0 = instantané.
     * @param {string} [options.backgroundColor] — Override couleur de fond pendant la simulation.
     * @param {string} [options.borderColor] — Override couleur de bordure pendant la simulation.
     * @param {number} [options.borderThickness] — Override épaisseur de bordure pendant la simulation.
     * @param {string} [options.borderStyle] — Override style de bordure pendant la simulation.
     * @returns {Promise<boolean>} Résout true quand la simulation est terminée, false si canvas inexistant.
     */
    simulate(canvasId, x1, y1, x2, y2, options = {}) {

        const canvasData = this._getCanvasData(canvasId, 'simulateCanvasSelection');
        if (!canvasData) return Promise.resolve(false);

        /* ── Annuler un tracé souris en cours ── */
        if (canvasData.selectionIsDrawing) {
            canvasData.selectionIsDrawing = false;
            canvasData.selectionRectElement.style.display = 'none';
            console.warn('[Canvas] simulateCanvasSelection: tracé souris annulé pour lancer la simulation.');
        }

        /* ── Annuler une simulation déjà en cours ── */
        if (canvasData.selectionIsSimulating) {
            this._cancelCanvasSelectionSimulationInternal(canvasData);
        }

        /* ── Sauvegarder le style actuel pour le restituer à la fin ── */
        canvasData._selectionSavedStyle = {
            backgroundColor: canvasData.selectionBackgroundColor,
            borderColor:     canvasData.selectionBorderColor,
            borderThickness: canvasData.selectionBorderThickness,
            borderStyle:     canvasData.selectionBorderStyle
        };

        /* ── Appliquer les overrides de style si fournis ── */
        const duration = (typeof options.duration === 'number') ? options.duration : 600;
        if (options.backgroundColor !== undefined) canvasData.selectionBackgroundColor = options.backgroundColor;
        if (options.borderColor      !== undefined) canvasData.selectionBorderColor     = options.borderColor;
        if (options.borderThickness  !== undefined) canvasData.selectionBorderThickness  = options.borderThickness;
        if (options.borderStyle      !== undefined) canvasData.selectionBorderStyle      = options.borderStyle;

        /* ── Retourner une Promise qui se résout à la fin du tracé ── */
        return new Promise((resolve) => {

            canvasData.selectionIsSimulating      = true;
            canvasData.selectionSimulationResolve = resolve;

            /* Définir le point d'ancrage AVANT tout appel à _updateCanvasSelectionRect
               — sans ça, le rectangle partirait de (0,0) ou du dernier clic souris */
            canvasData.selectionStartX = x1;
            canvasData.selectionStartY = y1;

            /* Appliquer le style visuel (overrides éventuels) et afficher le rectangle */
            this._applyCanvasSelectionRectStyle(canvasData);
            this._updateCanvasSelectionRect(canvasData, x1, y1); /* taille nulle au départ */
            canvasData.selectionRectElement.style.display = 'block';

            /* Émettre selectionStarted */
            this._emit('canvas:selectionStarted', { canvasId, x: x1, y: y1 });

            /* ── Mode instantané (duration = 0) ── */
            if (duration === 0) {
                this._updateCanvasSelectionRect(canvasData, x2, y2);

                /* Calculer le rectangle normalisé final */
                const rx = Math.min(x1, x2);
                const ry = Math.min(y1, y2);
                const rw = Math.abs(x2 - x1);
                const rh = Math.abs(y2 - y1);

                canvasData.selectionRectElement.style.display = 'none';
                canvasData.selectionIsSimulating      = false;
                canvasData.selectionSimulationResolve = null;

                /* Restituer le style d'origine */
                canvasData.selectionBackgroundColor  = canvasData._selectionSavedStyle.backgroundColor;
                canvasData.selectionBorderColor      = canvasData._selectionSavedStyle.borderColor;
                canvasData.selectionBorderThickness   = canvasData._selectionSavedStyle.borderThickness;
                canvasData.selectionBorderStyle       = canvasData._selectionSavedStyle.borderStyle;
                canvasData._selectionSavedStyle = null;

                this._emit('canvas:selectionEnded', { canvasId, x: rx, y: ry, width: rw, height: rh, ctrlKey: false });
                resolve(true);
                return;
            }

            /* ── Mode animé ── */
            const startTime = performance.now();

            const animate = (now) => {

                /* Si la simulation a été annulée entre deux frames */
                if (!canvasData.selectionIsSimulating) return;

                /* Progression linéaire 0 → 1 */
                const progress = Math.min((now - startTime) / duration, 1);

                /* Interpoler la position courante */
                const currentX = x1 + (x2 - x1) * progress;
                const currentY = y1 + (y2 - y1) * progress;

                this._updateCanvasSelectionRect(canvasData, currentX, currentY);

                if (progress < 1) {
                    /* Continuer l'animation */
                    canvasData.selectionSimulationRAF = requestAnimationFrame(animate);
                } else {
                    /* Animation terminée — émettre selectionEnded */
                    const rx = Math.min(x1, x2);
                    const ry = Math.min(y1, y2);
                    const rw = Math.abs(x2 - x1);
                    const rh = Math.abs(y2 - y1);

                    canvasData.selectionRectElement.style.display = 'none';
                    canvasData.selectionIsSimulating      = false;
                    canvasData.selectionSimulationRAF     = null;
                    canvasData.selectionSimulationResolve = null;

                    /* Restituer le style d'origine */
                    canvasData.selectionBackgroundColor  = canvasData._selectionSavedStyle.backgroundColor;
                    canvasData.selectionBorderColor      = canvasData._selectionSavedStyle.borderColor;
                    canvasData.selectionBorderThickness   = canvasData._selectionSavedStyle.borderThickness;
                    canvasData.selectionBorderStyle       = canvasData._selectionSavedStyle.borderStyle;
                    canvasData._selectionSavedStyle = null;

                    this._emit('canvas:selectionEnded', { canvasId, x: rx, y: ry, width: rw, height: rh, ctrlKey: false });
                    resolve(true);
                }
            };

            canvasData.selectionSimulationRAF = requestAnimationFrame(animate);
        });
    }

    /**
     * Annule une simulation de sélection en cours sur un canvas.
     * Si aucune simulation n'est active, retourne false sans rien faire.
     * @param {number} canvasId — L'ID du canvas.
     * @returns {boolean} true si une simulation a été annulée, false sinon.
     */
    cancelSimulation(canvasId) {
        const canvasData = this._getCanvasData(canvasId, 'cancelCanvasSelectionSimulation');
        if (!canvasData) return false;
        if (!canvasData.selectionIsSimulating) return false;
        this._cancelCanvasSelectionSimulationInternal(canvasData);
        return true;
    }
}


/* ═══════════════════════════════════════════════════════════════════════════
   EXPOSITION GLOBALE
   ═══════════════════════════════════════════════════════════════════════════ */
window.CanvasSelectionManager = CanvasSelectionManager;
