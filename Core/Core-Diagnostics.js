/* ═══════════════════════════════════════════════════════════════════════════
   CORE-DIAGNOSTICS.JS — Système de diagnostic et journal pour VOH v5

   Capture automatiquement les erreurs JavaScript, les avertissements,
   les appels API et les performances. Permet de générer un rapport
   complet pour le débogage.

   Chargé EN PREMIER avant tous les autres scripts Core.
   Commence à capturer les erreurs dès le chargement de la page.

   Usage:
     const rapport = voh.diagnostics.generateReport();
     voh.diagnostics.downloadReport();   // télécharge un fichier .txt

   Licence: Open Source (licence à définir)
   Auteur: David Dieppedalle (ShadowStorm)
   ═══════════════════════════════════════════════════════════════════════════ */

'use strict';


/* ═══════════════════════════════════════════════════════════════════════════
   CONSTANTES
   ═══════════════════════════════════════════════════════════════════════════ */

/** Nombre maximum d'erreurs stockées dans le journal. */
const DIAGNOSTICS_MAX_ERRORS = 100;

/** Nombre maximum d'avertissements stockés dans le journal. */
const DIAGNOSTICS_MAX_WARNINGS = 100;

/** Nombre maximum d'appels API stockés dans le journal. */
const DIAGNOSTICS_MAX_API_CALLS = 200;

/** Nombre maximum d'événements stockés dans le journal. */
const DIAGNOSTICS_MAX_EVENTS = 200;


/* ═══════════════════════════════════════════════════════════════════════════
   CLASSE: DiagnosticsManager

   Capture et stocke toutes les informations de diagnostic.
   Une seule instance par instance VOH, créée dans le constructeur.
   ═══════════════════════════════════════════════════════════════════════════ */
class DiagnosticsManager {

    /**
     * @param {VisualObjectsHandler} vohInstance — Référence à l'instance VOH parente.
     */
    constructor(vohInstance) {

        /** Référence à l'instance VOH parente. */
        this._voh = vohInstance;

        /** Horodatage de la création du DiagnosticsManager. */
        this._diagnosticsCreatedAt = new Date().toISOString();

        /** Journal des erreurs JavaScript capturées. */
        this._diagnosticsErrors = [];

        /** Journal des avertissements console capturés. */
        this._diagnosticsWarnings = [];

        /** Journal des appels API (les N derniers). */
        this._diagnosticsApiCalls = [];

        /** Journal des événements émis (les N derniers). */
        this._diagnosticsEvents = [];

        /** Compteur total d'erreurs (même si le tableau est tronqué). */
        this._diagnosticsTotalErrorCount = 0;

        /** Compteur total d'avertissements. */
        this._diagnosticsTotalWarningCount = 0;

        /** Compteur total d'appels API. */
        this._diagnosticsTotalApiCallCount = 0;

        /** Compteur total d'événements. */
        this._diagnosticsTotalEventCount = 0;

        /** Référence aux handlers d'origine (pour la restauration). */
        this._diagnosticsOriginalConsoleWarn = null;
        this._diagnosticsOriginalConsoleError = null;
        this._diagnosticsOriginalOnError = null;
        this._diagnosticsOriginalOnUnhandledRejection = null;

        /* ── Installer les intercepteurs globaux ── */
        this._diagnosticsInstallGlobalInterceptors();

        /* ── Référence globale pour le remapping d'erreurs dans Runner.html ── */
        window._vohDiagnosticsManager = this;
    }


    /* ══════════════════════════════════════════════════════════════
       INSTALLATION DES INTERCEPTEURS

       Capture automatiquement les erreurs et avertissements
       dès la création du DiagnosticsManager.
       ══════════════════════════════════════════════════════════════ */

    /**
     * Installe les intercepteurs sur window.onerror, console.warn, etc.
     * Les originaux sont sauvegardés pour pouvoir les restaurer.
     */
    _diagnosticsInstallGlobalInterceptors() {

        const self = this;

        /* ── Intercepter window.onerror (erreurs JavaScript non capturées) ── */
        this._diagnosticsOriginalOnError = window.onerror;
        window.onerror = function(message, source, lineNumber, columnNumber, error) {
            self._diagnosticsLogError({
                type: 'uncaught',
                message: String(message),
                source: source || '',
                line: lineNumber || 0,
                column: columnNumber || 0,
                stack: error ? error.stack : ''
            });
            /* Appeler le handler original s'il existait */
            if (self._diagnosticsOriginalOnError) {
                return self._diagnosticsOriginalOnError.call(window, message, source, lineNumber, columnNumber, error);
            }
            return false;
        };

        /* ── Intercepter les Promises rejetées non capturées ── */
        this._diagnosticsOriginalOnUnhandledRejection = window.onunhandledrejection;
        window.onunhandledrejection = function(event) {
            const reason = event.reason;
            self._diagnosticsLogError({
                type: 'unhandledRejection',
                message: reason instanceof Error ? reason.message : String(reason),
                source: '',
                line: 0,
                column: 0,
                stack: reason instanceof Error ? reason.stack : ''
            });
            if (self._diagnosticsOriginalOnUnhandledRejection) {
                self._diagnosticsOriginalOnUnhandledRejection.call(window, event);
            }
        };

        /* ── Intercepter console.error ── */
        this._diagnosticsOriginalConsoleError = console.error;
        console.error = function(...args) {
            self._diagnosticsLogError({
                type: 'console.error',
                message: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '),
                source: '',
                line: 0,
                column: 0,
                stack: ''
            });
            /* Appeler l'original pour que l'erreur apparaisse dans la console */
            self._diagnosticsOriginalConsoleError.apply(console, args);
        };

        /* ── Intercepter console.warn ── */
        this._diagnosticsOriginalConsoleWarn = console.warn;
        console.warn = function(...args) {
            self._diagnosticsLogWarning(
                args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')
            );
            /* Appeler l'original */
            self._diagnosticsOriginalConsoleWarn.apply(console, args);
        };
    }


    /* ══════════════════════════════════════════════════════════════
       ENREGISTREMENT DES ENTRÉES
       ══════════════════════════════════════════════════════════════ */

    /**
     * Enregistre une erreur dans le journal.
     * @param {Object} errorData — { type, message, source, line, column, stack }
     */
    _diagnosticsLogError(errorData) {
        this._diagnosticsTotalErrorCount++;
        this._diagnosticsErrors.push({
            timestamp: new Date().toISOString(),
            type:    errorData.type,
            message: errorData.message,
            source:  errorData.source,
            line:    errorData.line,
            column:  errorData.column,
            stack:   errorData.stack
        });
        /* Tronquer si le tableau dépasse la limite */
        if (this._diagnosticsErrors.length > DIAGNOSTICS_MAX_ERRORS) {
            this._diagnosticsErrors.shift();
        }
    }

    /**
     * Enregistre un avertissement dans le journal.
     * @param {string} message — Le message d'avertissement.
     */
    _diagnosticsLogWarning(message) {
        this._diagnosticsTotalWarningCount++;
        this._diagnosticsWarnings.push({
            timestamp: new Date().toISOString(),
            message: message
        });
        if (this._diagnosticsWarnings.length > DIAGNOSTICS_MAX_WARNINGS) {
            this._diagnosticsWarnings.shift();
        }
    }

    /**
     * Corrige la dernière erreur enregistrée avec des informations remappées.
     * Appelé par Runner.html après le remapping des numéros de ligne.
     * Remplace les URLs blob illisibles par le nom du script et la vraie ligne.
     * @param {Object} patchData — Données corrigées.
     * @param {string} patchData.source — Nom du script (ex: 'Mon script' ou 'Main (projet)').
     * @param {number} patchData.line — Numéro de ligne local (remappé).
     * @param {string} [patchData.message] — Message corrigé (optionnel).
     */
    _diagnosticsPatchLastError(patchData) {
        if (this._diagnosticsErrors.length === 0) return;
        const lastError = this._diagnosticsErrors[this._diagnosticsErrors.length - 1];
        if (patchData.source !== undefined) lastError.source = patchData.source;
        if (patchData.line   !== undefined) lastError.line   = patchData.line;
        if (patchData.column !== undefined) lastError.column = patchData.column;
        if (patchData.message !== undefined) lastError.message = patchData.message;
        /* Nettoyer la stack trace des URLs blob et corriger les numéros de ligne */
        if (lastError.stack) {
            const sourceName = patchData.source || 'Script';
            lastError.stack = lastError.stack.replace(
                /blob:null\/[a-f0-9-]+:(\d+):(\d+)/g,
                function(match, lineStr, colStr) {
                    /* Décaler la ligne de -1 (offset du wrapper async) */
                    const correctedLine = Math.max(1, parseInt(lineStr, 10) - 1);
                    return sourceName + ':' + correctedLine + ':' + colStr;
                }
            );
        }
    }

    /**
     * Enregistre un appel API dans le journal.
     * Appelé par le wrapper API dans Core-API.js.
     * @param {string} methodPath — Chemin complet (ex: 'voh.zone.create').
     * @param {Array} args — Arguments de l'appel.
     * @param {*} result — Valeur de retour.
     * @param {number} durationMilliseconds — Durée d'exécution en ms.
     * @param {Error|null} error — Erreur si l'appel a échoué.
     */
    _diagnosticsLogApiCall(methodPath, args, result, durationMilliseconds, error) {
        this._diagnosticsTotalApiCallCount++;
        this._diagnosticsApiCalls.push({
            timestamp: new Date().toISOString(),
            method:   methodPath,
            args:     this._diagnosticsSerializeArguments(args),
            result:   error ? 'ERREUR' : this._diagnosticsSerializeResult(result),
            duration: durationMilliseconds,
            error:    error ? error.message : null
        });
        if (this._diagnosticsApiCalls.length > DIAGNOSTICS_MAX_API_CALLS) {
            this._diagnosticsApiCalls.shift();
        }
    }

    /**
     * Enregistre un événement émis dans le journal.
     * @param {string} eventName — Nom de l'événement (ex: 'zone:created').
     * @param {Object} eventData — Données de l'événement.
     */
    _diagnosticsLogEvent(eventName, eventData) {
        this._diagnosticsTotalEventCount++;
        this._diagnosticsEvents.push({
            timestamp: new Date().toISOString(),
            event:    eventName,
            data:     this._diagnosticsSerializeResult(eventData)
        });
        if (this._diagnosticsEvents.length > DIAGNOSTICS_MAX_EVENTS) {
            this._diagnosticsEvents.shift();
        }
    }


    /* ══════════════════════════════════════════════════════════════
       SÉRIALISATION (pour le rapport)
       ══════════════════════════════════════════════════════════════ */

    /**
     * Sérialise les arguments d'un appel API pour le journal.
     * Évite les références circulaires et les objets trop gros.
     * @param {Array} args — Arguments de l'appel.
     * @returns {Array} Arguments sérialisés.
     */
    _diagnosticsSerializeArguments(args) {
        try {
            return args.map(arg => {
                if (arg === null || arg === undefined) return arg;
                if (typeof arg === 'function') return '[Function]';
                if (typeof arg === 'object') {
                    /* Limiter la taille pour éviter les objets énormes */
                    const serialized = JSON.stringify(arg);
                    if (serialized.length > 500) return serialized.substring(0, 500) + '...';
                    return JSON.parse(serialized);
                }
                return arg;
            });
        } catch (error) {
            return ['[Erreur de sérialisation]'];
        }
    }

    /**
     * Sérialise un résultat de retour pour le journal.
     * @param {*} result — Valeur de retour.
     * @returns {*} Résultat sérialisé.
     */
    _diagnosticsSerializeResult(result) {
        try {
            if (result === null || result === undefined) return result;
            if (typeof result === 'function') return '[Function]';
            if (typeof result === 'object') {
                const serialized = JSON.stringify(result);
                if (serialized.length > 500) return serialized.substring(0, 500) + '...';
                return JSON.parse(serialized);
            }
            return result;
        } catch (error) {
            return '[Erreur de sérialisation]';
        }
    }


    /* ══════════════════════════════════════════════════════════════
       COLLECTE DES INFORMATIONS SYSTÈME
       ══════════════════════════════════════════════════════════════ */

    /**
     * Collecte les informations sur l'environnement d'exécution.
     * @returns {Object} Informations système.
     */
    _diagnosticsGetSystemInformation() {
        const navigatorInfo = {
            userAgent:   navigator.userAgent,
            language:    navigator.language,
            platform:    navigator.platform,
            cookiesEnabled: navigator.cookieEnabled,
            onLine:      navigator.onLine
        };

        /* ── Détection du navigateur ── */
        const userAgent = navigator.userAgent;
        let browserName = 'Inconnu';
        let browserVersion = '';
        if (userAgent.indexOf('Edg/') > -1) {
            browserName = 'Microsoft Edge';
            browserVersion = userAgent.match(/Edg\/([\d.]+)/)?.[1] || '';
        } else if (userAgent.indexOf('Chrome/') > -1) {
            browserName = 'Google Chrome';
            browserVersion = userAgent.match(/Chrome\/([\d.]+)/)?.[1] || '';
        } else if (userAgent.indexOf('Firefox/') > -1) {
            browserName = 'Mozilla Firefox';
            browserVersion = userAgent.match(/Firefox\/([\d.]+)/)?.[1] || '';
        } else if (userAgent.indexOf('Safari/') > -1) {
            browserName = 'Apple Safari';
            browserVersion = userAgent.match(/Version\/([\d.]+)/)?.[1] || '';
        }

        /* ── Détection de l'OS ── */
        let operatingSystem = 'Inconnu';
        if (userAgent.indexOf('Windows') > -1) operatingSystem = 'Windows';
        else if (userAgent.indexOf('Mac OS') > -1) operatingSystem = 'macOS';
        else if (userAgent.indexOf('Linux') > -1) operatingSystem = 'Linux';
        else if (userAgent.indexOf('Android') > -1) operatingSystem = 'Android';
        else if (userAgent.indexOf('iOS') > -1 || userAgent.indexOf('iPhone') > -1) operatingSystem = 'iOS';

        /* ── Informations écran ── */
        const screenInfo = {
            width:            screen.width,
            height:           screen.height,
            availableWidth:   screen.availWidth,
            availableHeight:  screen.availHeight,
            colorDepth:       screen.colorDepth,
            devicePixelRatio: window.devicePixelRatio || 1
        };

        /* ── Informations mémoire (si disponibles — Chrome uniquement) ── */
        let memoryInfo = null;
        if (performance.memory) {
            memoryInfo = {
                usedJSHeapSize:  Math.round(performance.memory.usedJSHeapSize / 1024 / 1024) + ' Mo',
                totalJSHeapSize: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024) + ' Mo',
                jsHeapSizeLimit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024) + ' Mo'
            };
        }

        /* ── Support WebGL ── */
        let webGLSupport = 'Non détecté';
        try {
            const testCanvas = document.createElement('canvas');
            const webGLContext = testCanvas.getContext('webgl2') || testCanvas.getContext('webgl');
            if (webGLContext) {
                const debugInfo = webGLContext.getExtension('WEBGL_debug_renderer_info');
                if (debugInfo) {
                    webGLSupport = webGLContext.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
                } else {
                    webGLSupport = 'Supporté (détails non disponibles)';
                }
                /* Libérer le contexte WebGL (ressource limitée par le navigateur) */
                const loseContext = webGLContext.getExtension('WEBGL_lose_context');
                if (loseContext) loseContext.loseContext();
            } else {
                webGLSupport = 'Non supporté';
            }
        } catch (error) {
            webGLSupport = 'Erreur de détection: ' + error.message;
        }

        return {
            browser:         browserName + ' ' + browserVersion,
            operatingSystem: operatingSystem,
            navigator:       navigatorInfo,
            screen:          screenInfo,
            memory:          memoryInfo,
            webGL:           webGLSupport
        };
    }


    /* ══════════════════════════════════════════════════════════════
       COLLECTE DE L'ÉTAT DU PROJET
       ══════════════════════════════════════════════════════════════ */

    /**
     * Collecte l'état actuel du projet VOH (zones, canvas, objets, etc.).
     * @returns {Object} État du projet.
     */
    _diagnosticsGetProjectState() {
        const voh = this._voh;

        /* Si l'instance n'est pas initialisée, pas d'état à collecter */
        if (!voh || !voh._isInitialized) {
            return { initialized: false };
        }

        const state = {
            initialized:  true,
            instanceId:   voh._instanceId,
            version:      voh._version
        };

        /* ── Zones ── */
        try {
            if (voh._zoneManager) {
                state.zones = {
                    count:    voh._zoneManager.getZoneCount(),
                    activeId: voh._zoneManager.getActiveZoneId(),
                    list:     voh._zoneManager.getZoneList()
                };
            }
        } catch (error) {
            state.zones = { error: error.message };
        }

        /* ── Canvas ── */
        try {
            if (voh._canvasManager) {
                state.canvas = {
                    count:    voh._canvasManager._canvases.size,
                    activeId: voh._canvasManager.getActiveCanvasId(),
                    list:     Array.from(voh._canvasManager._canvases.keys())
                };
            }
        } catch (error) {
            state.canvas = { error: error.message };
        }

        /* ── Objets ── */
        try {
            if (voh._objectManager) {
                state.objects = {
                    count: voh._objectManager._objects.size,
                    list:  Array.from(voh._objectManager._objects.keys())
                };
            }
        } catch (error) {
            state.objects = { error: error.message };
        }

        return state;
    }


    /* ══════════════════════════════════════════════════════════════
       GÉNÉRATION DU RAPPORT
       ══════════════════════════════════════════════════════════════ */

    /**
     * Génère un rapport de diagnostic complet.
     * @returns {Object} Le rapport complet sous forme d'objet JSON.
     */
    generateReport() {
        const now = new Date();

        return {
            /* ── En-tête ── */
            title:       'Rapport de diagnostic — Visual Objects Handler',
            generatedAt: now.toISOString(),
            generatedAtLocal: now.toLocaleString('fr-FR'),
            diagnosticsStartedAt: this._diagnosticsCreatedAt,
            uptimeSeconds: Math.round((now - new Date(this._diagnosticsCreatedAt)) / 1000),

            /* ── Système ── */
            system: this._diagnosticsGetSystemInformation(),

            /* ── État du projet ── */
            project: this._diagnosticsGetProjectState(),

            /* ── Statistiques ── */
            statistics: {
                totalErrors:   this._diagnosticsTotalErrorCount,
                totalWarnings: this._diagnosticsTotalWarningCount,
                totalApiCalls: this._diagnosticsTotalApiCallCount,
                totalEvents:   this._diagnosticsTotalEventCount
            },

            /* ── Journaux (les N derniers de chaque) ── */
            errors:   this._diagnosticsErrors,
            warnings: this._diagnosticsWarnings,
            apiCalls: this._diagnosticsApiCalls,
            events:   this._diagnosticsEvents
        };
    }

    /**
     * Génère le rapport et le formate en texte lisible.
     * @returns {string} Le rapport formaté en texte.
     */
    generateReportAsText() {
        const report = this.generateReport();
        const lines = [];

        /* ── En-tête ── */
        lines.push('╔══════════════════════════════════════════════════════════════════╗');
        lines.push('║   RAPPORT DE DIAGNOSTIC — Visual Objects Handler                ║');
        lines.push('╚══════════════════════════════════════════════════════════════════╝');
        lines.push('');
        lines.push('Généré le: ' + report.generatedAtLocal);
        lines.push('Diagnostic démarré: ' + new Date(report.diagnosticsStartedAt).toLocaleString('fr-FR'));
        lines.push('Durée de la session: ' + report.uptimeSeconds + ' secondes');
        lines.push('');

        /* ── Système ── */
        lines.push('════════════════════════════════════════════════');
        lines.push('  SYSTÈME');
        lines.push('════════════════════════════════════════════════');
        lines.push('Navigateur: ' + report.system.browser);
        lines.push('OS: ' + report.system.operatingSystem);
        lines.push('Écran: ' + report.system.screen.width + 'x' + report.system.screen.height + ' (ratio: ' + report.system.screen.devicePixelRatio + ')');
        lines.push('WebGL: ' + report.system.webGL);
        if (report.system.memory) {
            lines.push('Mémoire JS: ' + report.system.memory.usedJSHeapSize + ' / ' + report.system.memory.totalJSHeapSize);
        }
        lines.push('');

        /* ── État du projet ── */
        lines.push('════════════════════════════════════════════════');
        lines.push('  ÉTAT DU PROJET');
        lines.push('════════════════════════════════════════════════');
        if (report.project.initialized) {
            lines.push('Version Core: ' + report.project.version);
            lines.push('Instance: ' + report.project.instanceId);
            if (report.project.zones) {
                lines.push('Zones: ' + report.project.zones.count + ' (active: ' + report.project.zones.activeId + ')');
            }
            if (report.project.canvas) {
                lines.push('Canvas: ' + report.project.canvas.count + ' (actif: ' + report.project.canvas.activeId + ')');
            }
            if (report.project.objects) {
                lines.push('Objets: ' + report.project.objects.count);
            }
        } else {
            lines.push('Instance non initialisée.');
        }
        lines.push('');

        /* ── Statistiques ── */
        lines.push('════════════════════════════════════════════════');
        lines.push('  STATISTIQUES');
        lines.push('════════════════════════════════════════════════');
        lines.push('Erreurs totales: ' + report.statistics.totalErrors);
        lines.push('Avertissements totaux: ' + report.statistics.totalWarnings);
        lines.push('Appels API totaux: ' + report.statistics.totalApiCalls);
        lines.push('Événements totaux: ' + report.statistics.totalEvents);
        lines.push('');

        /* ── Erreurs ── */
        if (report.errors.length > 0) {
            lines.push('════════════════════════════════════════════════');
            lines.push('  ERREURS (' + report.errors.length + ' dernières sur ' + report.statistics.totalErrors + ')');
            lines.push('════════════════════════════════════════════════');
            for (const error of report.errors) {
                lines.push('[' + new Date(error.timestamp).toLocaleTimeString('fr-FR') + '] ' + error.type);
                lines.push('  Message: ' + error.message);
                if (error.source) lines.push('  Source: ' + error.source + ':' + error.line + ':' + error.column);
                if (error.stack) lines.push('  Stack: ' + error.stack.split('\n').slice(0, 3).join(' → '));
                lines.push('');
            }
        }

        /* ── Avertissements ── */
        if (report.warnings.length > 0) {
            lines.push('════════════════════════════════════════════════');
            lines.push('  AVERTISSEMENTS (' + report.warnings.length + ' derniers sur ' + report.statistics.totalWarnings + ')');
            lines.push('════════════════════════════════════════════════');
            for (const warning of report.warnings) {
                lines.push('[' + new Date(warning.timestamp).toLocaleTimeString('fr-FR') + '] ' + warning.message);
            }
            lines.push('');
        }

        /* ── Appels API ── */
        if (report.apiCalls.length > 0) {
            lines.push('════════════════════════════════════════════════');
            lines.push('  APPELS API (' + report.apiCalls.length + ' derniers sur ' + report.statistics.totalApiCalls + ')');
            lines.push('════════════════════════════════════════════════');
            for (const call of report.apiCalls) {
                const argsString = JSON.stringify(call.args);
                const duration = call.duration > 0 ? ' (' + call.duration.toFixed(1) + 'ms)' : '';
                const errorFlag = call.error ? ' ⚠ ' + call.error : '';
                lines.push('[' + new Date(call.timestamp).toLocaleTimeString('fr-FR') + '] ' + call.method + '(' + argsString + ') → ' + JSON.stringify(call.result) + duration + errorFlag);
            }
            lines.push('');
        }

        /* ── Événements ── */
        if (report.events.length > 0) {
            lines.push('════════════════════════════════════════════════');
            lines.push('  ÉVÉNEMENTS (' + report.events.length + ' derniers sur ' + report.statistics.totalEvents + ')');
            lines.push('════════════════════════════════════════════════');
            for (const event of report.events) {
                lines.push('[' + new Date(event.timestamp).toLocaleTimeString('fr-FR') + '] ' + event.event + ' ' + JSON.stringify(event.data));
            }
            lines.push('');
        }

        lines.push('════════════════════════════════════════════════');
        lines.push('  FIN DU RAPPORT');
        lines.push('════════════════════════════════════════════════');

        return lines.join('\n');
    }

    /**
     * Génère le rapport et propose le téléchargement en fichier .txt.
     */
    downloadReport() {
        const reportText = this.generateReportAsText();
        const now = new Date();
        const dateString = now.getFullYear() + '-'
            + String(now.getMonth() + 1).padStart(2, '0') + '-'
            + String(now.getDate()).padStart(2, '0') + '_'
            + String(now.getHours()).padStart(2, '0') + 'h'
            + String(now.getMinutes()).padStart(2, '0');
        const fileName = 'VOH-Diagnostic-' + dateString + '.txt';

        /* Créer un blob et déclencher le téléchargement */
        const blob = new Blob([reportText], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.click();
        URL.revokeObjectURL(url);

        console.log('[VOH Diagnostics] Rapport téléchargé: ' + fileName);
    }

    /**
     * Affiche le rapport de diagnostic dans une fenêtre flottante en lecture seule.
     * L'utilisateur peut copier le contenu via le bouton "Copier" ou Ctrl+A puis Ctrl+C.
     * Fermeture avec le bouton ✕, Échap, ou clic sur l'overlay.
     */
    showReport() {
        const reportText = this.generateReportAsText();

        /* ── Supprimer une fenêtre précédente si elle existe ── */
        const existingOverlay = document.getElementById('voh-diagnostics-overlay');
        if (existingOverlay) existingOverlay.remove();

        /* ── Créer l'overlay ── */
        const overlay = document.createElement('div');
        overlay.id = 'voh-diagnostics-overlay';
        overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:99999;display:flex;align-items:center;justify-content:center;font-family:"Segoe UI",Tahoma,Geneva,Verdana,sans-serif;';

        /* ── Créer la fenêtre ── */
        const panel = document.createElement('div');
        panel.style.cssText = 'background:#ffffff;border-radius:6px;box-shadow:0 8px 32px rgba(0,0,0,0.3);width:80%;max-width:900px;height:80%;display:flex;flex-direction:column;overflow:hidden;';

        /* ── Barre de titre ── */
        const titleBar = document.createElement('div');
        titleBar.style.cssText = 'display:flex;align-items:center;padding:8px 12px;background:#f0f0f0;border-bottom:1px solid #cccccc;flex-shrink:0;';

        const title = document.createElement('span');
        title.textContent = 'Rapport de diagnostic — Visual Objects Handler';
        title.style.cssText = 'font-size:12px;font-weight:600;color:#333333;flex:1;';

        const copyButton = document.createElement('button');
        copyButton.textContent = 'Copier';
        copyButton.style.cssText = 'padding:3px 12px;font-size:11px;color:#ffffff;background:#388e3c;border:1px solid #2e7d32;border-radius:3px;cursor:pointer;margin-right:8px;font-family:inherit;';
        copyButton.addEventListener('mouseover', function() { copyButton.style.background = '#2e7d32'; });
        copyButton.addEventListener('mouseout', function() { copyButton.style.background = '#388e3c'; });

        const downloadButton = document.createElement('button');
        downloadButton.textContent = 'Télécharger';
        downloadButton.style.cssText = 'padding:3px 12px;font-size:11px;color:#ffffff;background:#1565c0;border:1px solid #0d47a1;border-radius:3px;cursor:pointer;margin-right:8px;font-family:inherit;';
        downloadButton.addEventListener('mouseover', function() { downloadButton.style.background = '#0d47a1'; });
        downloadButton.addEventListener('mouseout', function() { downloadButton.style.background = '#1565c0'; });

        const closeButton = document.createElement('button');
        closeButton.textContent = '✕';
        closeButton.style.cssText = 'padding:3px 8px;font-size:14px;color:#666666;background:transparent;border:1px solid #cccccc;border-radius:3px;cursor:pointer;font-family:inherit;line-height:1;';
        closeButton.addEventListener('mouseover', function() { closeButton.style.background = '#e0e0e0'; });
        closeButton.addEventListener('mouseout', function() { closeButton.style.background = 'transparent'; });

        titleBar.appendChild(title);
        titleBar.appendChild(copyButton);
        titleBar.appendChild(downloadButton);
        titleBar.appendChild(closeButton);

        /* ── Zone de texte en lecture seule ── */
        const textarea = document.createElement('textarea');
        textarea.value = reportText;
        textarea.readOnly = true;
        textarea.style.cssText = 'flex:1;padding:12px;font-family:"Consolas","Courier New",monospace;font-size:12px;color:#333333;background:#fafafa;border:none;resize:none;outline:none;white-space:pre;overflow:auto;tab-size:4;';

        panel.appendChild(titleBar);
        panel.appendChild(textarea);
        overlay.appendChild(panel);
        document.body.appendChild(overlay);

        /* ── Actions des boutons ── */
        const self = this;

        copyButton.addEventListener('click', function() {
            textarea.select();
            navigator.clipboard.writeText(reportText).then(function() {
                copyButton.textContent = 'Copié !';
                setTimeout(function() { copyButton.textContent = 'Copier'; }, 2000);
            }).catch(function() {
                document.execCommand('copy');
                copyButton.textContent = 'Copié !';
                setTimeout(function() { copyButton.textContent = 'Copier'; }, 2000);
            });
        });

        downloadButton.addEventListener('click', function() {
            self.downloadReport();
        });

        /* ── Fonction de fermeture centralisée (nettoie le listener keydown) ── */
        function _closeReport() {
            overlay.remove();
            document.removeEventListener('keydown', onEscapeKeyDown);
        }

        closeButton.addEventListener('click', function() {
            _closeReport();
        });

        /* ── Fermer en cliquant sur l'overlay (pas sur la fenêtre) ── */
        overlay.addEventListener('click', function(event) {
            if (event.target === overlay) _closeReport();
        });

        /* ── Fermer avec Échap ── */
        function onEscapeKeyDown(event) {
            if (event.key === 'Escape') {
                _closeReport();
            }
        }
        document.addEventListener('keydown', onEscapeKeyDown);

        console.log('[VOH Diagnostics] Rapport affiché.');
    }

    /**
     * Copie le rapport dans le presse-papiers.
     * @returns {Promise<boolean>} true si copié, false si échec.
     */
    async copyReportToClipboard() {
        try {
            const reportText = this.generateReportAsText();
            await navigator.clipboard.writeText(reportText);
            console.log('[VOH Diagnostics] Rapport copié dans le presse-papiers.');
            return true;
        } catch (error) {
            console.error('[VOH Diagnostics] Impossible de copier dans le presse-papiers:', error.message);
            return false;
        }
    }


    /* ══════════════════════════════════════════════════════════════
       UTILITAIRES
       ══════════════════════════════════════════════════════════════ */

    /**
     * Vide tous les journaux de diagnostic.
     */
    clear() {
        this._diagnosticsErrors = [];
        this._diagnosticsWarnings = [];
        this._diagnosticsApiCalls = [];
        this._diagnosticsEvents = [];
        this._diagnosticsTotalErrorCount = 0;
        this._diagnosticsTotalWarningCount = 0;
        this._diagnosticsTotalApiCallCount = 0;
        this._diagnosticsTotalEventCount = 0;
        console.log('[VOH Diagnostics] Journaux vidés.');
    }

    /**
     * Retourne un résumé rapide (nombre d'erreurs, warnings, etc.).
     * @returns {Object} Résumé.
     */
    getSummary() {
        return {
            errors:   this._diagnosticsTotalErrorCount,
            warnings: this._diagnosticsTotalWarningCount,
            apiCalls: this._diagnosticsTotalApiCallCount,
            events:   this._diagnosticsTotalEventCount
        };
    }


    /* ══════════════════════════════════════════════════════════════
       DESTRUCTION
       ══════════════════════════════════════════════════════════════ */

    /**
     * Restaure les handlers d'origine et libère les ressources.
     */
    destroy() {
        /* Restaurer les intercepteurs globaux */
        if (this._diagnosticsOriginalOnError !== null) {
            window.onerror = this._diagnosticsOriginalOnError;
        }
        if (this._diagnosticsOriginalOnUnhandledRejection !== null) {
            window.onunhandledrejection = this._diagnosticsOriginalOnUnhandledRejection;
        }
        if (this._diagnosticsOriginalConsoleError !== null) {
            console.error = this._diagnosticsOriginalConsoleError;
        }
        if (this._diagnosticsOriginalConsoleWarn !== null) {
            console.warn = this._diagnosticsOriginalConsoleWarn;
        }

        /* Vider les journaux */
        this._diagnosticsErrors = [];
        this._diagnosticsWarnings = [];
        this._diagnosticsApiCalls = [];
        this._diagnosticsEvents = [];

        /* Retirer la référence globale */
        if (window._vohDiagnosticsManager === this) {
            window._vohDiagnosticsManager = null;
        }

        console.log('[VOH Diagnostics] Détruit.');
    }
}


/* ═══════════════════════════════════════════════════════════════════════════
   FONCTION HELPER: Wrapper API pour le journal des appels

   Utilisé par Core-API.js pour envelopper chaque méthode API.
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Enveloppe une méthode API pour loguer automatiquement l'appel dans le DiagnosticsManager.
 * @param {string} methodPath — Chemin complet (ex: 'voh.zone.create').
 * @param {Function} originalFunction — La fonction API originale.
 * @param {VisualObjectsHandler} vohInstance — L'instance VOH.
 * @returns {Function} La fonction enveloppée.
 */
function _diagnosticsWrapApiMethod(methodPath, originalFunction, vohInstance) {
    return function(...args) {
        const diagnosticsManager = vohInstance._diagnosticsManager;

        /* Si pas de DiagnosticsManager, exécuter sans wrapper */
        if (!diagnosticsManager) {
            return originalFunction.apply(this, args);
        }

        const startTime = performance.now();
        let result;
        let error = null;

        try {
            result = originalFunction.apply(this, args);
        } catch (caughtError) {
            error = caughtError;
            /* Loguer l'appel échoué */
            const duration = performance.now() - startTime;
            diagnosticsManager._diagnosticsLogApiCall(methodPath, args, null, duration, caughtError);
            /* Relancer l'erreur pour ne pas cacher le problème */
            throw caughtError;
        }

        /* Loguer l'appel réussi */
        const duration = performance.now() - startTime;
        diagnosticsManager._diagnosticsLogApiCall(methodPath, args, result, duration, null);

        return result;
    };
}


/* ═══════════════════════════════════════════════════════════════════════════
   EXPOSITION GLOBALE
   ═══════════════════════════════════════════════════════════════════════════ */
window.DiagnosticsManager = DiagnosticsManager;
window._diagnosticsWrapApiMethod = _diagnosticsWrapApiMethod;
