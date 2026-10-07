/**
 * Repli progressif de l'en-tête d'accueil.
 *
 * Le bandeau (AfriGo / Bonjour), le sélecteur de rayon et les pastilles de
 * catégories restent épinglés en haut pendant le défilement : ils ne
 * disparaissent pas, ils rétrécissent. Le rétrécissement suit le défilement
 * **en continu** — pas de bascule d'un coup au franchissement d'un seuil.
 */

import type { Animated } from 'react-native';

/** Valeur animée (ou interpolation) pilotant le repli : 0 = déplié, 1 = replié. */
export type CollapseProgress = Animated.AnimatedInterpolation<number> | Animated.Value;

/** Défilement (px) nécessaire pour replier complètement l'en-tête. */
export const HEADER_COLLAPSE_DISTANCE = 72;

/** Avancement du repli (0 → 1) pour un défilement vertical donné. */
export const headerCollapseProgress = (offsetY: number): number => {
  if (!Number.isFinite(offsetY) || offsetY <= 0) return 0;
  return Math.min(1, offsetY / HEADER_COLLAPSE_DISTANCE);
};

/**
 * Nouvelle valeur de repli à appliquer, ou `null` si elle ne change pas.
 *
 * Le repli anime des tailles (marges, police, boutons) : chaque mise à jour
 * refait la mise en page de l'en-tête. Arrondie au pixel de défilement, et
 * surtout ignorée une fois l'en-tête replié (ou déplié) : sans ce filtre, tout
 * le défilement de la liste recalculait l'en-tête à chaque image, ce qui
 * saccadait l'accueil sur Android.
 */
export const nextHeaderCollapse = (previous: number, offsetY: number): number | null => {
  const next = Math.round(headerCollapseProgress(offsetY) * HEADER_COLLAPSE_DISTANCE) / HEADER_COLLAPSE_DISTANCE;
  return next === previous ? null : next;
};
