import { format, formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { parseServerDate } from './serverDate';

/** Les dates serveur sans fuseau sont en UTC — cf. `parseServerDate`. */
const safeDate = (value: string | number | Date): Date => parseServerDate(value);

export const formatPrice = (value: number | string | undefined | null): string => {
  if (value === null || value === undefined) return '0,00 €';
  const n = typeof value === 'string' ? parseFloat(value) : value;
  if (Number.isNaN(n)) return '0,00 €';
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n);
};

export const formatDate = (value: string | Date, pattern = 'dd MMM yyyy'): string => {
  try {
    return format(safeDate(value), pattern, { locale: fr });
  } catch {
    return String(value ?? '');
  }
};

export const formatDateTime = (value: string | Date): string =>
  formatDate(value, 'dd MMM yyyy à HH:mm');

export const formatRelative = (value: string | Date): string => {
  try {
    return formatDistanceToNow(safeDate(value), { addSuffix: true, locale: fr });
  } catch {
    return '';
  }
};

export const truncate = (s: string | undefined | null, n: number): string => {
  if (!s) return '';
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
};

export const initials = (name: string | undefined): string => {
  if (!name?.trim()) return '';
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '';
};
