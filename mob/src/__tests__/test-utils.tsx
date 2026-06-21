/* eslint-disable react-refresh/only-export-components */
import React from 'react';
import { render, RenderOptions } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '@/theme/ThemeProvider';

export const createTestQueryClient = (): QueryClient =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
      },
      mutations: { retry: false },
    },
  });

export const AllTheProviders: React.FC<{
  children: React.ReactNode;
  client?: QueryClient;
}> = ({ children, client }) => {
  const qc = client ?? createTestQueryClient();
  return (
    <SafeAreaProvider initialMetrics={{
      frame: { x: 0, y: 0, width: 360, height: 720 },
      insets: { top: 0, bottom: 0, left: 0, right: 0 },
    }}>
      <QueryClientProvider client={qc}>
        <ThemeProvider>{children}</ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
};

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  client?: QueryClient;
}

export const renderWithProviders = (
  ui: React.ReactElement,
  { client, ...options }: CustomRenderOptions = {},
) => render(ui, { wrapper: ({ children }) => <AllTheProviders client={client}>{children}</AllTheProviders>, ...options });

export * from '@testing-library/react-native';
