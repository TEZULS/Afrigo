import { QueryClient, focusManager, onlineManager } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import { AppState } from 'react-native';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30 * 1000,
      refetchOnReconnect: true,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

// Synchronise React Query avec NetInfo + AppState (équivalent
// refetchOnWindowFocus du web, mais adapté au cycle de vie mobile).
export const wireReactQueryToAppLifecycle = () => {
  onlineManager.setEventListener((setOnline) => {
    return NetInfo.addEventListener((state) => {
      setOnline(Boolean(state.isConnected && state.isInternetReachable !== false));
    });
  });

  focusManager.setEventListener((handleFocus) => {
    const sub = AppState.addEventListener('change', (status) => {
      if (status === 'active') handleFocus(true);
    });
    return () => sub.remove();
  });
};
