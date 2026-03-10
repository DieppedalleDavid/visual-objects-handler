/* ═══════════════════════════════════════════════════════════════════════════
   CORE-SPATIALGRID.JS — Grille spatiale multi-niveaux pour le hit-test

   Accélère la recherche d'objets sous un point (souris) de O(n) à O(1).
   Avec 20 000+ objets par page, un parcours linéaire à chaque mousemove
   (60 FPS) est impossible. La grille spatiale réduit la recherche aux
   seuls objets dans la cellule sous le curseur (typiquement 1-20 objets).

   ══════════════════════════════════════════════════════════════════════════
   ARCHITECTURE : 3 niveaux de grille selon la taille de l'objet

   Chaque objet est rangé dans UN seul niveau, selon sa plus grande
   dimension (max(largeur, hauteur)):

   - Niveau 0 (fine)   : cellules 64px  → objets de 5px à 128px
   - Niveau 1 (moyenne) : cellules 256px → objets de 129px à 512px
   - Niveau 2 (large)  : cellules 1024px → objets de 513px et plus

   Un objet de 5px occupe 1-4 cellules dans la grille fine.
   Un objet de 2000px occupe 4-8 cellules dans la grille large.
   Sans multi-niveaux, ce même objet de 2000px occuperait 500+ cellules
   dans une grille fine unique → mémoire et performance désastreuses.

   ══════════════════════════════════════════════════════════════════════════
   PERFORMANCES

   - Insertion : O(1) — calcul des cellules + ajout dans les tableaux
   - Suppression : O(k) — k = nombre de cellules occupées (1 à 8 max)
   - Recherche ponctuelle : O(1) pour trouver les cellules + O(m) pour
     m objets dans ces cellules (typiquement < 20)
   - Mémoire : O(n) — une entrée par objet + références dans les cellules

   ══════════════════════════════════════════════════════════════════════════

   Licence: Open Source (licence à définir)
   Auteur: David Dieppedalle (ShadowStorm)
   ═══════════════════════════════════════════════════════════════════════════ */

'use strict';


/* ═══════════════════════════════════════════════════════════════════════════
   CONSTANTES — Tailles des cellules par niveau
   ═══════════════════════════════════════════════════════════════════════════ */

/** Taille des cellules du niveau 0 (fine) en pixels. */
const SPATIAL_GRID_CELL_SIZE_LEVEL_0 = 64;

/** Taille des cellules du niveau 1 (moyenne) en pixels. */
const SPATIAL_GRID_CELL_SIZE_LEVEL_1 = 256;

/** Taille des cellules du niveau 2 (large) en pixels. */
const SPATIAL_GRID_CELL_SIZE_LEVEL_2 = 1024;

/** Seuil : max(width, height) <= ce seuil → niveau 0. */
const SPATIAL_GRID_THRESHOLD_LEVEL_0 = 128;

/** Seuil : max(width, height) <= ce seuil → niveau 1, sinon niveau 2. */
const SPATIAL_GRID_THRESHOLD_LEVEL_1 = 512;

/** Tailles des cellules indexées par niveau (accès rapide par index). */
const SPATIAL_GRID_CELL_SIZES = [
    SPATIAL_GRID_CELL_SIZE_LEVEL_0,
    SPATIAL_GRID_CELL_SIZE_LEVEL_1,
    SPATIAL_GRID_CELL_SIZE_LEVEL_2
];

/** Nombre de niveaux de grille. */
const SPATIAL_GRID_LEVEL_COUNT = 3;


/* ═══════════════════════════════════════════════════════════════════════════
   CLASSE: SpatialGrid

   Grille spatiale multi-niveaux. Chaque niveau est un Map<clé, tableau>.
   La clé de cellule est un entier calculé à partir de (colonne, ligne)
   via un hash parfait : clé = colonne * 73856093 ^ ligne * 19349669.
   ═══════════════════════════════════════════════════════════════════════════ */
class SpatialGrid {

    constructor() {

        /**
         * Les 3 niveaux de grille.
         * Chaque niveau est un Map<cellKey, Array<objectId>>.
         * @type {Map<number, Array<number>>[]}
         */
        this._levels = [];
        for (let i = 0; i < SPATIAL_GRID_LEVEL_COUNT; i++) {
            this._levels.push(new Map());
        }

        /**
         * Métadonnées par objet : objectId → { level, cellKeys }.
         * Permet de savoir dans quel niveau et quelles cellules se trouve
         * chaque objet, pour la suppression/mise à jour rapide.
         * @type {Map<number, { level: number, cellKeys: number[] }>}
         */
        this._objectMetadata = new Map();
    }


    /* ══════════════════════════════════════════════════════════════
       CALCUL DU NIVEAU — Selon la taille de l'objet
       ══════════════════════════════════════════════════════════════ */

    /**
     * Détermine le niveau de grille pour un objet selon sa plus grande dimension.
     * @param {number} width — Largeur de l'objet.
     * @param {number} height — Hauteur de l'objet.
     * @returns {number} Le niveau (0, 1 ou 2).
     */
    _getLevel(width, height) {
        const maxDimension = width > height ? width : height;
        if (maxDimension <= SPATIAL_GRID_THRESHOLD_LEVEL_0) return 0;
        if (maxDimension <= SPATIAL_GRID_THRESHOLD_LEVEL_1) return 1;
        return 2;
    }


    /* ══════════════════════════════════════════════════════════════
       CALCUL DES CLÉS DE CELLULES — Hash spatial

       Un objet rectangulaire peut chevaucher plusieurs cellules.
       On calcule toutes les cellules que le rectangle recouvre
       et on génère une clé unique par cellule.
       ══════════════════════════════════════════════════════════════ */

    /**
     * Calcule la clé unique d'une cellule à partir de sa colonne et sa ligne.
     * Utilise un hash pour éviter les collisions avec des coordonnées négatives.
     * @param {number} column — Colonne de la cellule.
     * @param {number} row — Ligne de la cellule.
     * @returns {number} Clé unique de la cellule.
     */
    _cellKey(column, row) {
        /* Hash parfait pour des coordonnées 2D entières.                        */
        /* Les constantes sont des nombres premiers choisis pour minimiser        */
        /* les collisions dans les grilles typiques (pas de modulo nécessaire).   */
        return ((column * 73856093) ^ (row * 19349669)) | 0;
    }

    /**
     * Calcule toutes les clés de cellules qu'un rectangle recouvre dans un niveau donné.
     * @param {number} x — Position X du rectangle.
     * @param {number} y — Position Y du rectangle.
     * @param {number} width — Largeur du rectangle.
     * @param {number} height — Hauteur du rectangle.
     * @param {number} level — Le niveau de grille (0, 1 ou 2).
     * @returns {number[]} Les clés de cellules recouvertes.
     */
    _getCellKeys(x, y, width, height, level) {

        const cellSize = SPATIAL_GRID_CELL_SIZES[level];

        /* Bornes en colonnes et lignes */
        const columnMin = Math.floor(x / cellSize) | 0;
        const columnMax = Math.floor((x + width - 1) / cellSize) | 0;
        const rowMin    = Math.floor(y / cellSize) | 0;
        const rowMax    = Math.floor((y + height - 1) / cellSize) | 0;

        const keys = [];
        for (let column = columnMin; column <= columnMax; column++) {
            for (let row = rowMin; row <= rowMax; row++) {
                keys.push(this._cellKey(column, row));
            }
        }
        return keys;
    }


    /* ══════════════════════════════════════════════════════════════
       INSERTION
       ══════════════════════════════════════════════════════════════ */

    /**
     * Insère un objet dans la grille.
     * @param {number} objectId — L'ID de l'objet.
     * @param {number} x — Position X de l'objet.
     * @param {number} y — Position Y de l'objet.
     * @param {number} width — Largeur de l'objet.
     * @param {number} height — Hauteur de l'objet.
     */
    insert(objectId, x, y, width, height) {

        /* ── Déterminer le niveau ── */
        const level = this._getLevel(width, height);

        /* ── Calculer les cellules recouvertes ── */
        const cellKeys = this._getCellKeys(x, y, width, height, level);

        /* ── Insérer dans chaque cellule du niveau ── */
        const grid = this._levels[level];
        for (let i = 0; i < cellKeys.length; i++) {
            const key = cellKeys[i];
            let cell = grid.get(key);
            if (!cell) {
                cell = [];
                grid.set(key, cell);
            }
            cell.push(objectId);
        }

        /* ── Stocker les métadonnées pour la suppression/mise à jour ── */
        this._objectMetadata.set(objectId, { level: level, cellKeys: cellKeys });
    }


    /* ══════════════════════════════════════════════════════════════
       SUPPRESSION
       ══════════════════════════════════════════════════════════════ */

    /**
     * Retire un objet de la grille.
     * @param {number} objectId — L'ID de l'objet.
     */
    remove(objectId) {

        const metadata = this._objectMetadata.get(objectId);
        if (!metadata) return;

        const grid = this._levels[metadata.level];
        const cellKeys = metadata.cellKeys;

        /* ── Retirer de chaque cellule ── */
        for (let i = 0; i < cellKeys.length; i++) {
            const cell = grid.get(cellKeys[i]);
            if (!cell) continue;

            const index = cell.indexOf(objectId);
            if (index !== -1) {
                /* Swap-and-pop : O(1) au lieu de splice O(n) */
                cell[index] = cell[cell.length - 1];
                cell.pop();

                /* Supprimer la cellule vide pour libérer la mémoire */
                if (cell.length === 0) {
                    grid.delete(cellKeys[i]);
                }
            }
        }

        /* ── Retirer les métadonnées ── */
        this._objectMetadata.delete(objectId);
    }


    /* ══════════════════════════════════════════════════════════════
       MISE À JOUR — Retrait + Réinsertion
       ══════════════════════════════════════════════════════════════ */

    /**
     * Met à jour la position/taille d'un objet dans la grille.
     * Si le niveau ou les cellules ont changé, l'objet est déplacé.
     * Si rien n'a changé, aucune opération n'est effectuée.
     * @param {number} objectId — L'ID de l'objet.
     * @param {number} x — Nouvelle position X.
     * @param {number} y — Nouvelle position Y.
     * @param {number} width — Nouvelle largeur.
     * @param {number} height — Nouvelle hauteur.
     */
    update(objectId, x, y, width, height) {

        const oldMetadata = this._objectMetadata.get(objectId);

        /* ── Si l'objet n'est pas dans la grille, l'insérer ── */
        if (!oldMetadata) {
            this.insert(objectId, x, y, width, height);
            return;
        }

        /* ── Calculer le nouveau niveau et les nouvelles cellules ── */
        const newLevel = this._getLevel(width, height);
        const newCellKeys = this._getCellKeys(x, y, width, height, newLevel);

        /* ── Vérifier si quelque chose a changé ── */
        if (newLevel === oldMetadata.level && this._cellKeysEqual(newCellKeys, oldMetadata.cellKeys)) {
            return; /* Rien n'a bougé — pas d'opération */
        }

        /* ── Retirer des anciennes cellules ── */
        this.remove(objectId);

        /* ── Réinsérer dans les nouvelles cellules ── */
        this.insert(objectId, x, y, width, height);
    }

    /**
     * Compare deux tableaux de clés de cellules (non triés).
     * @param {number[]} keysA — Premier tableau.
     * @param {number[]} keysB — Deuxième tableau.
     * @returns {boolean} true si identiques (même clés, même longueur).
     */
    _cellKeysEqual(keysA, keysB) {
        if (keysA.length !== keysB.length) return false;
        /* Pour 1-8 clés, une comparaison brute est plus rapide qu'un Set */
        for (let i = 0; i < keysA.length; i++) {
            if (keysA[i] !== keysB[i]) return false;
        }
        return true;
    }


    /* ══════════════════════════════════════════════════════════════
       RECHERCHE — Objets sous un point
       ══════════════════════════════════════════════════════════════ */

    /**
     * Retourne tous les objectIds dont les cellules contiennent le point (x, y).
     * Interroge les 3 niveaux de grille et fusionne les résultats.
     *
     * ATTENTION : ce sont des CANDIDATS. Les cellules sont des approximations
     * rectangulaires — il faut ensuite un test précis (point dans le rectangle
     * de l'objet) pour confirmer le hit. Ce test précis est fait par
     * ObjectInteractionManager, pas ici.
     *
     * @param {number} x — Position X du point.
     * @param {number} y — Position Y du point.
     * @returns {number[]} Les IDs des objets candidats (peut contenir des doublons).
     */
    queryCandidates(x, y) {

        const candidates = [];

        for (let level = 0; level < SPATIAL_GRID_LEVEL_COUNT; level++) {

            const cellSize = SPATIAL_GRID_CELL_SIZES[level];
            const column   = Math.floor(x / cellSize) | 0;
            const row      = Math.floor(y / cellSize) | 0;
            const key      = this._cellKey(column, row);

            const cell = this._levels[level].get(key);
            if (cell) {
                for (let i = 0; i < cell.length; i++) {
                    candidates.push(cell[i]);
                }
            }
        }

        return candidates;
    }


    /* ══════════════════════════════════════════════════════════════
       RECONSTRUCTION — Vide et reconstruit toute la grille
       ══════════════════════════════════════════════════════════════ */

    /**
     * Vide entièrement la grille (tous les niveaux).
     * Appelé lors d'un changement de page active.
     */
    clear() {
        for (let i = 0; i < SPATIAL_GRID_LEVEL_COUNT; i++) {
            this._levels[i].clear();
        }
        this._objectMetadata.clear();
    }

    /**
     * Reconstruit la grille à partir d'un itérable d'objets.
     * Chaque objet doit avoir : { id, x, y, width, height }.
     * @param {Iterable<Object>} objects — Les objets à insérer.
     */
    rebuild(objects) {
        this.clear();
        for (const objectData of objects) {
            this.insert(objectData.id, objectData.x, objectData.y, objectData.width, objectData.height);
        }
    }


    /* ══════════════════════════════════════════════════════════════
       STATISTIQUES (pour le diagnostic)
       ══════════════════════════════════════════════════════════════ */

    /**
     * Retourne des statistiques sur l'état actuel de la grille.
     * @returns {Object} { objectCount, cellCounts: [n0, n1, n2], totalCells }
     */
    getStatistics() {
        const cellCounts = [];
        let totalCells = 0;
        for (let i = 0; i < SPATIAL_GRID_LEVEL_COUNT; i++) {
            const count = this._levels[i].size;
            cellCounts.push(count);
            totalCells += count;
        }
        return {
            objectCount: this._objectMetadata.size,
            cellCounts:  cellCounts,
            totalCells:  totalCells
        };
    }


    /* ══════════════════════════════════════════════════════════════
       DESTRUCTION
       ══════════════════════════════════════════════════════════════ */

    /**
     * Libère toutes les ressources.
     */
    destroy() {
        this.clear();
        this._levels = null;
        this._objectMetadata = null;
    }
}


/* ═══════════════════════════════════════════════════════════════════════════
   EXPOSITION GLOBALE
   ═══════════════════════════════════════════════════════════════════════════ */
window.SpatialGrid = SpatialGrid;
