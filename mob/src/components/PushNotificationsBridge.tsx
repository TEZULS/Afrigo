import { usePushNotifications } from '@/hooks/usePushNotifications';

/**
 * Composant sans rendu : monte les listeners push une seule fois, sous les
 * providers Auth + React Query (cf. `App.tsx`).
 */
export const PushNotificationsBridge = (): null => {
  usePushNotifications();
  return null;
};
