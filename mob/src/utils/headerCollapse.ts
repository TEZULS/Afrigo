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
