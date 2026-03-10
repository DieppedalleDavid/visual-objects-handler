/* ═══════════════════════════════════════════════════════════════
   DOC-NAV.JS — Navigation inter-pages dans la documentation VOH
   ═══════════════════════════════════════════════════════════════
   Ce script est inclus dans chaque page de contenu chargée dans l'iframe.
   Il résout le problème cross-origin en mode file:// en utilisant postMessage
   pour communiquer avec la page parent (index.html).

   Trois responsabilités:
   1. Notifier le parent que cette page a été chargée (sync sidebar)
   2. Intercepter les clics sur les liens <a href> internes
   3. Intercepter les clics sur les cartes d'accueil [data-page]
   ═══════════════════════════════════════════════════════════════ */
(function() {
    'use strict';

    /* ── Calculer le chemin relatif de cette page par rapport à Aide/Fr/ ── */
    var path = location.pathname;
    var marker = '/Aide/Fr/';
    var idx = path.indexOf(marker);
    var relativePage = idx >= 0
        ? path.substring(idx + marker.length)
        : path.split('/').pop();

    /* ── Notifier le parent que cette page a été chargée ──
       Le parent utilisera cette information pour synchroniser la sidebar. */
    try {
        parent.postMessage({ type: 'voh-doc-sync', page: relativePage }, '*');
    } catch(e) { /* Ignorer si parent inaccessible. */ }

    /* ── Résoudre un chemin relatif par rapport au dossier de la page courante ──
       Ex: page = 'editeur/raccourcis.html', href = 'fonctionnalites.html'
       → dir = 'editeur/', résultat = 'editeur/fonctionnalites.html'
       Gère aussi les segments '..' pour remonter d'un niveau. */
    function _resolve(href) {
        var dir = relativePage.replace(/[^/]*$/, '');
        var parts = (dir + href).split('/');
        var result = [];
        for (var i = 0; i < parts.length; i++) {
            if (parts[i] === '..') { result.pop(); }
            else if (parts[i] !== '.' && parts[i] !== '') { result.push(parts[i]); }
        }
        return result.join('/');
    }

    /* ── Demander au parent de naviguer vers une page ──
       Essaie d'abord l'appel direct (même origine), puis postMessage (cross-origin). */
    function _navigateTo(page) {
        try {
            if (parent && parent._navigateToPage) {
                parent._navigateToPage(page);
                return;
            }
        } catch(e) { /* Cross-origin, fallback ci-dessous. */ }
        try {
            parent.postMessage({ type: 'voh-doc-nav', page: page }, '*');
        } catch(e) { /* Dernier recours impossible. */ }
    }

    /* ── Intercepter les clics sur les cartes d'accueil [data-page] ──
       Les cartes de la page d'accueil utilisent data-page="chemin/page.html". */
    var cards = document.querySelectorAll('[data-page]');
    for (var c = 0; c < cards.length; c++) {
        (function(card) {
            card.addEventListener('click', function() {
                _navigateTo(card.getAttribute('data-page'));
            });
        })(cards[c]);
    }

    /* ── Intercepter les clics sur les liens <a href> internes ──
       Empêche la navigation directe dans l'iframe et délègue au parent. */
    document.addEventListener('click', function(event) {
        var el = event.target;
        /* Remonter pour trouver le <a> le plus proche. */
        while (el && el.tagName !== 'A') { el = el.parentElement; }
        if (!el) return;

        var href = el.getAttribute('href');
        if (!href) return;
        /* Ignorer les liens externes, ancres, mailto, javascript. */
        if (href.charAt(0) === '#') return;
        if (href.indexOf('http') === 0) return;
        if (href.indexOf('mailto') === 0) return;
        if (href.indexOf('javascript') === 0) return;

        event.preventDefault();
        _navigateTo(_resolve(href));
    });
})();
