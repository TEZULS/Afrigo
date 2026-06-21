import { useQuery } from '@tanstack/react-query';
import { AppSettings } from '@/api/entities';

export interface AppSettingsRecord {
  id?: string;
  is_available?: boolean;
  maintenance_message?: string;
  geo_restriction_enabled?: boolean;
  allowed_regions?: string[];
  geo_restriction_message?: string;
  support_phone?: string;
  support_email?: string;
  return_time_limit_hours?: number;
  auto_notify_order_status?: boolean;
  auto_notify_return_status?: boolean;
  delivery_slots_enabled?: boolean;
  stripe_publishable_key?: string;
}

export const useAppSettings = () =>
  useQuery<AppSettingsRecord | null>({
    queryKey: ['app-settings'],
    queryFn: async () => {
      const list = (await AppSettings().list?.()) as AppSettingsRecord[] | undefined;
      return list?.[0] ?? null;
    },
    staleTime: 5 * 60 * 1000,
  });
