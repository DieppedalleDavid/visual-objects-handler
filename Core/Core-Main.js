/* ═══════════════════════════════════════════════════════════════════════════
   CORE-MAIN.JS — Point d'entrée du moteur Visual Objects Handler v5

   Classe principale: VisualObjectsHandler

   Le Core est 100% autonome. Il fonctionne seul, sans éditeur,
   sans wrapper desktop, dans n'importe quel navigateur.

   Usage:
     const voh = new VisualObjectsHandler(document.getElementById('monDiv'));
     await voh.init();
     voh.zone.create({ name: 'Ma zone' });

   Licence: Open Source (licence à définir)
   Auteur: David Dieppedalle (ShadowStorm)
   ═══════════════════════════════════════════════════════════════════════════ */

'use strict';


/* ═══════════════════════════════════════════════════════════════════════════
   CONSTANTES
   ═══════════════════════════════════════════════════════════════════════════ */

/** Version du Core VOH. */
const VOH_CORE_VERSION = '2.26.10';


/* ═══════════════════════════════════════════════════════════════════════════
   CLASSE PRINCIPALE: VisualObjectsHandler

   Chaque instance est autonome: ses zones, ses canvas, ses objets,
   son historique, tout lui appartient. Aucune variable globale partagée.
   ═══════════════════════════════════════════════════════════════════════════ */
class VisualObjectsHandler {

    /**
     * Crée une nouvelle instance du moteur VOH.
     * Après la construction, il faut appeler await voh.init() pour
     * initialiser les modules internes et monter l'API.
     *
     * @param {HTMLElement} containerElement — Le div conteneur où tout sera créé.
     * @param {Object} [options] — Options d'initialisation (réservé pour usage futur).
     */
    constructor(containerElement, options = {}) {

        /* ── Vérification du conteneur ── */
        if (!containerElement || !(containerElement instanceof HTMLElement)) {
            throw new Error('[VOH] Le conteneur doit être un élément HTML valide.');
        }

        /* ── Référence au conteneur DOM ── */
        this._containerElement = containerElement;

        /* ── Options d'initialisation ── */
        this._options = options;

        /* ── Identifiant unique de l'instance ── */
        this._instanceId = 'voh_' + Date.now() + '_' + Math.floor(Math.random() * 10000);

        /* ── Marqueur CSS sur le conteneur pour identifier l'instance ── */
        containerElement.dataset.vohInstance = this._instanceId;

        /* ── État d'initialisation ── */
        this._isInitialized = false;

        /* ── Version du Core ── */
        this._version = VOH_CORE_VERSION;

        /* ── Gestionnaires (créés dans init()) ── */
        this._zoneManager   = null;
        this._canvasManager = null;
        this._objectManager = null;
        this._objectSelectionManager    = null;
        this._objectInteractionManager = null;

        /* ── Système d'événements (créé immédiatement, disponible avant init) ── */
        this._eventEmitter = new EventEmitter();

        /* ── Système de diagnostic (créé immédiatement, capture les erreurs dès le départ) ── */
        this._diagnosticsManager = new DiagnosticsManager(this);

        /* ── Garde API — empêche l'utilisation avant init() ── */
        /* Ces propriétés seront écrasées par _buildApi() dans init(). */
        const messageNonInitialise = '[VOH] Le moteur n\'est pas encore initialisé. Appelez await voh.init() d\'abord.';
        const gardeNonInitialise = new Proxy({}, {
            get(_, propriete) { throw new Error(messageNonInitialise); }
        });
        this.zone    = gardeNonInitialise;
        this.canvas  = gardeNonInitialise;
        this.objects = gardeNonInitialise;

        /* ── Log de création ── */
        console.log(`[VOH] Instance créée — ID: ${this._instanceId} — Version: ${this._version}`);
    }


    /* ══════════════════════════════════════════════════════════════
       INITIALISATION ASYNCHRONE

       Cette méthode DOIT être appelée après le constructeur et
       AVANT toute utilisation de l'API.
       ══════════════════════════════════════════════════════════════ */

    /**
     * Initialise les modules internes et monte l'API publique.
     * @returns {Promise<VisualObjectsHandler>} L'instance initialisée (pour le chaînage).
     */
    async init() {

        /* ── Protection contre la double initialisation ── */
        if (this._isInitialized) {
            console.warn('[VOH] L\'instance est déjà initialisée.');
            return this;
        }

        /* ── Appliquer un style de base au conteneur ── */
        const container = this._containerElement;
        if (!container.style.position || container.style.position === 'static') {
            container.style.position = 'relative';
        }
        /* overflow: auto seulement si l'utilisateur n'a pas défini autre chose.
           Le défaut CSS est 'visible' — on ne touche que ce cas. */
        const computedOverflow = getComputedStyle(container).overflow;
        if (computedOverflow === 'visible') {
            container.style.overflow = 'auto';
        }

        /* ══════════════════════════════════════════════════════════
           INITIALISATION DES MODULES
           Chaque module reçoit une référence à cette instance.
           ══════════════════════════════════════════════════════════ */

        /* ── Gestionnaire de zones ── */
        this._zoneManager = new ZoneManager(this);

        /* ── Gestionnaire de canvas ── */
        this._canvasManager = new CanvasManager(this);

        /* ── Gestionnaire d'objets ── */
        this._objectManager = new ObjectManager(this);

        /* ── Gestionnaire de sélection d'objets ── */
        this._objectSelectionManager = new ObjectSelectionManager(this);

        /* ── Gestionnaire d'interaction souris sur les objets ── */
        this._objectInteractionManager = new ObjectInteractionManager(this);

        /* ── Monter l'API publique (voh.zone, etc.) ── */
        _buildApi(this);

        /* ── Exposer l'API de diagnostic ── */
        this.diagnostics = {
            generateReport:        ()  => this._diagnosticsManager.generateReport(),
            generateReportAsText:  ()  => this._diagnosticsManager.generateReportAsText(),
            downloadReport:        ()  => this._diagnosticsManager.downloadReport(),
            showReport:            ()  => this._diagnosticsManager.showReport(),
            copyReportToClipboard: ()  => this._diagnosticsManager.copyReportToClipboard(),
            getSummary:            ()  => this._diagnosticsManager.getSummary(),
            clear:                 ()  => this._diagnosticsManager.clear()
        };

        /* ── Brancher le journal d'événements sur l'EventEmitter ── */
        const diagnosticsManager = this._diagnosticsManager;
        const originalEmit = this._eventEmitter.emit.bind(this._eventEmitter);
        this._eventEmitter.emit = function(eventName, data) {
            diagnosticsManager._diagnosticsLogEvent(eventName, data);
            return originalEmit(eventName, data);
        };

        /* ── Marquer comme initialisé ── */
        this._isInitialized = true;

        console.log(`[VOH] Moteur initialisé — Version: ${this._version}`);

        return this;
    }


    /* ══════════════════════════════════════════════════════════════
       ACCESSEURS INTERNES (utilisés par les modules)
       ══════════════════════════════════════════════════════════════ */

    /** Retourne le conteneur DOM principal. */
    getContainerElement() {
        return this._containerElement;
    }

    /** Retourne l'identifiant unique de cette instance. */
    getInstanceId() {
        return this._instanceId;
    }

    /** Retourne la version du Core. */
    getVersion() {
        return this._version;
    }

    /** Retourne true si l'instance est initialisée et prête. */
    isReady() {
        return this._isInitialized;
    }

    /** Retourne l'EventEmitter de cette instance. */
    getEventEmitter() {
        return this._eventEmitter;
    }


    /* ══════════════════════════════════════════════════════════════
       DESTRUCTION
       ══════════════════════════════════════════════════════════════ */

    /**
     * Détruit l'instance et libère toutes les ressources.
     * Après cet appel, l'instance n'est plus utilisable.
     */
    destroy() {

        /* ── Détruire le gestionnaire d'interaction (avant les objets et les canvas) ── */
        if (this._objectInteractionManager) {
            this._objectInteractionManager.destroy();
            this._objectInteractionManager = null;
        }

        /* ── Détruire le gestionnaire de sélection d'objets ── */
        if (this._objectSelectionManager) {
            this._objectSelectionManager.destroy();
            this._objectSelectionManager = null;
        }

        /* ── Détruire le gestionnaire d'objets (avant les canvas, car les objets vivent dans les canvas) ── */
        if (this._objectManager) {
            this._objectManager.destroy();
            this._objectManager = null;
        }

        /* ── Détruire le gestionnaire de canvas (avant les zones, car les canvas vivent dans les zones) ── */
        if (this._canvasManager) {
            this._canvasManager.destroy();
            this._canvasManager = null;
        }

        /* ── Détruire le gestionnaire de zones (et tout ce qu'elles contiennent) ── */
        if (this._zoneManager) {
            this._zoneManager.destroy();
            this._zoneManager = null;
        }

        /* ── Nettoyer le conteneur DOM ── */
        this._containerElement.innerHTML = '';
        delete this._containerElement.dataset.vohInstance;

        /* ── Détruire le système de diagnostic ── */
        if (this._diagnosticsManager) {
            this._diagnosticsManager.destroy();
            this._diagnosticsManager = null;
        }

        /* ── Détruire l'EventEmitter (retirer tous les listeners) ── */
        if (this._eventEmitter) {
            this._eventEmitter.destroy();
            this._eventEmitter = null;
        }

        /* ── Réinitialiser l'état ── */
        this._isInitialized = false;

        console.log(`[VOH] Instance détruite — ${this._instanceId}`);
    }
}


/* ═══════════════════════════════════════════════════════════════════════════
   EXPOSITION GLOBALE

   Nécessaire pour que les scripts utilisateur puissent accéder à la classe
   via new VisualObjectsHandler(...) même quand le code est exécuté dans
   un contexte new Function() (qui ne voit que window).
   ═══════════════════════════════════════════════════════════════════════════ */
window.VisualObjectsHandler = VisualObjectsHandler;
