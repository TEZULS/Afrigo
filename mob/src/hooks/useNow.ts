import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

/**
 * Heure courante, rafraîchie toutes les `intervalMs` millisecondes et au retour
 * de l'app au premier plan (les minuteurs sont suspendus en arrière-plan).
 */
export const useNow = (intervalMs: number): Date => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') setNow(new Date());
    });
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, [intervalMs]);
  return now;
};
