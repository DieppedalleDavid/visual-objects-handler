/* ═══════════════════════════════════════════════════════════════════════════
   CORE-EVENTEMITTER.JS — Système d'événements pub/sub pour VOH v5

   Gère l'abonnement et l'émission d'événements dans tout le moteur.
   Format des événements: domaine:action (ex: zone:created, canvas:resized)

   Utilisé par:
   - Core-Main.js           → crée l'EventEmitter, expose on/off/once
   - Core-Zone.js           → émet les événements zone:*
   - Core-Canvas.js         → émet les événements canvas:*
   - Core-CanvasPage.js     → émet les événements page:*
   - Core-CanvasSelection.js→ émet les événements canvas:selection*
   - Core-Objects.js        → émet les événements object:*
   - Core-API.js            → expose voh.on(), voh.off(), voh.once(), etc.

   Licence: Open Source (licence à définir)
   Auteur: David Dieppedalle (ShadowStorm)
   ═══════════════════════════════════════════════════════════════════════════ */

'use strict';


/* ═══════════════════════════════════════════════════════════════════════════
   CLASSE EventEmitter

   Pub/sub simple et léger. Chaque instance VOH a son propre EventEmitter.
   Aucune dépendance externe, aucune variable globale.
   ═══════════════════════════════════════════════════════════════════════════ */
class EventEmitter {

    constructor() {

        /**
         * Map des abonnements: clé = nom d'événement, valeur = Set de listeners.
         * Chaque listener est un objet { callback, once }.
         * @type {Map<string, Set<{callback: Function, once: boolean}>>}
         */
        this._listeners = new Map();
    }


    /* ══════════════════════════════════════════════════════════════
       ABONNEMENT
       ══════════════════════════════════════════════════════════════ */

    /**
     * Abonne un callback à un événement.
     * Le callback sera appelé à chaque émission de cet événement.
     *
     * @param {string} eventName — Nom de l'événement (ex: 'zone:created').
     * @param {Function} callback — Fonction appelée avec (data) à chaque émission.
     * @returns {EventEmitter} this (pour le chaînage).
     */
    on(eventName, callback) {

        if (typeof eventName !== 'string' || eventName.length === 0) {
            console.warn('[VOH EventEmitter] Le nom d\'événement doit être une chaîne non vide.');
            return this;
        }
        if (typeof callback !== 'function') {
            console.warn('[VOH EventEmitter] Le callback doit être une fonction.');
            return this;
        }

        /* ── Créer le Set si c'est le premier listener pour cet événement ── */
        if (!this._listeners.has(eventName)) {
            this._listeners.set(eventName, new Set());
        }

        /* ── Ajouter le listener ── */
        this._listeners.get(eventName).add({ callback: callback, once: false });

        return this;
    }


    /**
     * Abonne un callback qui ne sera appelé qu'une seule fois.
     * Après la première émission, le callback est automatiquement désabonné.
     *
     * @param {string} eventName — Nom de l'événement.
     * @param {Function} callback — Fonction appelée une seule fois avec (data).
     * @returns {EventEmitter} this (pour le chaînage).
     */
    once(eventName, callback) {

        if (typeof eventName !== 'string' || eventName.length === 0) {
            console.warn('[VOH EventEmitter] Le nom d\'événement doit être une chaîne non vide.');
            return this;
        }
        if (typeof callback !== 'function') {
            console.warn('[VOH EventEmitter] Le callback doit être une fonction.');
            return this;
        }

        /* ── Créer le Set si nécessaire ── */
        if (!this._listeners.has(eventName)) {
            this._listeners.set(eventName, new Set());
        }

        /* ── Ajouter le listener marqué "once" ── */
        this._listeners.get(eventName).add({ callback: callback, once: true });

        return this;
    }


    /* ══════════════════════════════════════════════════════════════
       DÉSABONNEMENT
       ══════════════════════════════════════════════════════════════ */

    /**
     * Désabonne un callback d'un événement.
     * Si le même callback a été abonné plusieurs fois, seule la première
     * occurrence trouvée est retirée.
     *
     * @param {string} eventName — Nom de l'événement.
     * @param {Function} callback — La fonction à retirer.
     * @returns {EventEmitter} this (pour le chaînage).
     */
    off(eventName, callback) {

        if (!this._listeners.has(eventName)) {
            return this;
        }

        const listenersSet = this._listeners.get(eventName);

        /* ── Chercher le listener par référence de callback ── */
        for (const listener of listenersSet) {
            if (listener.callback === callback) {
                listenersSet.delete(listener);
                break;
            }
        }

        /* ── Nettoyer le Set s'il est vide ── */
        if (listenersSet.size === 0) {
            this._listeners.delete(eventName);
        }

        return this;
    }


    /**
     * Retire tous les listeners d'un événement donné,
     * ou de TOUS les événements si aucun nom n'est fourni.
     *
     * @param {string} [eventName] — Nom de l'événement. Si omis, tout est vidé.
     * @returns {EventEmitter} this (pour le chaînage).
     */
    removeAllListeners(eventName) {

        if (eventName !== undefined) {
            /* ── Retirer les listeners d'un événement spécifique ── */
            this._listeners.delete(eventName);
        } else {
            /* ── Tout vider ── */
            this._listeners.clear();
        }

        return this;
    }


    /* ══════════════════════════════════════════════════════════════
       ÉMISSION
       ══════════════════════════════════════════════════════════════ */

    /**
     * Émet un événement. Tous les listeners abonnés sont appelés
     * de manière synchrone dans l'ordre d'abonnement.
     *
     * @param {string} eventName — Nom de l'événement (ex: 'zone:created').
     * @param {*} [data] — Données passées au callback. Typiquement un objet.
     * @returns {boolean} true si au moins un listener a été appelé.
     */
    emit(eventName, data) {

        if (!this._listeners.has(eventName)) {
            return false;
        }

        const listenersSet = this._listeners.get(eventName);
        let hasCalledAtLeastOne = false;

        /* ── Itérer sur une copie pour permettre la suppression pendant l'itération ── */
        const listenersArray = Array.from(listenersSet);

        for (const listener of listenersArray) {

            /* ── Appeler le callback ── */
            try {
                listener.callback(data);
                hasCalledAtLeastOne = true;
            } catch (error) {
                console.error(
                    `[VOH EventEmitter] Erreur dans le listener de "${eventName}":`,
                    error
                );
            }

            /* ── Retirer le listener si c'est un "once" ── */
            if (listener.once) {
                listenersSet.delete(listener);
            }
        }

        /* ── Nettoyer le Set s'il est vide après suppression des "once" ── */
        if (listenersSet.size === 0) {
            this._listeners.delete(eventName);
        }

        return hasCalledAtLeastOne;
    }


    /* ══════════════════════════════════════════════════════════════
       UTILITAIRES
       ══════════════════════════════════════════════════════════════ */

    /**
     * Retourne le nombre de listeners abonnés à un événement.
     * Si aucun nom n'est fourni, retourne le nombre total de listeners.
     *
     * @param {string} [eventName] — Nom de l'événement.
     * @returns {number} Nombre de listeners.
     */
    getListenerCount(eventName) {

        if (eventName !== undefined) {
            const listenersSet = this._listeners.get(eventName);
            return listenersSet ? listenersSet.size : 0;
        }

        /* ── Compter tous les listeners de tous les événements ── */
        let total = 0;
        for (const listenersSet of this._listeners.values()) {
            total += listenersSet.size;
        }
        return total;
    }


    /**
     * Retourne la liste de tous les noms d'événements
     * qui ont au moins un listener abonné.
     *
     * @returns {string[]} Liste des noms d'événements.
     */
    getEventNames() {
        return Array.from(this._listeners.keys());
    }


    /**
     * Détruit l'EventEmitter en retirant tous les listeners.
     * Après cet appel, l'EventEmitter est vide mais réutilisable.
     */
    destroy() {
        this._listeners.clear();
    }
}


/* ═══════════════════════════════════════════════════════════════════════════
   EXPOSITION GLOBALE
   ═══════════════════════════════════════════════════════════════════════════ */
window.EventEmitter = EventEmitter;
